// api/_email.js
// Resend client + branded email templates.
//
// Two surfaces:
//  - sendAdminAlert(...)        Internal alert when post-payment fulfillment fails.
//  - sendOrderConfirmation(...) Customer-facing branded confirmation, sent in
//                               addition to Stripe's automatic receipt.
//
// Both degrade to no-ops (with a warn log) when RESEND_API_KEY is unset, so
// local development without Resend doesn't fail the webhook.

import { Resend } from 'resend';

const BRAND_NAME = 'Bottom Line Apparel';
const SITE_URL = 'https://www.bottomlineapparel.store';
const REPLY_TO = 't.burgernyc@gmail.com';

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function fromAddress() {
  const addr = process.env.RESEND_FROM_EMAIL || 'orders@info.bottomlineapparel.store';
  return `${BRAND_NAME} <${addr}>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(cents, currency = 'USD') {
  const n = Number(cents) / 100;
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export async function sendAdminAlert({ subject, sessionId, customerEmail, items, error, details }) {
  const r = client();
  if (!r) {
    console.warn('[_email] RESEND_API_KEY not set — admin alert skipped');
    return { ok: false, skipped: true };
  }
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) {
    console.warn('[_email] ADMIN_ALERT_EMAIL not set — admin alert skipped');
    return { ok: false, skipped: true };
  }

  const itemLines = (items || [])
    .map(i => `  • sync_variant_id=${i.sync_variant_id}  qty=${i.quantity}`)
    .join('\n');

  const body = [
    `A Stripe-paid order failed to create a Printful order. Customer has been charged.`,
    ``,
    `Stripe session: ${sessionId}`,
    `Customer email: ${customerEmail || '(unknown)'}`,
    ``,
    `Items:`,
    itemLines || '  (no items in metadata)',
    ``,
    `Error: ${error}`,
    details ? `Details: ${typeof details === 'string' ? details : JSON.stringify(details, null, 2)}` : '',
    ``,
    `Next steps:`,
    `1. Open https://dashboard.stripe.com/payments → search for the session ID above.`,
    `2. Open https://www.printful.com/dashboard/orders → check if a partial draft exists for this customer.`,
    `3. If no Printful order exists, manually create one from the dashboard with the items + shipping details from Stripe.`,
    `4. If the customer needs to be refunded instead, refund directly from the Stripe dashboard.`,
  ].filter(Boolean).join('\n');

  try {
    const result = await r.emails.send({
      from: fromAddress(),
      to: [to],
      subject: subject || `[BLA] Fulfillment failed — ${sessionId}`,
      text: body,
      replyTo: REPLY_TO,
    });
    return { ok: true, id: result?.data?.id || null };
  } catch (err) {
    console.error('[_email] sendAdminAlert failed:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

function renderItemRow(item) {
  const line = (Number(item.unit_price_cents) * item.quantity) / 100;
  return `
    <tr>
      <td style="padding:12px 0; border-bottom:1px solid #ececec; vertical-align:top;">
        <div style="font-family:'DM Sans',Arial,sans-serif; font-size:15px; color:#111; font-weight:600;">${escapeHtml(item.title)}</div>
        ${item.variant_label ? `<div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; color:#666; margin-top:4px;">${escapeHtml(item.variant_label)}</div>` : ''}
        <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; color:#666; margin-top:4px;">Qty ${item.quantity}</div>
      </td>
      <td style="padding:12px 0; border-bottom:1px solid #ececec; text-align:right; vertical-align:top; font-family:'DM Sans',Arial,sans-serif; font-size:15px; color:#111;">
        ${formatMoney(line * 100)}
      </td>
    </tr>
  `;
}

function renderConfirmationHtml({ orderNumber, items, totals, shipping, currency }) {
  const itemRows = items.map(renderItemRow).join('');
  const ship = shipping || {};
  const addressBlock = [
    ship.name,
    ship.line1,
    ship.line2,
    [ship.city, ship.state, ship.postal_code].filter(Boolean).join(', '),
    ship.country,
  ].filter(Boolean).map(escapeHtml).join('<br />');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Order Confirmation — Bottom Line Apparel</title>
</head>
<body style="margin:0; padding:0; background:#f7f4ef; font-family:'DM Sans',Arial,sans-serif;">
  <div style="max-width:560px; margin:0 auto; padding:32px 16px;">
    <div style="background:#fff; padding:32px; border:1px solid #ececec;">
      <h1 style="font-family:'Cormorant Garamond',Georgia,serif; font-size:32px; font-weight:500; color:#111; margin:0 0 8px;">
        Thanks for your order.
      </h1>
      <p style="font-family:'DM Sans',Arial,sans-serif; font-size:15px; color:#555; line-height:1.5; margin:0 0 24px;">
        We've got it. You'll get a separate shipping notification with tracking once your order leaves the print shop — usually <strong>2–5 business days</strong> for production, then 3–8 days in transit.
      </p>

      ${orderNumber ? `<p style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; color:#666; margin:0 0 24px;">Order reference: <strong style="color:#111;">${escapeHtml(orderNumber)}</strong></p>` : ''}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${itemRows}
        <tr>
          <td style="padding:16px 0 4px; font-family:'DM Sans',Arial,sans-serif; font-size:14px; color:#666;">Subtotal</td>
          <td style="padding:16px 0 4px; text-align:right; font-family:'DM Sans',Arial,sans-serif; font-size:14px; color:#666;">${formatMoney(totals.subtotal_cents, currency)}</td>
        </tr>
        ${totals.shipping_cents != null ? `
        <tr>
          <td style="padding:4px 0; font-family:'DM Sans',Arial,sans-serif; font-size:14px; color:#666;">Shipping${totals.shipping_label ? ` <span style="color:#999;">(${escapeHtml(totals.shipping_label)})</span>` : ''}</td>
          <td style="padding:4px 0; text-align:right; font-family:'DM Sans',Arial,sans-serif; font-size:14px; color:#666;">${totals.shipping_cents === 0 ? 'Free' : formatMoney(totals.shipping_cents, currency)}</td>
        </tr>` : ''}
        ${totals.tax_cents != null ? `
        <tr>
          <td style="padding:4px 0; font-family:'DM Sans',Arial,sans-serif; font-size:14px; color:#666;">Tax</td>
          <td style="padding:4px 0; text-align:right; font-family:'DM Sans',Arial,sans-serif; font-size:14px; color:#666;">${formatMoney(totals.tax_cents, currency)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:12px 0 0; border-top:1px solid #ececec; font-family:'DM Sans',Arial,sans-serif; font-size:16px; color:#111; font-weight:600;">Total</td>
          <td style="padding:12px 0 0; border-top:1px solid #ececec; text-align:right; font-family:'DM Sans',Arial,sans-serif; font-size:16px; color:#111; font-weight:600;">${formatMoney(totals.total_cents, currency)}</td>
        </tr>
      </table>

      ${addressBlock ? `
      <div style="margin-top:32px; padding-top:24px; border-top:1px solid #ececec;">
        <p style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; color:#999; text-transform:uppercase; letter-spacing:0.08em; margin:0 0 8px;">Shipping to</p>
        <p style="font-family:'DM Sans',Arial,sans-serif; font-size:14px; color:#111; line-height:1.5; margin:0;">${addressBlock}</p>
      </div>` : ''}

      <div style="margin-top:32px; padding-top:24px; border-top:1px solid #ececec;">
        <p style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; color:#666; line-height:1.5; margin:0 0 8px;">
          Questions, sizing exchange, or anything else? Just reply to this email — it goes straight to us.
        </p>
        <p style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; color:#666; line-height:1.5; margin:0;">
          Returns: 30 days from delivery on unworn items. <a href="${SITE_URL}/shipping-returns/" style="color:#111;">Details here</a>.
        </p>
      </div>
    </div>

    <p style="font-family:'DM Sans',Arial,sans-serif; font-size:12px; color:#999; text-align:center; margin:24px 0 0;">
      ${BRAND_NAME} · NYC · <a href="${SITE_URL}" style="color:#999; text-decoration:underline;">${SITE_URL.replace('https://www.','')}</a>
    </p>
  </div>
</body>
</html>`;
}

function renderConfirmationText({ orderNumber, items, totals, shipping, currency }) {
  const lines = [];
  lines.push('Thanks for your order.');
  lines.push('');
  lines.push("We've got it. You'll get a shipping notification with tracking once your order leaves the print shop — usually 2-5 business days production, then 3-8 days in transit.");
  lines.push('');
  if (orderNumber) lines.push(`Order reference: ${orderNumber}`);
  lines.push('');
  lines.push('Items:');
  for (const item of items) {
    const sub = (Number(item.unit_price_cents) * item.quantity) / 100;
    lines.push(`  - ${item.title}${item.variant_label ? ` (${item.variant_label})` : ''} x${item.quantity} — ${formatMoney(sub * 100, currency)}`);
  }
  lines.push('');
  lines.push(`Subtotal: ${formatMoney(totals.subtotal_cents, currency)}`);
  if (totals.shipping_cents != null) {
    lines.push(`Shipping${totals.shipping_label ? ` (${totals.shipping_label})` : ''}: ${totals.shipping_cents === 0 ? 'Free' : formatMoney(totals.shipping_cents, currency)}`);
  }
  if (totals.tax_cents != null) lines.push(`Tax: ${formatMoney(totals.tax_cents, currency)}`);
  lines.push(`Total: ${formatMoney(totals.total_cents, currency)}`);
  if (shipping?.line1) {
    lines.push('');
    lines.push('Shipping to:');
    [shipping.name, shipping.line1, shipping.line2, [shipping.city, shipping.state, shipping.postal_code].filter(Boolean).join(', '), shipping.country]
      .filter(Boolean).forEach(l => lines.push(`  ${l}`));
  }
  lines.push('');
  lines.push('Questions or exchange? Reply to this email — it goes straight to us.');
  lines.push(`Returns: 30 days from delivery on unworn items. ${SITE_URL}/shipping-returns/`);
  lines.push('');
  lines.push(`${BRAND_NAME} — NYC — ${SITE_URL}`);
  return lines.join('\n');
}

export async function sendOrderConfirmation(to, payload) {
  const r = client();
  if (!r) {
    console.warn('[_email] RESEND_API_KEY not set — order confirmation skipped');
    return { ok: false, skipped: true };
  }
  if (!to) {
    return { ok: false, error: 'no_customer_email' };
  }
  try {
    const result = await r.emails.send({
      from: fromAddress(),
      to: [to],
      subject: `Your ${BRAND_NAME} order is confirmed`,
      html: renderConfirmationHtml(payload),
      text: renderConfirmationText(payload),
      replyTo: REPLY_TO,
    });
    return { ok: true, id: result?.data?.id || null };
  } catch (err) {
    console.error('[_email] sendOrderConfirmation failed:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}
