# Bottom Line Apparel — Stripe + Printful Setup Runbook

Goal: get the site to a production-ready state where a visitor can build a cart, see a real shipping rate, pay via Stripe Checkout (with sales tax), and have the order land in Printful for fulfillment — with all four side-effects (Printful draft, KV order log, customer confirmation email, admin alerts on failure) wired up.

This runbook covers the manual dashboard work only you can do. The code side is done — `api/checkout.js` creates Stripe Checkout Sessions with Stripe Tax and the pre-calculated shipping rate, `api/stripe-webhook.js` fulfills via Printful + writes to Vercel KV + sends emails on `checkout.session.completed`, `api/shipping-rates.js` proxies Printful's `/shipping/rates`, and `api/products.js` returns Printful's catalog with full variant detail.

**Estimated time for a clean launch: 45–60 minutes (most of it waiting on Resend DNS propagation).**

## Production domain

The site lives at **`bottomlineapparel.store`**. All examples in this runbook use that domain. If you redeploy to a different one, update the references in:
- `scripts/prerender.mjs` — `SITE_URL`
- `scripts/schema.mjs` — `SITE_URL`
- `index.html` — OG, Twitter, canonical, JSON-LD `url` fields
- `api/checkout.js` — fallback in `baseUrl`
- `api/_email.js` — `SITE_URL`, `REPLY_TO`, `RESEND_FROM_EMAIL` default

## Required Vercel environment variables

Set all of these in Vercel Dashboard → Settings → Environment Variables for **Production** (tick Preview too if you want PR previews to function):

| Name | Source |
|---|---|
| `PRINTFUL_API_KEY` | https://www.printful.com/dashboard/store/api-key |
| `PRINTFUL_STORE_ID` | Printful dashboard URL (numeric) |
| `PRINTFUL_AUTO_CONFIRM` | Start `false`. Flip to `true` after a clean test order. |
| `STRIPE_SECRET_KEY` | https://dashboard.stripe.com/apikeys (use `sk_test_…` until launch, then `sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from Stripe Dashboard → Webhooks (different per mode) |
| `RESEND_API_KEY` | https://resend.com/api-keys (after verifying domain) |
| `RESEND_FROM_EMAIL` | `orders@bottomlineapparel.store` (or whichever verified sender) |
| `ADMIN_ALERT_EMAIL` | Your inbox — fulfillment failures land here |
| `KV_REST_API_URL` | Auto-injected when Vercel KV / Upstash Redis is connected to the project |
| `KV_REST_API_TOKEN` | Auto-injected |
| `KV_URL` | Auto-injected |
| `KV_REST_API_READ_ONLY_TOKEN` | Auto-injected |

Delete any leftover Lemon Squeezy vars (`LEMONSQUEEZY_*`, `PRINTFUL_FULFILL_VIA_WEBHOOK`) — they're unused.

---

## Step 1 — Stripe API keys + webhook (~5 min)

