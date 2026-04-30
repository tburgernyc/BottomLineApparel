// api/stripe-webhook.js
// Handles Stripe webhook events. On checkout.session.completed, creates a
// Printful order using the metadata captured by api/checkout.js.
//
// Vercel-specific: bodyParser is disabled because Stripe signature verification
// requires the raw body bytes.

import Stripe from 'stripe';
import crypto from 'node:crypto';

const PRINTFUL_BASE = 'https://api.printful.com';
// Verify this matches your Stripe Dashboard → Webhooks → endpoint API version.
const STRIPE_API_VERSION = '2024-10-28.acacia';
const PRINTFUL_FETCH_TIMEOUT_MS = 12000;

export const config = {
  api: { bodyParser: false },
};

function pfHeaders() {
  const headers = {
    Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
    'Content-Type': 'application/json',
    'User-Agent': 'BottomLineApparel-Webhook/1.0',
  };
  const storeId = process.env.PRINTFUL_STORE_ID;
  if (storeId) headers['X-PF-Store-Id'] = String(storeId);
  return headers;
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function parseItemsFromMetadata(meta) {
  // New shape: a JSON array of {v, q} pairs in `printful_items_json`.
  if (meta.printful_items_json) {
    try {
      const arr = JSON.parse(meta.printful_items_json);
      if (Array.isArray(arr) && arr.length) {
        return arr
          .map(i => ({
            sync_variant_id: parseInt(i.v, 10),
            quantity: Math.max(1, parseInt(i.q, 10) || 1),
          }))
          .filter(i => Number.isFinite(i.sync_variant_id));
      }
    } catch (err) {
      console.error('[stripe-webhook] Failed to parse printful_items_json:', err.message);
    }
  }
  // Legacy shape: single sync variant id + qty in flat metadata fields.
  if (meta.printful_sync_variant_id) {
    const id = parseInt(meta.printful_sync_variant_id, 10);
    if (Number.isFinite(id)) {
      return [{ sync_variant_id: id, quantity: parseInt(meta.printful_quantity, 10) || 1 }];
    }
  }
  return [];
}

async function createPrintfulOrder(session) {
  const meta = session.metadata || {};
  const items = parseItemsFromMetadata(meta);

  if (!items.length) {
    return { ok: false, error: 'metadata_missing_items', retryable: false };
  }

  // Require a real shipping address. Falling back to billing risks shipping to
  // PO boxes / work addresses that the customer never approved for delivery.
  const ship = session.shipping_details || {};
  const customer = session.customer_details || {};
  const address = ship.address;
  if (!address || !address.line1) {
    return { ok: false, error: 'no_shipping_address', retryable: false };
  }

  // Stripe session ids are ~66 chars (cs_test_...). Printful's external_id is
  // capped (32 in older docs, 64 in newer) — hash to a safe deterministic 32 hex.
  const externalId = crypto.createHash('sha256').update(session.id).digest('hex').slice(0, 32);

  const order = {
    external_id: externalId,
    // Keep the full session id discoverable for human triage.
    notes: `Stripe session: ${session.id}`,
    recipient: {
      name: ship.name || customer.name || 'Customer',
      email: customer.email || '',
      phone: customer.phone || '',
      address1: address.line1,
      address2: address.line2 || '',
      city: address.city || '',
      state_code: address.state || '',
      country_code: address.country || 'US',
      zip: address.postal_code || '',
    },
    items,
  };

  const isAutoConfirm = process.env.PRINTFUL_AUTO_CONFIRM === 'true';
  const url = isAutoConfirm ? `${PRINTFUL_BASE}/orders?confirm=1` : `${PRINTFUL_BASE}/orders`;

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  console.log(`[stripe-webhook] Creating Printful order: lines=${items.length} qty=${totalQty} auto-confirm=${isAutoConfirm} ext=${externalId}`);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: pfHeaders(),
      body: JSON.stringify(order),
      signal: AbortSignal.timeout(PRINTFUL_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    // Network error / timeout — let Stripe retry.
    return { ok: false, error: `printful_network_error: ${err.message}`, retryable: true };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 5xx and 429 are transient; 4xx (bad variant, validation) are permanent.
    const retryable = res.status >= 500 || res.status === 429;
    return { ok: false, error: `Printful ${res.status}`, details: data, retryable };
  }
  return { ok: true, printful_order_id: data.result?.id, status: data.result?.status };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe-webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET missing');
    return res.status(503).json({ error: 'configuration_missing' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  const sig = req.headers['stripe-signature'];

  let raw;
  try {
    raw = await readRawBody(req);
  } catch (err) {
    console.error('[stripe-webhook] Failed to read body:', err.message);
    return res.status(400).json({ error: 'body_read_failed' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: 'invalid_signature' });
  }

  console.log(`[stripe-webhook] event=${event.type} id=${event.id}`);

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ acknowledged: true, type: event.type });
  }

  const session = event.data.object;
  console.log(`[stripe-webhook] session=${session.id}`);

  // Guard against unpaid sessions. Card flows always arrive 'paid', but adding
  // ACH/wallets later would otherwise let us ship before payment captures.
  if (session.payment_status !== 'paid') {
    console.warn(`[stripe-webhook] session ${session.id} not paid (status=${session.payment_status}); skipping fulfillment`);
    return res.status(200).json({ ok: true, skipped: 'unpaid', payment_status: session.payment_status });
  }

  const result = await createPrintfulOrder(session);
  if (!result.ok) {
    console.error('[stripe-webhook] Fulfillment failed:', result.error, result.details || '');
    // 5xx/429/network → retryable: return 503 so Stripe redelivers (Printful's
    //   external_id hash dedupes any successful-but-lost responses).
    // 4xx/validation → permanent: 200 to stop Stripe retrying a known-bad order.
    if (result.retryable) {
      return res.status(503).json({ ok: false, ...result });
    }
    return res.status(200).json({ ok: false, ...result });
  }
  console.log(`[stripe-webhook] Printful order created: ${result.printful_order_id} (${result.status})`);
  return res.status(200).json(result);
}
