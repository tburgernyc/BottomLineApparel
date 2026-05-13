// api/_orders.js
// Thin wrapper around Vercel KV (Upstash Redis under the hood since the 2025
// Vercel KV → Upstash migration). Stores one record per Stripe Checkout
// Session, keyed `orders:<session_id>`, so the post-payment fulfillment path
// is auditable and Printful failures can be recovered manually.
//
// Schema:
//   {
//     session_id, status, created_at, updated_at,
//     items: [{ sync_variant_id, quantity }],
//     customer_email, amount_total_cents,
//     printful_order_id, printful_external_id,
//     fulfillment_attempts: [{ at, ok, error?, retryable? }]
//   }
//
// status:
//   - 'paid_pending_fulfillment' — Stripe webhook received, Printful call in flight
//   - 'fulfilled'                — Printful order created successfully
//   - 'fulfillment_failed'       — non-retryable Printful failure; admin alerted

import { createClient } from '@vercel/kv';

const TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days — enough for support / chargebacks

// Resolve from either env var pair: legacy Vercel KV names
// (KV_REST_API_URL / KV_REST_API_TOKEN) or the newer Vercel marketplace +
// Upstash integration names (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
// Same underlying Upstash store either way.
function resolveKvEnv() {
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
  };
}

let _kv = null;
function getKv() {
  if (_kv) return _kv;
  const { url, token } = resolveKvEnv();
  if (!url || !token) return null;
  _kv = createClient({ url, token });
  return _kv;
}

function key(sessionId) {
  return `orders:${sessionId}`;
}

function isConfigured() {
  return Boolean(getKv());
}

export async function recordOrderInitial(session, items) {
  if (!isConfigured()) {
    console.warn('[_orders] KV not configured — skipping order log write');
    return null;
  }
  const now = new Date().toISOString();
  const record = {
    session_id: session.id,
    status: 'paid_pending_fulfillment',
    created_at: now,
    updated_at: now,
    items,
    customer_email: session.customer_details?.email || null,
    amount_total_cents: session.amount_total ?? null,
    currency: session.currency || 'usd',
    printful_order_id: null,
    printful_external_id: null,
    fulfillment_attempts: [],
  };
  try {
    await getKv().set(key(session.id), record, { ex: TTL_SECONDS });
    return record;
  } catch (err) {
    console.error('[_orders] Failed to write initial record:', err.message);
    return null;
  }
}

export async function recordOrderFulfilled(sessionId, { printfulOrderId, printfulExternalId }) {
  if (!isConfigured()) return null;
  try {
    const existing = (await getKv().get(key(sessionId))) || {};
    const now = new Date().toISOString();
    const updated = {
      ...existing,
      status: 'fulfilled',
      updated_at: now,
      printful_order_id: printfulOrderId ?? existing.printful_order_id ?? null,
      printful_external_id: printfulExternalId ?? existing.printful_external_id ?? null,
      fulfillment_attempts: [
        ...(existing.fulfillment_attempts || []),
        { at: now, ok: true },
      ],
    };
    await getKv().set(key(sessionId), updated, { ex: TTL_SECONDS });
    return updated;
  } catch (err) {
    console.error('[_orders] Failed to record fulfilled:', err.message);
    return null;
  }
}

export async function recordOrderFailure(sessionId, { error, retryable, details }) {
  if (!isConfigured()) return null;
  try {
    const existing = (await getKv().get(key(sessionId))) || {};
    const now = new Date().toISOString();
    const attempts = [
      ...(existing.fulfillment_attempts || []),
      { at: now, ok: false, error: String(error || 'unknown'), retryable: Boolean(retryable), details: details || null },
    ];
    // Retryable failures stay in 'paid_pending_fulfillment' so reruns can resolve them.
    // Permanent failures flip to 'fulfillment_failed' so the admin alert reflects final state.
    const status = retryable ? (existing.status || 'paid_pending_fulfillment') : 'fulfillment_failed';
    const updated = {
      ...existing,
      status,
      updated_at: now,
      fulfillment_attempts: attempts,
    };
    await getKv().set(key(sessionId), updated, { ex: TTL_SECONDS });
    return updated;
  } catch (err) {
    console.error('[_orders] Failed to record failure:', err.message);
    return null;
  }
}

export async function recordEmailSent(sessionId, kind, ok, error) {
  if (!isConfigured()) return null;
  try {
    const existing = (await getKv().get(key(sessionId))) || {};
    const now = new Date().toISOString();
    const updated = {
      ...existing,
      updated_at: now,
      email_log: [
        ...(existing.email_log || []),
        { at: now, kind, ok: Boolean(ok), error: error ? String(error) : undefined },
      ],
    };
    await getKv().set(key(sessionId), updated, { ex: TTL_SECONDS });
    return updated;
  } catch (err) {
    console.error('[_orders] Failed to record email:', err.message);
    return null;
  }
}

export async function getOrder(sessionId) {
  if (!isConfigured()) return null;
  try {
    return await getKv().get(key(sessionId));
  } catch (err) {
    console.error('[_orders] Failed to read order:', err.message);
    return null;
  }
}
