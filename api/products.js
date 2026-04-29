// api/products.js
// Vercel serverless function — proxies Printful API, returns classified products
// with full per-variant detail so the storefront can render a variant picker.

const PRINTFUL_BASE = 'https://api.printful.com';
const MAX_RETRIES = 3;

async function fetchWithRetry(url, options, retries = 0) {
  try {
    const res = await fetch(url, options);

    if (res.status === 429 && retries < MAX_RETRIES) {
      const delay = Math.pow(2, retries) * 1000;
      console.warn(`[api/products] Rate limited (429). Retrying in ${delay}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries + 1);
    }

    if (!res.ok) {
      throw new Error(`Printful API responded with ${res.status}: ${res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const delay = Math.pow(2, retries) * 1000;
      console.error(`[api/products] Fetch error: ${err.message}. Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries + 1);
    }
    throw err;
  }
}

function pfHeaders(apiKey, storeId) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'User-Agent': 'BottomLineApparel/3.0',
    'Content-Type': 'application/json',
  };
  if (storeId) headers['X-PF-Store-Id'] = String(storeId);
  return headers;
}

// Preferred colors for the main product card image (checked in order)
const PREFERRED_COLORS = ['white', 'gray', 'grey', 'heather gray', 'heather grey', 'ash', 'silver', 'light gray', 'light grey'];

function isPreferredColor(variant) {
  // Check the variant's product name for color info (e.g. "... (White / XS)")
  const rawName = (variant.product?.name || variant.name || '').toLowerCase();
  const colorMatch = rawName.match(/\(([^()]+)\)\s*$/);
  if (colorMatch) {
    const colorPart = colorMatch[1].split('/')[0].trim().toLowerCase();
    if (PREFERRED_COLORS.some(c => colorPart.includes(c))) return true;
  }
  // Also check the variant's color field if present
  const color = (variant.color || '').toLowerCase();
  if (color && PREFERRED_COLORS.some(c => color.includes(c))) return true;
  return false;
}

function getVariantFrontImage(variant) {
  const files = variant.files || [];
  // Prefer 'front' type, then fall back to 'preview'
  const front = files.find(f => f.type === 'front');
  if (front && front.preview_url) return front.preview_url;
  const preview = files.find(f => f.type === 'preview');
  if (preview && preview.preview_url) return preview.preview_url;
  return null;
}

function bestProductImage(syncProduct, syncVariants) {
  const enabled = (syncVariants || []).filter(v => v.is_enabled !== false && !v.is_ignored);

  // First pass: try to find a white/gray variant with a front image
  for (const variant of enabled) {
    if (isPreferredColor(variant)) {
      const img = getVariantFrontImage(variant);
      if (img) return img;
    }
  }

  // Second pass: any variant with a front image
  for (const variant of enabled) {
    const img = getVariantFrontImage(variant);
    if (img) return img;
  }

  return syncProduct.thumbnail_url || null;
}

function variantImage(variant) {
  const img = getVariantFrontImage(variant);
  if (img) return img;
  return variant.product?.image || null;
}

function extractShortDescription(html) {
  if (!html) return '';
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const match = text.match(/^.+?[.!?](?:\s|$)/);
  return match ? match[0].trim() : text.slice(0, 120);
}

function classify(name) {
  const lower = (name || '').toLowerCase();
  const rules = [
    { keywords: ['crop hoodie'], category: 'hoodies' },
    { keywords: ['crop top', 'crop tee'], category: 'cropTops' },
    { keywords: ['sweatpant', 'jogger', 'pant'], category: 'bottoms' },
    { keywords: ['hoodie', 'sweat', 'zip'], category: 'hoodies' },
    { keywords: ['tank'], category: 'tanks' },
    { keywords: ['phone', 'case'], category: 'phoneCases' },
    { keywords: ['hat', 'cap', 'beanie'], category: 'headwear' },
    { keywords: ['shoe', 'slide', 'sneaker'], category: 'footwear' },
    { keywords: ['tee', 't-shirt', 'shirt'], category: 'tshirts' },
  ];
  for (const rule of rules) {
    if (rule.keywords.some(k => lower.includes(k))) return rule.category;
  }
  return 'accessories';
}

const SIZE_TOKENS = new Set([
  'xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', '4xl', '5xl',
  'one size', 'os',
]);

// Printful's sync_variant.product.name embeds the variant info inside the LAST
// parenthesized group, e.g. "Bella + Canvas 3413 Unisex Tee (Navy Triblend / XS)".
// Strip the garment description and return just what's inside the last (...).
function extractVariantInfo(rawLabel) {
  if (!rawLabel) return '';
  const m = rawLabel.match(/\(([^()]+)\)\s*$/);
  return m ? m[1].trim() : rawLabel.trim();
}

// Parse the cleaned variant info ("Navy Triblend / XS" or "Matte / iPhone 14"
// or "16 oz"). Printful's convention is "Color / Size" — we trust that order
// for 2-part labels rather than guessing which side is which.
function parseVariantLabel(rawLabel) {
  const cleaned = extractVariantInfo(rawLabel);
  if (!cleaned) return { color: null, size: null, label: '' };
  const parts = cleaned.split('/').map(s => s.trim()).filter(Boolean);
  if (parts.length === 1) {
    const lower = parts[0].toLowerCase();
    const looksLikeSize = SIZE_TOKENS.has(lower) || /^\d+(\.\d+)?$/.test(parts[0]);
    if (looksLikeSize) return { color: null, size: parts[0], label: cleaned };
    return { color: parts[0], size: null, label: cleaned };
  }
  return {
    color: parts[0],
    size: parts.slice(1).join(' / '),
    label: cleaned,
  };
}

function shapeVariant(syncVariant) {
  const price = parseFloat(syncVariant.retail_price);
  const rawLabel = syncVariant.product?.name || syncVariant.name || '';
  const { color, size, label } = parseVariantLabel(rawLabel);
  return {
    id: syncVariant.id, // sync_variant_id — what /api/checkout takes
    label, // cleaned, e.g. "Navy Triblend / XS"
    color,
    size,
    price: Number.isFinite(price) ? price : null,
    image: variantImage(syncVariant),
    sku: syncVariant.sku || null,
  };
}

function shapeProduct(syncProduct, syncVariants) {
  const enabled = (syncVariants || []).filter(v => v.is_enabled !== false && !v.is_ignored);
  if (!enabled.length) return null;

  const variants = enabled.map(shapeVariant).filter(v => v.price !== null);
  if (!variants.length) return null;

  const prices = variants.map(v => v.price);
  return {
    id: syncProduct.id,
    title: syncProduct.name,
    short_description: extractShortDescription(syncProduct.description || ''),
    min_price: Math.min(...prices),
    max_price: Math.max(...prices),
    image: bestProductImage(syncProduct, syncVariants),
    category: classify(syncProduct.name),
    variants,
  };
}

export default async function handler(req, res) {
  const apiKey = process.env.PRINTFUL_API_KEY;
  const storeId = process.env.PRINTFUL_STORE_ID;

  if (!apiKey) {
    console.error('[api/products] Configuration missing: PRINTFUL_API_KEY');
    return res.status(503).json({
      error: 'configuration_missing',
      message: 'Server is not configured with Printful credentials.',
    });
  }

  const headers = pfHeaders(apiKey, storeId);

  let productList;
  try {
    const listData = await fetchWithRetry(`${PRINTFUL_BASE}/sync/products?limit=100`, { headers });
    productList = listData.result || [];
    console.log(`[api/products] Printful: ${productList.length} sync products.`);
  } catch (err) {
    console.error('[api/products] Product list fetch failed:', err.message);
    return res.status(502).json({
      error: 'upstream_error',
      message: 'Failed to fetch product list from Printful.',
      details: err.message,
    });
  }

  const empty = { tshirts: [], cropTops: [], tanks: [], hoodies: [], bottoms: [], phoneCases: [], headwear: [], footwear: [], accessories: [] };
  if (!productList.length) {
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).json(empty);
  }

  // Fetch detailed sync_variants for each product, in parallel chunks
  let detailedProducts = [];
  const CHUNK_SIZE = 4;
  for (let i = 0; i < productList.length; i += CHUNK_SIZE) {
    const chunk = productList.slice(i, i + CHUNK_SIZE);
    const detailPromises = chunk.map(p =>
      fetchWithRetry(`${PRINTFUL_BASE}/sync/products/${p.id}`, { headers })
        .then(d => d.result)
        .catch(err => {
          console.error(`[api/products] Detail fetch failed for product ${p.id}:`, err.message);
          return null;
        })
    );
    const results = await Promise.all(detailPromises);
    detailedProducts.push(...results.filter(Boolean));
  }

  const grouped = { ...empty };

  for (const detail of detailedProducts) {
    if (!detail || !detail.sync_product) continue;
    const shaped = shapeProduct(detail.sync_product, detail.sync_variants);
    if (!shaped || !shaped.image) {
      console.warn(`[api/products] Skipping product ${detail.sync_product.id}: no shaped output or missing image`);
      continue;
    }
    if (grouped[shaped.category]) {
      grouped[shaped.category].push(shaped);
    } else {
      grouped.accessories.push(shaped);
    }
  }

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
  return res.status(200).json(grouped);
}
