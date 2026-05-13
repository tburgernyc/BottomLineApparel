// api/checkout.js
// Creates a Stripe Checkout Session for one or more Printful sync variants.
// The Stripe webhook handler picks the order up via metadata after payment.
//
// Accepts either:
//   { sync_variant_id, quantity }                          (legacy single-item)
//   { line_items: [{ sync_variant_id, quantity }, ...] }   (new multi-item from cart)

import Stripe from 'stripe';
import crypto from 'node:crypto';

const PRINTFUL_BASE = 'https://api.printful.com';
const MAX_QUANTITY = 10;
const MAX_LINE_ITEMS = 20;
const ALLOWED_COUNTRIES = ['US', 'CA', 'GB', 'AU'];
// Cart total threshold above which the brand absorbs shipping. Mirrors
// FREE_SHIPPING_THRESHOLD in src/cart/state.ts — keep both in sync.
const FREE_SHIPPING_THRESHOLD_CENTS = 7500;
// Cap to protect against tampered/runaway shipping rate values from the client.
// Real Printful rates max around $40 to AU; this is a hard ceiling, not a target.
const MAX_SHIPPING_CENTS = 9999;
// Pin so Stripe can't auto-upgrade event/object schemas under us.
const STRIPE_API_VERSION = '2024-10-28.acacia';
const PRINTFUL_FETCH_TIMEOUT_MS = 8000;
// Express wallets — enabled here unblock 20–35% of mobile checkouts.
// 'card' covers all major card brands; 'link' is Stripe's saved-card wallet;
// 'klarna' enables BNPL for apparel (mainstream in 2026).
const PAYMENT_METHOD_TYPES = ['card', 'link', 'klarna'];
// Stripe Tax product tax code for apparel.
// txcd_30011000 = "Clothing & Footwear" — the correct general apparel code.
// It applies state-by-state clothing exemptions automatically (e.g. NY's
// clothing-under-$110 exemption), which a generic "tangible goods" code wouldn't.
// See https://docs.stripe.com/tax/tax-codes
const APPAREL_TAX_CODE = 'txcd_30011000';

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
    signal: AbortSignal.timeout(PRINTFUL_FETCH_TIMEOUT_MS),
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

// Build the Stripe shipping_options array for the session. The frontend has
// already collected the customer's country/ZIP and queried Printful for a real
// rate, so we trust the rate it passes back — but we still cap the value and
// override to free when the subtotal crosses the threshold.
function buildShippingOptions(rate, subtotalCents) {
  const freeOption = {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: 0, currency: 'usd' },
      display_name: 'Free standard shipping',
      delivery_estimate: {
        minimum: { unit: 'business_day', value: 5 },
        maximum: { unit: 'business_day', value: 12 },
      },
      tax_behavior: 'exclusive',
    },
  };

  if (subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS) {
    return [freeOption];
  }

  if (!rate) {
    // No rate quoted (legacy single-variant callers, or the cart drawer hasn't
    // yet collected an address). Fall back to a single free option so the
    // session creates — Stripe Checkout will show it as free.
    return [freeOption];
  }

  const amount = Math.max(0, Math.min(MAX_SHIPPING_CENTS, Math.round(Number(rate.amount_cents) || 0)));
  const name = String(rate.name || 'Standard shipping').slice(0, 80);
  const min = Number.isFinite(rate.min_delivery_days) ? Math.max(1, rate.min_delivery_days) : 3;
  const max = Number.isFinite(rate.max_delivery_days) ? Math.max(min, rate.max_delivery_days) : 8;

  return [
    {
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount, currency: 'usd' },
        display_name: name,
        delivery_estimate: {
          minimum: { unit: 'business_day', value: min },
          maximum: { unit: 'business_day', value: max },
        },
        tax_behavior: 'exclusive',
      },
    },
  ];
}

function normalizeShippingRate(body) {
  const r = body.shipping_rate;
  if (!r || typeof r !== 'object') return null;
  const amount = Number(r.amount_cents);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return {
    amount_cents: amount,
    name: String(r.name || 'Standard shipping'),
    min_delivery_days: Number(r.min_delivery_days) || null,
    max_delivery_days: Number(r.max_delivery_days) || null,
  };
}

