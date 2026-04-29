// api/checkout.js
// Creates a Stripe Checkout Session for a single Printful sync variant.
// The Stripe webhook handler picks the order up via metadata after payment.

import Stripe from 'stripe';

const PRINTFUL_BASE = 'https://api.printful.com';
const MAX_QUANTITY = 10;
const ALLOWED_COUNTRIES = ['US', 'CA', 'GB', 'AU'];

function pfHeaders() {
  const headers = {
    Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
    'User-Agent': 'BottomLineApparel-Checkout/1.0',
  };
  const storeId = process.env.PRINTFUL_STORE_ID;
  if (storeId) headers['X-PF-Store-Id'] = String(storeId);
  return headers;
}

async function fetchSyncVariant(syncVariantId) {
  const res = await fetch(`${PRINTFUL_BASE}/sync/variant/${syncVariantId}`, {
    headers: pfHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Printful responded ${res.status} for variant ${syncVariantId}`);
  }
  const data = await res.json();
  const result = data.result || {};
  if (!result.sync_variant) return null;
  return { variant: result.sync_variant, product: result.sync_product };
}

function bestVariantImage(variant) {
  const preview = (variant.files || []).find(f => f.type === 'preview');
  if (preview && preview.preview_url) return preview.preview_url;
  return variant.product?.image || null;
}

// Printful sync_variant.product.name = "<Garment desc> (<Color> / <Size>)".
// Extract just the parenthesized variant info for customer-facing display.
function extractVariantInfo(rawLabel) {
  if (!rawLabel) return '';
  const m = rawLabel.match(/\(([^()]+)\)\s*$/);
  return m ? m[1].trim() : rawLabel.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[checkout] STRIPE_SECRET_KEY not configured');
    return res.status(503).json({ error: 'configuration_missing', message: 'Stripe not configured' });
  }
  if (!process.env.PRINTFUL_API_KEY) {
    console.error('[checkout] PRINTFUL_API_KEY not configured');
    return res.status(503).json({ error: 'configuration_missing', message: 'Printful not configured' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = req.body || {};
  const syncVariantId = parseInt(body.sync_variant_id, 10);
  const quantity = Math.max(1, Math.min(MAX_QUANTITY, parseInt(body.quantity, 10) || 1));

  if (!Number.isFinite(syncVariantId)) {
    return res.status(400).json({ error: 'invalid_variant_id' });
  }

  let variantInfo;
  try {
    variantInfo = await fetchSyncVariant(syncVariantId);
  } catch (err) {
    console.error('[checkout] Printful variant lookup failed:', err.message);
    return res.status(502).json({ error: 'variant_lookup_failed' });
  }

  if (!variantInfo || !variantInfo.variant?.is_enabled || variantInfo.variant?.is_ignored) {
    return res.status(404).json({ error: 'variant_not_available' });
  }

  const { variant, product } = variantInfo;
  const priceCents = Math.round(parseFloat(variant.retail_price) * 100);
  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    console.error(`[checkout] Invalid price for variant ${syncVariantId}: ${variant.retail_price}`);
    return res.status(400).json({ error: 'invalid_price' });
  }

  const productTitle = product?.name || variant.name || 'Bottom Line Apparel item';
  const variantLabel = extractVariantInfo(variant.product?.name || '');
  const fullName = variantLabel
    ? `${productTitle} — ${variantLabel}`
    : productTitle;
  const image = bestVariantImage(variant);

  const baseUrl = req.headers.origin || `https://${req.headers.host || 'bottom-line-apparel-1p4z.vercel.app'}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: fullName.slice(0, 250),
            images: image ? [image] : undefined,
          },
          unit_amount: priceCents,
        },
        quantity,
      }],
      shipping_address_collection: {
        allowed_countries: ALLOWED_COUNTRIES,
      },
      phone_number_collection: { enabled: true },
      metadata: {
        printful_sync_variant_id: String(syncVariantId),
        printful_quantity: String(quantity),
        printful_product_name: productTitle.slice(0, 250),
      },
      success_url: `${baseUrl}/?order=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?order=canceled`,
    });

    return res.status(200).json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('[checkout] Stripe session creation failed:', err.message);
    return res.status(502).json({ error: 'stripe_session_failed', message: err.message });
  }
}
