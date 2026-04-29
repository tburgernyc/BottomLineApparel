// api/stripe-webhook.js
// Handles Stripe webhook events. On checkout.session.completed, creates a
// Printful order using the metadata captured by api/checkout.js.
//
// Vercel-specific: bodyParser is disabled because Stripe signature verification
// requires the raw body bytes.

import Stripe from 'stripe';

const PRINTFUL_BASE = 'https://api.printful.com';

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

async function createPrintfulOrder(session) {
  const meta = session.metadata || {};
  const syncVariantId = parseInt(meta.printful_sync_variant_id, 10);
  const quantity = parseInt(meta.printful_quantity, 10) || 1;

  if (!Number.isFinite(syncVariantId)) {
    return { ok: false, error: 'metadata_missing_variant_id' };
  }

  const ship = session.shipping_details || {};
  const customer = session.customer_details || {};
  const address = ship.address || customer.address;
  if (!address || !address.line1) {
    return { ok: false, error: 'no_shipping_address' };
  }

  const order = {
    external_id: session.id, // Printful idempotency
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
    items: [{
      sync_variant_id: syncVariantId,
      quantity,
    }],
  };

  const isAutoConfirm = process.env.PRINTFUL_AUTO_CONFIRM === 'true';
  const url = isAutoConfirm ? `${PRINTFUL_BASE}/orders?confirm=1` : `${PRINTFUL_BASE}/orders`;

  console.log(`[stripe-webhook] Creating Printful order: variant=${syncVariantId} qty=${quantity} auto-confirm=${isAutoConfirm}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: pfHeaders(),
    body: JSON.stringify(order),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: `Printful ${res.status}`, details: data };
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

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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
  console.log(`[stripe-webhook] session=${session.id} email=${session.customer_details?.email}`);

  const result = await createPrintfulOrder(session);
  if (!result.ok) {
    console.error('[stripe-webhook] Fulfillment failed:', result.error, result.details || '');
    // Return 200 — we don't want Stripe retrying a known-bad order.
    // Failed fulfillments are visible in logs and the Stripe Dashboard for manual triage.
    return res.status(200).json({ ok: false, ...result });
  }
  console.log(`[stripe-webhook] Printful order created: ${result.printful_order_id} (${result.status})`);
  return res.status(200).json(result);
}