function normalizeRequestedItems(body) {
  // New shape — array of line items from the cart drawer.
  if (Array.isArray(body.line_items) && body.line_items.length > 0) {
    return body.line_items
      .map(li => ({
        sync_variant_id: parseInt(li.sync_variant_id, 10),
        quantity: Math.max(1, Math.min(MAX_QUANTITY, parseInt(li.quantity, 10) || 1)),
      }))
      .filter(li => Number.isFinite(li.sync_variant_id))
      .slice(0, MAX_LINE_ITEMS);
  }
  // Legacy shape — single sync_variant_id + quantity, kept for back-compat
  // with any cached client bundles or third-party callers.
  if (body.sync_variant_id != null) {
    const id = parseInt(body.sync_variant_id, 10);
    const qty = Math.max(1, Math.min(MAX_QUANTITY, parseInt(body.quantity, 10) || 1));
    if (Number.isFinite(id)) return [{ sync_variant_id: id, quantity: qty }];
  }
  return [];
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

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  const body = req.body || {};
  const requested = normalizeRequestedItems(body);
  const shippingRate = normalizeShippingRate(body);

  if (!requested.length) {
    return res.status(400).json({ error: 'invalid_line_items' });
  }

  // Resolve every Printful variant in parallel (capped at MAX_LINE_ITEMS so the
  // fan-out can't be abused for variant-enumeration scans).
  let resolved;
  try {
    resolved = await Promise.all(
      requested.map(async li => {
        const info = await fetchSyncVariant(li.sync_variant_id);
        return { req: li, info };
      }),
    );
  } catch (err) {
    console.error('[checkout] Printful variant lookup failed:', err.message);
    return res.status(502).json({ error: 'variant_lookup_failed' });
  }

  const stripeLineItems = [];
  const metadataItems = [];
  let subtotalCents = 0;

  for (const { req: li, info } of resolved) {
    if (!info) {
      console.error(`[checkout] No variantInfo for ${li.sync_variant_id}`);
      return res.status(404).json({ error: 'variant_not_found', sync_variant_id: li.sync_variant_id });
    }
    if (info.variant?.is_enabled === false || info.variant?.is_ignored === true) {
      console.warn(`[checkout] Variant ${li.sync_variant_id} disabled/ignored`);
      return res.status(404).json({ error: 'variant_not_available', sync_variant_id: li.sync_variant_id });
    }

    const { variant, product } = info;
    const priceCents = Math.round(parseFloat(variant.retail_price) * 100);
    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      console.error(`[checkout] Invalid price for variant ${li.sync_variant_id}: ${variant.retail_price}`);
      return res.status(400).json({ error: 'invalid_price', sync_variant_id: li.sync_variant_id });
    }

    const productTitle = product?.name || variant.name || 'Bottom Line Apparel item';
    const variantLabel = extractVariantInfo(variant.product?.name || '');
    const fullName = variantLabel ? `${productTitle} — ${variantLabel}` : productTitle;
    const image = bestVariantImage(variant);

    stripeLineItems.push({
      price_data: {
        // Assumes Printful store currency is USD. Update both here and in the
        // webhook if you switch the Printful store currency.
        currency: 'usd',
        product_data: {
          name: fullName.slice(0, 250),
          images: image ? [image] : undefined,
          tax_code: APPAREL_TAX_CODE,
        },
        unit_amount: priceCents,
        // Required when Stripe Tax is enabled. 'exclusive' = tax added on top
        // of the displayed retail price (standard US apparel pricing).
        tax_behavior: 'exclusive',
      },
      quantity: li.quantity,
    });

    metadataItems.push({
      sync_variant_id: li.sync_variant_id,
      quantity: li.quantity,
    });
    subtotalCents += priceCents * li.quantity;
  }

  const baseUrl = req.headers.origin || `https://${req.headers.host || 'www.bottomlineapparel.store'}`;

  // Pack the order's items into a single metadata field for the webhook to
  // replay. Stripe metadata values are capped at 500 chars, so we serialize
  // a compact JSON array of {v,q} pairs (sufficient for ~30 line items).
  const itemsForMeta = JSON.stringify(metadataItems.map(i => ({ v: i.sync_variant_id, q: i.quantity })));
  if (itemsForMeta.length > 480) {
    return res.status(400).json({ error: 'cart_too_large' });
  }

  // Idempotency: hash the cart contents + IP into a 5-minute bucket so a
  // double-click can't create two sessions, but a deliberate retry after the
  // bucket window can succeed.
  const ipRaw = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '';
  const ip = String(ipRaw).split(',')[0].trim() || 'unknown';
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const cartFingerprint = metadataItems
    .map(i => `${i.sync_variant_id}x${i.quantity}`)
    .sort()
    .join('|');
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`checkout:${cartFingerprint}:${ip}:${bucket}`)
    .digest('hex');

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Persist a Customer record with the collected billing/shipping address.
      // Required by Stripe's recommended Tax integration for anonymous checkouts
      // and lets the webhook + future Klaviyo/loyalty flows read session.customer.
      customer_creation: 'always',
      payment_method_types: PAYMENT_METHOD_TYPES,
      // Express checkout button (Apple Pay / Google Pay / Link) — Stripe
      // surfaces these automatically when the buyer's device supports them.
      // We don't need to enumerate apple_pay/google_pay in payment_method_types.
      line_items: stripeLineItems,
      shipping_address_collection: {
        allowed_countries: ALLOWED_COUNTRIES,
      },
      // Pre-locked from the drawer's ZIP/country query against Printful. If
      // the customer's subtotal crosses the free-shipping threshold, this is
      // overridden to a single $0 option regardless of the rate they were shown.
      shipping_options: buildShippingOptions(shippingRate, subtotalCents),
      phone_number_collection: { enabled: true },
      // Allow promo codes — required surface for any future Klaviyo / loyalty flow.
      allow_promotion_codes: true,
      // Requires Stripe Tax to be activated in the Stripe Dashboard and
      // at least one tax registration on file. See docs/STRIPE_PRINTFUL_SETUP.md.
      automatic_tax: { enabled: true },
      metadata: {
        printful_items_json: itemsForMeta,
        printful_total_qty: String(metadataItems.reduce((s, i) => s + i.quantity, 0)),
      },
      success_url: `${baseUrl}/?order=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?order=canceled`,
    }, { idempotencyKey });

    return res.status(200).json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('[checkout] Stripe session creation failed:', err.message);
    return res.status(502).json({ error: 'stripe_session_failed', message: err.message });
  }
}
