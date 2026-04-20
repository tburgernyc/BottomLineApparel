// api/products.js
// Vercel serverless function — proxies Printful API, returns classified products.
// All Printful API calls happen server-side. The API key is never sent to the browser.

import fs from 'fs/promises';
import path from 'path';

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
  const enabled = (syncVariants || []).filter(v => v.is_enabled !== false);
  for (const variant of enabled) {
    const preview = (variant.files || []).find(f => f.type === 'preview');
    if (preview && preview.preview_url) return preview.preview_url;
  }
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
 * Classify a sync product into specific categories.
 */
function classify(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('hoodie') || lower.includes('sweat') || lower.includes('zip')) return 'hoodies';
  if (lower.includes('tank')) return 'tanks';
  if (lower.includes('tee') || lower.includes('t-shirt') || lower.includes('shirt')) return 'tshirts';
  if (lower.includes('phone') || lower.includes('case')) return 'phoneCases';
  return 'accessories';
}

/**
 * Shape a Printful sync product + its variants into our clean API response shape.
 */
function shapeProduct(syncProduct, syncVariants, productMapping = []) {
  const price = lowestPrice(syncVariants);
  const image = bestImage(syncProduct, syncVariants);

  // Inject Lemon Squeezy URL from mapping if exists
  let lemonsqueezy_url = null;
  const productMap = productMapping.find(p => String(p.id) === String(syncProduct.id));
  if (productMap) {
    lemonsqueezy_url = productMap.lemonsqueezy_url;
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

  if (!apiKey || !storeId) {
    return res.status(503).json({
      error: 'missing_env',
      hint: 'Add PRINTFUL_API_KEY and PRINTFUL_STORE_ID in Vercel Dashboard.',
    });
  }

  // Load product mapping once
  let productMapping = [];
  try {
    const mappingPath = path.join(process.cwd(), 'product_mapping.json');
    const mappingData = await fs.readFile(mappingPath, 'utf8');
    const mapping = JSON.parse(mappingData);
    productMapping = mapping.products || [];
  } catch (err) {
    console.warn('[api/products] Mapping read failed or file missing:', err.message);
  }

  const headers = pfHeaders(apiKey, storeId);

  // Step 1: Fetch the list of all sync products
  let productList;
  try {
    const listRes = await fetch(`${PRINTFUL_BASE}/sync/products?limit=100`, { headers });
    if (!listRes.ok) {
      return res.status(503).json({ error: 'printful_error', status: listRes.status });
    }
    const listData = await listRes.json();
    productList = listData.result || [];
  } catch (err) {
    return res.status(503).json({ error: 'fetch_failed', message: err.message });
  }

  if (!productList.length) {
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).json({ tshirts: [], tanks: [], hoodies: [], phoneCases: [], accessories: [] });
  }

  // Step 2: Fetch detailed info (with variants) for products
  let detailedProducts = [];
  const CHUNK_SIZE = 5;
  for (let i = 0; i < productList.length; i += CHUNK_SIZE) {
    const chunk = productList.slice(i, i + CHUNK_SIZE);
    const detailFetches = chunk.map(p =>
      fetch(`${PRINTFUL_BASE}/sync/products/${p.id}`, { headers })
        .then(async r => {
          if (r.status === 429) return null;
          if (!r.ok) throw new Error(`Printful Error ${r.status}`);
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
    const shaped = shapeProduct(detail.sync_product, detail.sync_variants, productMapping);
    if (!shaped || !shaped.price) continue; // Skip items with no price/disabled

    if (grouped[shaped.category]) {
      grouped[shaped.category].push(shaped);
    } else {
      grouped.accessories.push(shaped);
    }
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  return res.status(200).json(grouped);
}
