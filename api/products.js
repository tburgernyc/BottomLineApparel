// api/products.js
// Vercel serverless function — proxies Printful API, returns classified products
// with full per-variant detail so the storefront can render a variant picker.

import { shapeProduct } from './_printful.js';

const PRINTFUL_BASE = 'https://api.printful.com';
const MAX_RETRIES = 3;
const PRINTFUL_FETCH_TIMEOUT_MS = 8000;
const SYNC_PRODUCTS_PAGE_SIZE = 100;

async function fetchWithRetry(url, options, retries = 0) {
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(PRINTFUL_FETCH_TIMEOUT_MS),
    });

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

async function fetchAllSyncProducts(headers) {
  const all = [];
  let offset = 0;
  while (true) {
    const url = `${PRINTFUL_BASE}/sync/products?limit=${SYNC_PRODUCTS_PAGE_SIZE}&offset=${offset}`;
    const data = await fetchWithRetry(url, { headers });
    const page = data.result || [];
    all.push(...page);
    if (page.length < SYNC_PRODUCTS_PAGE_SIZE) break;
    offset += SYNC_PRODUCTS_PAGE_SIZE;
  }
  return all;
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
    productList = await fetchAllSyncProducts(headers);
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