1. Sign in at https://dashboard.stripe.com and stay in **Test mode** for now (toggle in the top-right).
2. **Developers → API keys** → copy the test **Secret key** (`sk_test_…`). Add it to Vercel as `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://www.bottomlineapparel.store/api/stripe-webhook`
   - Events: `checkout.session.completed` (only — that's all the webhook handles)
4. After creating, reveal the **Signing secret** (`whsec_…`) and add it to Vercel as `STRIPE_WEBHOOK_SECRET`.

## Step 2 — Activate Stripe Tax (~5 min)

The checkout now creates sessions with `automatic_tax: { enabled: true }`. Stripe will reject session creation if Tax isn't activated — so this is mandatory.

1. **Settings → Tax**: click **Activate Stripe Tax**.
2. **Tax registrations**: add at minimum your home state (New York, presumably — Stripe will guide nexus monitoring elsewhere).
3. **Origin address**: Stripe needs an "origin" address for tax calculations — set to your business address.
4. **Product tax codes**: the code sends `txcd_30060003` (Clothing — General) on every line. If you sell hats/accessories that need different codes later, refine `APPAREL_TAX_CODE` in `api/checkout.js`.

Stripe Tax costs 0.5% per transaction. The customer sees a Sales Tax line in Stripe Checkout.

## Step 3 — Provision Vercel KV (~3 min)

Vercel KV migrated to Upstash Redis in late 2025. Either flavour works with `@vercel/kv`.

1. In Vercel Dashboard → your project → **Storage** tab → **Create Database**.
2. Pick **Redis** (Upstash) → choose region closest to your function deployments.
3. **Connect** it to the project. The four `KV_*` env vars auto-inject.
4. Redeploy so the function picks up the new env vars.

KV holds one record per Stripe session for 90 days. Schema is in `api/_orders.js`. If KV is unset, the webhook still works — it just skips the order log.

## Step 4 — Set up Resend (~10 min, mostly DNS propagation)

1. Sign up at https://resend.com (free tier = 3k emails/month — sufficient until ~100 orders/day).
2. **Domains → Add domain → `bottomlineapparel.store`**. Resend prints SPF, DKIM, DMARC records.
3. Paste those records into your DNS provider (Vercel DNS, Cloudflare, wherever the domain is managed). Wait 5–15 min for propagation, then click **Verify**.
4. **API Keys → Create API key** (Full access, or Sending-only if you prefer). Add to Vercel as `RESEND_API_KEY`.
5. Set `RESEND_FROM_EMAIL=orders@bottomlineapparel.store` and `ADMIN_ALERT_EMAIL=<your inbox>` in Vercel.

If Resend isn't configured, the webhook still works — order confirmation + admin alerts just no-op (logged as warnings).

## Step 5 — Push code + deploy (~2 min)

```bash
cd /mnt/c/Users/tburg/BottomLineApparel-main/BottomLineApparel-main
git add -A
git commit -m "Deployment-readiness: KV log, Resend, Stripe Tax, shipping rates"
git push
```

Vercel auto-deploys on push. Watch the deployment at vercel.com/dashboard.

> **Never commit `.env.local`.** It's already in `.gitignore`. Verify with `git status` before pushing.

## Step 6 — Smoke test the deployed APIs (~3 min)

```bash
# Products endpoint — should return the full Printful catalog
curl -s https://www.bottomlineapparel.store/api/products | jq 'to_entries | map({(.key): (.value | length)}) | add'

# Shipping rates — uses a sample NYC ZIP and a placeholder sync_variant_id (replace with a real one)
curl -s -X POST https://www.bottomlineapparel.store/api/shipping-rates \
  -H "Content-Type: application/json" \
  -d '{"country_code":"US","state_code":"NY","zip":"10001","line_items":[{"sync_variant_id":REAL_VARIANT_ID,"quantity":1}]}' | jq
```

If either returns `503 configuration_missing`, an env var didn't take — re-check Step 1.

## Step 7 — Place a test order (~5 min)

Stripe test mode supports fake card numbers. Stripe Tax also works in test mode.

1. Open https://www.bottomlineapparel.store in **incognito**.
2. Add an item to cart → open the cart drawer.
3. Enter ZIP `10001` (NY), get shipping rates, pick one. Verify the estimated total updates with the rate.
4. Click **Checkout** → redirected to Stripe Checkout.
5. Confirm Stripe shows: the line items, the shipping option you picked, a Sales Tax line.
6. Pay with test card:
   - Number: `4242 4242 4242 4242`
   - Expiry: any future date
   - CVC: any 3 digits
   - ZIP: any 5 digits matching the state
   - Email: a real inbox you can check
7. Complete the purchase. You'll be redirected to `/?order=success&session_id=...`.

## Step 8 — Verify all four side effects fired (~3 min)

**Stripe Dashboard → Payments**: the test payment appears. Click in and confirm metadata has `printful_items_json`.

**Printful → Orders**: a corresponding **Draft** order is created (status "Draft" because `PRINTFUL_AUTO_CONFIRM=false`). Confirm correct variants + correct shipping address.

**Vercel KV**: look up the order via Vercel CLI or Upstash console:
```
GET orders:cs_test_<session_id>
```
Should return a JSON record with `status: "fulfilled"`, an `email_log` entry, and a fulfillment_attempts entry with `ok: true`.

**Inbox**: a branded order confirmation email arrives at the email you used for the test order. Stripe's auto-receipt arrives separately.

**Vercel → Functions → `api/stripe-webhook` logs**: should show lines like:
```
[stripe-webhook] event=checkout.session.completed id=evt_...
[stripe-webhook] session=cs_test_...
[stripe-webhook] Creating Printful order: lines=1 qty=1 auto-confirm=false ext=...
[stripe-webhook] Printful order created: 12345678 (draft)
```

If a step fails, see Troubleshooting below.

## Step 9 — Go live (~10 min)

Once Step 8 passes end-to-end:

1. **Live Stripe key**: toggle Stripe out of Test mode → copy `sk_live_…` from Developers → API keys → update `STRIPE_SECRET_KEY` in Vercel.
2. **Live webhook**: in Stripe (live mode), Developers → Webhooks → Add endpoint with URL `https://www.bottomlineapparel.store/api/stripe-webhook` and event `checkout.session.completed`. Copy the **new** signing secret (live ≠ test) and update `STRIPE_WEBHOOK_SECRET` in Vercel.
3. **Activate your Stripe account** if you haven't yet (Stripe will prompt for business identity verification before allowing live payouts).
4. **Apple Pay domain verification** (optional but recommended): Stripe → Settings → Payment methods → Apple Pay → Add domain → `bottomlineapparel.store`. Stripe gives a verification file to host at `/.well-known/apple-developer-merchantid-domain-association`. Without this, Apple Pay won't appear at checkout (cards/Google Pay still work).
5. **Real test order**: buy your cheapest product with a real card. Verify Printful draft order looks correct.
6. **Flip auto-confirm**: once the test order ships fine, set `PRINTFUL_AUTO_CONFIRM=true` in Vercel and redeploy. From then on, paid orders submit to fulfillment automatically (faster shipping, better repeat-buy signal).

## Step 10 — Pre-launch analytics IDs

Currently the site has placeholder analytics IDs in `index.html`:

```js
window.BLA_GA_ID  = 'G-XXXXXXXXXX';  // GA4 Measurement ID
window.BLA_TTQ_ID = '';              // TikTok Pixel ID
window.BLA_META_ID = '';             // Meta Pixel ID
```

While these stay as placeholders the analytics module **no-ops** — no events fire to any channel. To enable tracking, paste real IDs in `index.html:677–680` and redeploy.

- GA4: https://analytics.google.com → Admin → Data Streams → Measurement ID
- Meta: https://business.facebook.com → Events Manager → Pixel ID
- TikTok: https://ads.tiktok.com → Assets → Events → Pixel ID

Once IDs are real, the consent-gated `track.*` events (view_item, add_to_cart, begin_checkout, purchase, etc.) fire automatically — they're already wired in `src/analytics/analytics.ts`.

---

## Troubleshooting

**`/api/products` returns `configuration_missing`**
PRINTFUL_API_KEY not set in Vercel.

**`/api/shipping-rates` returns `invalid_address`**
Printful didn't find a rate for that ZIP/country combo. Most common cause: wrong country code or invalid state code for US/CA.

**`/api/checkout` returns 502 `variant_lookup_failed`**
Printful API key invalid or rate limited. Check Vercel function logs.

**Stripe Checkout returns "Cannot enable automatic_tax without an active Stripe Tax integration"**
Stripe Tax isn't activated → Step 2.

**Stripe webhook returns 400 `invalid_signature`**
`STRIPE_WEBHOOK_SECRET` doesn't match the secret on the Stripe webhook endpoint → Steps 1 + 3. Test-mode and live-mode webhooks have different signing secrets.

**Webhook fires but no order confirmation email arrives**
- `RESEND_API_KEY` not set, OR
- Resend domain not verified, OR
- Customer email blocked your Resend sender (check Resend's dashboard → Logs)

The webhook **always returns 200 on email failures** — Stripe will not retry. Customers always get Stripe's auto-receipt regardless.

**Admin alert email never arrives even though Printful order failed**
Check `ADMIN_ALERT_EMAIL` is set in Vercel. Then check Vercel function logs for `[_email] sendAdminAlert failed`.

**KV order log empty**
`KV_REST_API_URL` / `KV_REST_API_TOKEN` not set — Step 3. The webhook degrades to no-op for KV writes so this won't fail Printful fulfillment.

**Webhook fires but Printful never receives the order**
Check Vercel function logs for `[stripe-webhook] Fulfillment failed`. Common causes:
- `metadata_missing_items`: the Stripe Checkout Session was created without the right metadata. Should only happen if something other than `/api/checkout` created the session.
- `no_shipping_address`: shipping address collection disabled in the Stripe session config. Re-check `api/checkout.js`.
- `Printful 404`: `sync_variant_id` no longer exists in Printful (variant was deleted between session creation and webhook). Refund the Stripe charge; admin alert fires for this case.

---

## Pre-launch checklist

Tick each before flipping DNS to point `bottomlineapparel.store` at Vercel:

- [ ] Stripe live keys + live webhook configured (Step 9)
- [ ] Stripe Tax activated + home state registered + origin address set (Step 2)
- [ ] Vercel KV / Upstash Redis provisioned (Step 3)
- [ ] Resend domain verified + API key in Vercel (Step 4)
- [ ] Real GA4 + Meta + TikTok pixel IDs pasted in `index.html` (Step 10)
- [ ] One real test order completes cleanly with all four side effects (Step 8)
- [ ] `PRINTFUL_AUTO_CONFIRM` flipped to `true` after that test order ships (Step 9.6)
- [ ] Apple Pay domain verification file uploaded (Step 9.4) — optional but recommended
- [ ] DNS for `bottomlineapparel.store` pointed at Vercel + custom domain attached in project settings

## What stays automated

- **New Printful products** show up on the site automatically — `api/products.js` reads live from Printful (10 min cache).
- **Price updates** in Printful flow to the site immediately (subject to cache).
- **Disabled variants** are dropped from the picker.
- **Sales tax** is calculated by Stripe per the customer's shipping address.
- **Shipping rates** are computed real-time from Printful using the customer's ZIP/country before they hit Stripe Checkout.
- **Order tracking** lives in Stripe (customer notifications), Printful (fulfillment status), and Vercel KV (your operational log).

## Out of scope for now (suggested follow-ups)

- **Abandoned checkout recovery**: hook `checkout.session.expired` events into Klaviyo/Resend to recover lost carts.
- **Cross-sell on success page**: dedicated success page with order summary + cross-sell, replacing the current `?order=success` toast.
- **UGC pipeline**: replace the manual lookbook section with Foursixty/Tagshop pulling tagged Instagram posts.
- **Customer order lookup page**: surface KV records to logged-in customers via a `/orders` route (would require auth — currently guest-only).
- **Multi-currency**: extend to GBP/AUD for non-US shoppers (currently USD-only with country-restricted shipping).
