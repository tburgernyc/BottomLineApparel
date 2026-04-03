// api/subscribe.js
// Vercel serverless function — handles email list signups.
//
// Supports two flows:
//   1. "Inner Circle" newsletter (source: 'inner_circle') — email only
//   2. Product reservation (modal form) — email + name + size + product info
//
// Current integrations:
//   - Logs to Vercel console (always)
//   - Klaviyo API (when KLAVIYO_PRIVATE_KEY + KLAVIYO_LIST_ID are set)
//
// To add Mailchimp instead: set MAILCHIMP_API_KEY + MAILCHIMP_LIST_ID + MAILCHIMP_SERVER
// and uncomment the Mailchimp block below.

const ALLOWED_METHODS = ['POST'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * CORS + security headers shared by all responses.
 */
function commonHeaders(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

/**
 * POST to Klaviyo list via their v3 API.
 * Docs: https://developers.klaviyo.com/en/reference/subscribe_profiles
 */
async function addToKlaviyo({ email, name, source, size, product_name, product_id }) {
  const apiKey  = process.env.KLAVIYO_PRIVATE_KEY;
  const listId  = process.env.KLAVIYO_LIST_ID;

  if (!apiKey || !listId) return { skipped: true, reason: 'Klaviyo env vars not set' };

  const properties = { source };
  if (name)         properties.first_name   = name.trim();
  if (size)         properties.last_size     = size;
  if (product_name) properties.last_product  = product_name;
  if (product_id)   properties.last_product_id = String(product_id);

  const body = {
    data: {
      type: 'profile-subscription-bulk-create-job',
      attributes: {
        list_id: listId,
        subscriptions: [{
          channels: { email: ['MARKETING'] },
          email,
          profile: { data: { type: 'profile', attributes: properties } },
        }],
      },
    },
  };

  const res = await fetch('https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Accept':        'application/json',
      'revision':      '2024-02-15',
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 202) return { ok: true };
  const text = await res.text().catch(() => '');
  throw new Error(`Klaviyo ${res.status}: ${text.slice(0, 200)}`);
}

/*
// ── Mailchimp (alternative) ──
async function addToMailchimp({ email }) {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const listId = process.env.MAILCHIMP_LIST_ID;
  const server = process.env.MAILCHIMP_SERVER; // e.g. "us1"
  if (!apiKey || !listId || !server) return { skipped: true };

  const res = await fetch(`https://${server}.api.mailchimp.com/3.0/lists/${listId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
    },
    body: JSON.stringify({ email_address: email, status: 'subscribed' }),
  });
  if (res.status === 200 || res.status === 204) return { ok: true };
  const d = await res.json().catch(() => ({}));
  if (d.title === 'Member Exists') return { ok: true }; // idempotent
  throw new Error(`Mailchimp ${res.status}: ${d.detail || ''}`);
}
*/

export default async function handler(req, res) {
  commonHeaders(res);

  if (!ALLOWED_METHODS.includes(req.method)) {
    res.setHeader('Allow', ALLOWED_METHODS.join(', '));
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Parse body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'invalid_json' });
  }

  const { email, name, size, product_id, product_name, source = 'website' } = body || {};

  // Validate email
  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return res.status(422).json({ error: 'invalid_email' });
  }

  const cleanEmail = email.trim().toLowerCase();

  console.log(`[subscribe] email=${cleanEmail} source=${source} size=${size || '-'} product=${product_name || '-'}`);

  // Attempt Klaviyo integration (non-blocking — degrades gracefully)
  try {
    const result = await addToKlaviyo({
      email: cleanEmail,
      name,
      source,
      size,
      product_name,
      product_id,
    });

    if (result.skipped) {
      console.log(`[subscribe] Integration skipped: ${result.reason}`);
    } else {
      console.log(`[subscribe] Added to Klaviyo list`);
    }
  } catch (err) {
    // Log but don't fail the request — user experience > CRM reliability
    console.error('[subscribe] Klaviyo error (non-fatal):', err.message);
  }

  return res.status(200).json({ ok: true, message: "You're on the list. 💅" });
}
