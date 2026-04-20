// api/products.js
// Vercel serverless function — proxies Printful API, returns classified products.
// All Printful API calls happen server-side. The API key is never sent to the browser.
//
// Printful API v1 reference: https://developers.printful.com/docs
// Endpoints used:
//   GET /sync/products              — list of store sync products (with thumbnail_url)
//   GET /sync/products/{id}         — full product detail with sync_variants & retail_price
// Auth: Bearer token + X-PF-Store-Id header

const PRINTFUL_BASE = 'https://api.printful.com';

/**
 * Build Printful request headers from env vars.
 */
function pfHeaders(apiKey, storeId) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'X-PF-Store-Id': storeId,
    'User-Agent': 'BottomLineApparel/2.0',
  };
}

/**
 * Find lowest retail price among enabled sync variants.
 * Printful returns retail_price as a decimal string (e.g. "29.99").
 * Returns null if no enabled variants found.
 */
function lowestPrice(syncVariants) {
  const enabled = (syncVariants || []).filter(v => v.is_enabled !== false);
  if (!enabled.length) return null;
  const prices = enabled
    .map(v => parseFloat(v.retail_price))
    .filter(p => !isNaN(p) && p > 0);
  return prices.length ? Math.min(...prices) : null;
}

/**
 * Extract the best preview image URL from sync_variants files.
 * Priority: variant file type "preview" > product thumbnail_url.
 */
function bestImage(syncProduct, syncVariants) {
  // Try first enabled variant's preview file
  const enabled = (syncVariants || []).filter(v => v.is_enabled !== false);
  for (const variant of enabled) {
    const preview = (variant.files || []).find(f => f.type === 'preview');
    if (preview && preview.preview_url) return preview.preview_url;
  }
  // Fall back to product-level thumbnail
  return syncProduct.thumbnail_url || null;
}

/**
 * Strip HTML tags and return only the first sentence of text.
 */
function extractShortDescription(html) {
  if (!html) return '';
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const match = text.match(/^.+?[.!?](?:\s|$)/);
  return match ? match[0].trim() : text.slice(0, 120);
}

/**
 * Classify a sync product into specific categories: tshirts, tanks, hoodies, phoneCases, or accessories.
 * We check if the product name contains known keywords.
 */
function classify(name) {
  const lower = (name || '').toLowerCase();

  if (lower.includes('hoodie') || lower.includes('sweat') || lower.includes('zip')) return 'hoodies';
  if (lower.includes('tank')) return 'tanks';
  if (lower.includes('tee') || lower.includes('t-shirt') || lower.includes('shirt')) return 'tshirts';
  if (lower.includes('phone') || lower.includes('case')) return 'phoneCases';

  // Default fallback
  return 'accessories';
}

/**
 * Shape a Printful sync product + its variants into our clean API response shape.
 */
// Inject Lemon Squeezy URL from mapping if exists
let lemonsqueezy_url = null;
try {
  const mappingPath = require('path').join(process.cwd(), 'product_mapping.json');
  if (require('fs').existsSync(mappingPath)) {
    const mapping = JSON.parse(require('fs').readFileSync(mappingPath, 'utf8'));
    const productMap = mapping.products.find(p => p.id === syncProduct.id);
    if (productMap) lemonsqueezy_url = productMap.lemonsqueezy_url;
  }
} catch (err) {
  // console.warn('[api/products] Mapping read failed', err.message);
}

return {
  id: syncProduct.id,
  title: syncProduct.name,
  short_description: extractShortDescription(syncProduct.description || ''),
  price,
  image,
  tiktok_url: null,
  lemonsqueezy_url,
  category: classify(syncProduct.name),
};
}

export default async function handler(req, res) {
  const apiKey = process.env.PRINTFUL_API_KEY;
  const storeId = process.env.PRINTFUL_STORE_ID;

  // Detailed diagnostic response when env vars are missing.
  if (!apiKey || !storeId) {
    const missing = [];
    if (!apiKey) missing.push('PRINTFUL_API_KEY');
    if (!storeId) missing.push('PRINTFUL_STORE_ID');
    console.error('[api/products] Missing env vars:', missing.join(', '));
    return res.status(503).json({
      error: 'missing_env',
      missing,
      hint: 'Add these variables in Vercel Dashboard → Settings → Environment Variables, then redeploy.',
    });
  }

  const headers = pfHeaders(apiKey, storeId);

  // Step 1: Fetch the list of all sync products
  let productList;
  try {
    const listRes = await fetch(`${PRINTFUL_BASE}/sync/products?limit=100`, { headers });
    if (!listRes.ok) {
      const body = await listRes.text().catch(() => '');
      console.error('[api/products] Printful list error:', listRes.status, body.slice(0, 200));
      return res.status(503).json({ error: 'printful_error', status: listRes.status });
    }
    const listData = await listRes.json();
    productList = listData.result || [];
  } catch (err) {
    console.error('[api/products] List fetch exception:', err.message);
    return res.status(503).json({ error: 'fetch_failed', message: err.message });
  }

  if (!productList.length) {
    console.warn('[api/products] No products found in Printful store');
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).json({ tees: [], accessories: [] });
  }

  // Step 2: Fetch full detail (with sync_variants) for each product in chunks
  // We need variant detail for retail_price and preview image.
  let detailedProducts = [];
  try {
    const CHUNK_SIZE = 5;
    for (let i = 0; i < productList.length; i += CHUNK_SIZE) {
      const chunk = productList.slice(i, i + CHUNK_SIZE);
      const detailFetches = chunk.map(p =>
        fetch(`${PRINTFUL_BASE}/sync/products/${p.id}`, { headers })
          .then(async r => {
            if (r.status === 429) {
              console.warn(`[api/products] Rate limited on product ${p.id}. Status: 429`);
              return null; // Skip if heavily rate-limited, fail gracefully
            }
            if (!r.ok) {
              const body = await r.text().catch(() => '');
              throw new Error(`Printful Error ${r.status}: ${body.slice(0, 100)}`);
            }
            return r.json();
          })
          .then(d => (d ? d.result : null))
          .catch(err => {
            console.error(`[api/products] Detail fetch failed for product ${p.id}:`, err.message);
            return null;
          })
      );
      const results = await Promise.all(detailFetches);
      detailedProducts.push(...results.filter(Boolean));
    }
  } catch (err) {
    console.error('[api/products] Detail batch exception:', err.message);
    return res.status(503).json({ error: 'fetch_failed', message: err.message });
  }

  // Step 3: Shape and classify
  const grouped = {
    tshirts: [],
    tanks: [],
    hoodies: [],
    phoneCases: [],
    accessories: []
  };

  for (const detail of detailedProducts) {
    if (!detail || !detail.sync_product) continue;
    const shaped = shapeProduct(detail.sync_product, detail.sync_variants);
    if (!shaped) continue;

    if (grouped[shaped.category]) {
      grouped[shaped.category].push(shaped);
    } else {
      grouped.accessories.push(shaped);
    }
  }

  console.log(`[api/products] Returning ${grouped.tshirts.length} tees, ${grouped.tanks.length} tanks, ${grouped.hoodies.length} hoodies, ${grouped.phoneCases.length} phone cases`);

  // Cache at Vercel edge for 5 minutes, serve stale for 1 minute while revalidating
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  return res.status(200).json(grouped);
}
