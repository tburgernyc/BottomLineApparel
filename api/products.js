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

export async function getProductsData({ collectDrops = false } = {}) {
  const apiKey = process.env.PRINTFUL_API_KEY;
  const storeId = process.env.PRINTFUL_STORE_ID;

  if (!apiKey) {
    throw new Error('Server is not configured with Printful credentials (PRINTFUL_API_KEY missing).');
  }

  const headers = pfHeaders(apiKey, storeId);
  const dropped = collectDrops ? [] : null;

  let productList;
  try {
    productList = await fetchAllSyncProducts(headers);
    console.log(`[api/products] Printful: ${productList.length} sync products.`);
  } catch (err) {
    throw new Error('Failed to fetch product list from Printful: ' + err.message);
  }

  const empty = { tshirts: [], cropTops: [], tanks: [], hoodies: [], bottoms: [], phoneCases: [], headwear: [], footwear: [], accessories: [] };
  if (!productList.length) {
    return collectDrops ? { grouped: empty, dropped: [], totalFromList: 0 } : empty;
  }

  // Fetch detailed sync_variants for each product, in parallel chunks.
  // Track per-product detail-fetch outcomes so we can report timeouts as drops.
  const detailedProducts = [];
  const CHUNK_SIZE = 4;
  for (let i = 0; i < productList.length; i += CHUNK_SIZE) {
    const chunk = productList.slice(i, i + CHUNK_SIZE);
    const detailPromises = chunk.map(p =>
      fetchWithRetry(`${PRINTFUL_BASE}/sync/products/${p.id}`, { headers })
        .then(d => ({ id: p.id, name: p.name, detail: d.result, error: null }))
        .catch(err => ({ id: p.id, name: p.name, detail: null, error: err.message }))
    );
    const results = await Promise.all(detailPromises);
    for (const r of results) {
      if (r.error || !r.detail) {
        console.error(`[api/products] DROP id=${r.id} name="${r.name}" reason=detail_fetch_failed err="${r.error || 'no detail'}"`);
        if (dropped) dropped.push({ id: r.id, name: r.name, reason: 'detail_fetch_failed', error: r.error });
        continue;
      }
      detailedProducts.push(r.detail);
    }
  }

  const grouped = { ...empty };

  for (const detail of detailedProducts) {
    if (!detail || !detail.sync_product) continue;
    const sp = detail.sync_product;
    const { product, reason } = shapeProduct(sp, detail.sync_variants);
    if (!product) {
      console.warn(`[api/products] DROP id=${sp.id} name="${sp.name}" reason=${reason}`);
      if (dropped) dropped.push({ id: sp.id, name: sp.name, reason });
      continue;
    }
    if (grouped[product.category]) {
      grouped[product.category].push(product);
    } else {
      grouped.accessories.push(product);
    }
  }

  if (collectDrops) {
    return { grouped, dropped, totalFromList: productList.length };
  }
  return grouped;
}

export default async function handler(req, res) {
  try {
    const grouped = await getProductsData();
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    return res.status(200).json(grouped);
  } catch (err) {
    console.error('[api/products] handler error:', err.message);
    if (err.message.includes('configuration_missing') || err.message.includes('not configured')) {
      return res.status(503).json({ error: 'configuration_missing', message: err.message });
    }
    return res.status(502).json({ error: 'upstream_error', message: err.message });
  }
}
