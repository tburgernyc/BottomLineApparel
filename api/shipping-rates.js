// api/shipping-rates.js
// Calls Printful /shipping/rates with the customer's cart + a ship-to address
// (country, optional state, optional zip) and returns up to two normalized
// shipping options for the cart drawer to display.
//
// Request body:
//   {
//     country_code: 'US',         // ISO 2-letter, required
//     state_code:   'NY',         // 2-letter state/region, recommended for US/CA
//     zip:          '10001',      // postal code, recommended
//     city:         'New York',   // optional but improves Printful accuracy
//     line_items: [{ sync_variant_id, quantity }, ...]
//   }
//
// Response (200):
//   {
//     rates: [
//       { id, name, rate_cents, currency, min_delivery_days, max_delivery_days }
//     ],
//     currency: 'USD'
//   }

const PRINTFUL_BASE = 'https://api.printful.com';
const MAX_LINE_ITEMS = 20;
const MAX_QUANTITY = 10;
const ALLOWED_COUNTRIES = new Set(['US', 'CA', 'GB', 'AU']);
const PRINTFUL_FETCH_TIMEOUT_MS = 8000;

function pfHeaders() {
  const headers = {
    Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
    'Content-Type': 'application/json',
    'User-Agent': 'BottomLineApparel-ShippingRates/1.0',
  };
  const storeId = process.env.PRINTFUL_STORE_ID;
  if (storeId) headers['X-PF-Store-Id'] = String(storeId);
  return headers;
}

function normalizeLineItems(body) {
  if (!Array.isArray(body.line_items)) return [];
  return body.line_items
    .map(li => ({
      sync_variant_id: parseInt(li.sync_variant_id, 10),
      quantity: Math.max(1, Math.min(MAX_QUANTITY, parseInt(li.quantity, 10) || 1)),
    }))
    .filter(li => Number.isFinite(li.sync_variant_id))
    .slice(0, MAX_LINE_ITEMS);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!process.env.PRINTFUL_API_KEY) {
    console.error('[shipping-rates] PRINTFUL_API_KEY not configured');
    return res.status(503).json({ error: 'configuration_missing' });
  }

  const body = req.body || {};
  const country = String(body.country_code || '').toUpperCase();
  if (!ALLOWED_COUNTRIES.has(country)) {
    return res.status(400).json({ error: 'unsupported_country' });
  }

  const items = normalizeLineItems(body);
  if (!items.length) {
    return res.status(400).json({ error: 'invalid_line_items' });
  }

  const recipient = {
    country_code: country,
    state_code: body.state_code ? String(body.state_code).toUpperCase().slice(0, 4) : undefined,
    zip: body.zip ? String(body.zip).slice(0, 20) : undefined,
    city: body.city ? String(body.city).slice(0, 60) : undefined,
  };

  // Printful expects { recipient, items: [{ sync_variant_id, quantity }] }.
  let pfRes;
  try {
    pfRes = await fetch(`${PRINTFUL_BASE}/shipping/rates`, {
      method: 'POST',
      headers: pfHeaders(),
      body: JSON.stringify({ recipient, items, currency: 'USD' }),
      signal: AbortSignal.timeout(PRINTFUL_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('[shipping-rates] Printful network error:', err.message);
    return res.status(502).json({ error: 'printful_unreachable' });
  }

  const data = await pfRes.json().catch(() => ({}));
  if (!pfRes.ok) {
    // Printful surfaces ZIP/state/country errors as 4xx; pass back a friendly code.
    const code = pfRes.status === 400 ? 'invalid_address' : 'printful_error';
    console.warn(`[shipping-rates] Printful ${pfRes.status}:`, data?.result || data?.error || '');
    return res.status(pfRes.status === 400 ? 400 : 502).json({
      error: code,
      message: data?.result || data?.error?.message || `Printful responded ${pfRes.status}`,
    });
  }

  const rawRates = Array.isArray(data.result) ? data.result : [];
  if (!rawRates.length) {
    return res.status(502).json({ error: 'no_rates_available' });
  }

  // Pick the cheapest STANDARD option and the fastest EXPRESS (if any).
  // Printful returns rates sorted cheapest-first; the express option uses an
  // 'EXPRESS' id suffix or has lower max delivery days than the rest.
  const byPrice = [...rawRates].sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
  const cheapest = byPrice[0];
  const fastest = [...rawRates]
    .sort((a, b) => (a.maxDeliveryDays ?? 99) - (b.maxDeliveryDays ?? 99))[0];

  const rates = [];
  if (cheapest) rates.push(formatRate(cheapest));
  if (fastest && fastest.id !== cheapest?.id) rates.push(formatRate(fastest));

  return res.status(200).json({ rates, currency: 'USD' });
}

function formatRate(r) {
  return {
    id: r.id,
    name: r.name || 'Shipping',
    rate_cents: Math.round(parseFloat(r.rate) * 100),
    currency: (r.currency || 'USD').toUpperCase(),
    min_delivery_days: r.minDeliveryDays ?? null,
    max_delivery_days: r.maxDeliveryDays ?? null,
  };
}
