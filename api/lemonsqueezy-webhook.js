// api/lemonsqueezy-webhook.js
// Institutional-grade Webhook Handler: Lemon Squeezy -> Printful
// Handles secure order verification and automated fulfillment switching.

import crypto from 'crypto';

const PRINTFUL_BASE = 'https://api.printful.com';

/**
 * Verify Lemon Squeezy Signature
 * Uses the secret provided by the user to ensure the request is authentic.
 */
function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export default async function handler(req, res) {
  // 1. Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Secret Verification
  const signature = req.headers['x-signature'];
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!signature || !secret) {
    console.error('[webhook] Missing signature or secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Raw body needed for HMAC verification
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  
  if (!verifySignature(rawBody, signature, secret)) {
    console.error('[webhook] Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = JSON.parse(rawBody);
  const eventName = payload.meta.event_name;

  console.log(`[webhook] Received event: ${eventName}`);

  // We only care about order_created
  if (eventName !== 'order_created') {
    return res.status(200).json({ message: 'Ignored' });
  }

  const attributes = payload.data.attributes;
  const customerEmail = attributes.user_email;
  const customerName = attributes.user_name || 'Customer';
  
  // Extract Shipping Info (if available in attributes)
  // Lemon Squeezy order payload structure can vary; we check primary fields
  const firstItem = payload.data.attributes.first_order_item;
  const sku = firstItem ? firstItem.variant_sku : null;

  if (!sku) {
    console.error('[webhook] No SKU found in order. Cannot map to Printful.');
    return res.status(200).json({ message: 'Skipped - No SKU' });
  }

  console.log(`[webhook] Processing order for ${customerEmail}. Product SKU: ${sku}`);

  // 3. Prepare Printful Order
  // The 'SKU' in Lemon Squeezy MUST be the Printful Sync Variant ID.
  const printfulOrder = {
    recipient: {
      name: customerName,
      email: customerEmail,
      address1: attributes.order_items?.[0]?.shipping_address?.address_1 || '', // Note: Handle shipping logic based on LS account settings
      city: attributes.order_items?.[0]?.shipping_address?.city || '',
      country_code: attributes.order_items?.[0]?.shipping_address?.country || 'US',
      zip: attributes.order_items?.[0]?.shipping_address?.zip || '',
    },
    items: [
      {
        sync_variant_id: parseInt(sku, 10),
        quantity: 1
      }
    ]
  };

  // 4. Fulfillment Switch (Bootstrap vs. Pro)
  const isAutoConfirm = process.env.PRINTFUL_AUTO_CONFIRM === 'true';
  const printfulUrl = isAutoConfirm 
    ? `${PRINTFUL_BASE}/orders?confirm=1` 
    : `${PRINTFUL_BASE}/orders`;

  console.log(`[webhook] Creating Printful order. Auto-confirm: ${isAutoConfirm}`);

  try {
    const pfApiKey = process.env.PRINTFUL_API_KEY;
    const pfStoreId = process.env.PRINTFUL_STORE_ID;

    const pfRes = await fetch(printfulUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pfApiKey}`,
        'X-PF-Store-Id': pfStoreId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(printfulOrder)
    });

    const pfData = await pfRes.json();

    if (!pfRes.ok) {
      console.error('[webhook] Printful error:', pfData);
      // We still return 200 to Lemon Squeezy to prevent retries of a 'bad' order, 
      // but you should check Vercel logs.
      return res.status(200).json({ error: 'printful_error', details: pfData });
    }

    console.log(`[webhook] Success! Printful order created: ${pfData.result.id} (${pfData.result.status})`);
    return res.status(200).json({ ok: true, printful_order_id: pfData.result.id });

  } catch (err) {
    console.error('[webhook] Execution error:', err.message);
    return res.status(500).json({ error: 'internal_server_error' });
  }
}
