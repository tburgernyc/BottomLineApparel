# Bottom Line Apparel — Stripe + Printful Setup Runbook

Goal: get the site to a working state where a visitor can pick a variant, pay via Stripe Checkout, and have the order land in Printful for fulfillment.

This runbook covers the manual dashboard work only you can do. The code side is done — `api/checkout.js` creates Stripe Checkout Sessions, `api/stripe-webhook.js` fulfills via Printful on `checkout.session.completed`, and `api/products.js` returns Printful's catalog with full variant detail.

**Estimated time: 15–20 minutes.**

## Inventory of what's already in place

- ✅ Stripe account (`t.burgerNYC@gmail.com`)
- ✅ Printful API key (rotated) — fetches 26 products
- ✅ Vercel project deployed at `bottom-line-apparel-1p4z.vercel.app`
- ❌ Stripe API keys not yet in Vercel
- ❌ Stripe webhook endpoint not yet created
- ❌ `LEMONSQUEEZY_*` env vars still in Vercel (delete them)

## Step 1 — Get your Stripe API key (~2 min)

1. Sign in at https://dashboard.stripe.com
2. Confirm you're in **test mode** (toggle in the top-right says "Test mode" / orange banner). All work in this runbook happens in test mode until Step 7.
3. Go to **Developers → API keys**: https://dashboard.stripe.com/test/apikeys
4. Copy the **Secret key** (`sk_test_…`). Save it somewhere private — you'll paste it into Vercel in Step 3.

## Step 2 — Create the webhook endpoint (~3 min)

1. Go to **Developers → Webhooks**: https://dashboard.stripe.com/test/webhooks
2. Click **Add endpoint**.
3. **Endpoint URL:** `https://bottom-line-apparel-1p4z.vercel.app/api/stripe-webhook`
4. **Events to send:** click "Select events", search for and check:
   - `checkout.session.completed`
   (That's the only event needed for v1. You can add more later — `charge.refunded`, `payment_intent.payment_failed`, etc.)
5. Click **Add endpoint**.
6. On the new endpoint's page, find the **Signing secret** section, click **Reveal**, copy the `whsec_…` value. Save it privately for Step 3.

## Step 3 — Set Vercel environment variables (~5 min)

Go to https://vercel.com/dashboard → `bottom-line-apparel-1p4z` → **Settings → Environment Variables**.

Add or update for **Production** (and tick "Preview" if you want PR previews to work too):

| Name | Value | Notes |
|---|---|---|
| `PRINTFUL_API_KEY` | (your rotated Printful key) | Already set if you did Step 0 of the prior runbook |
| `PRINTFUL_STORE_ID` | (your Printful store id) | Already set |
| `PRINTFUL_AUTO_CONFIRM` | `false` | Keep false until your test order works |
| `STRIPE_SECRET_KEY` | `sk_test_…` from Step 1 | |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from Step 2 | |

**Delete** these stale Lemon Squeezy variables (they have no purpose now):
- `LEMONSQUEEZY_API_KEY`
- `LEMONSQUEEZY_STORE_ID`
- `LEMONSQUEEZY_WEBHOOK_SECRET`
- `PRINTFUL_FULFILL_VIA_WEBHOOK` (no longer used; webhook now always fulfills)

After saving, trigger a redeploy: **Deployments** tab → latest deployment → ⋯ → **Redeploy**.

## Step 4 — Push the latest code to GitHub (~2 min)

The new code in this folder isn't on GitHub yet. From your machine:

```bash
cd /mnt/c/Users/tburg/BottomLineApparel-main/BottomLineApparel-main
git init                                   # if not already a repo
git remote add origin https://github.com/tburgernyc/BottomLineApparel.git  # if not set
git add .
git commit -m "Replace Lemon Squeezy with Stripe Checkout + Printful API webhook"
git push -u origin main
```

Vercel auto-deploys on push. Watch the deploy at https://vercel.com/dashboard → Deployments.

> **Don't commit `.env.local`.** It's in `.gitignore` so this should be safe automatically — but verify with `git status` before pushing that `.env.local` is **not** in the staged files.

## Step 5 — Smoke test the live API (~3 min)

```bash
curl -s https://bottom-line-apparel-1p4z.vercel.app/api/products | jq 'to_entries | map({(.key): (.value | length)}) | add'
```

Expected: all 9 categories with the counts `5/5/4/4/1/2/1/2/2 = 26` (or whatever your current Printful catalog reports).

```bash
curl -s https://bottom-line-apparel-1p4z.vercel.app/api/products | jq '.tshirts[0].variants[0]'
```

Expected: a variant object like `{ "id": 12345678, "label": "Black / S", "color": "Black", "size": "S", "price": 28, "image": "...", "sku": "..." }`.

If you get a `503 configuration_missing` error, the Vercel env vars didn't take — re-check Step 3 and redeploy.

## Step 6 — Place a test order (~5 min)

Stripe test mode supports fake card numbers. The webhook is also in test mode (because you copied a `sk_test_…` key in Step 1).

1. Open https://bottom-line-apparel-1p4z.vercel.app in incognito.
2. Click any product. The modal opens with the variant picker (color and/or size based on what Printful has for that product).
3. Pick a variant, hit **Buy Now →**. You'll redirect to Stripe's hosted checkout page.
4. Use a test card:
   - Number: `4242 4242 4242 4242`
   - Expiry: any future date
   - CVC: any 3 digits
   - ZIP: any 5 digits
   - Email: a real email you can check
   - Shipping address: any valid US address (Printful test mode requires one that geocodes)
5. Complete the purchase. You'll be redirected back to the homepage with `?order=success` in the URL and a "Order placed!" toast.

## Step 7 — Verify the order (~3 min)

**In Stripe Dashboard → Payments** (https://dashboard.stripe.com/test/payments): the test payment shows up here. Click in and confirm the metadata includes `printful_sync_variant_id` and `printful_quantity`.

**In Printful → Orders** (https://www.printful.com/dashboard/orders): a corresponding **Draft** order is created automatically by `api/stripe-webhook.js`. Click in and confirm:
- Right product variant (size/color)
- Right shipping address
- Status is "Draft" (not yet submitted to fulfillment, because `PRINTFUL_AUTO_CONFIRM=false`)

**In Vercel → your project → Functions → `api/stripe-webhook`** logs you should see lines like:
```
[stripe-webhook] event=checkout.session.completed id=evt_…
[stripe-webhook] session=cs_test_… email=…
[stripe-webhook] Creating Printful order: variant=… qty=1 auto-confirm=false
[stripe-webhook] Printful order created: 12345678 (draft)
```

That confirms our webhook received the event, verified the signature, and created the Printful draft. 🎉

If you see `[stripe-webhook] Signature verification failed`, the `STRIPE_WEBHOOK_SECRET` env var doesn't match the secret on Stripe's side — re-copy it from Step 2 and redeploy.

## Step 8 — Go live (~5 min)

Once Step 7 passes:

1. **Live API key.** In Stripe, toggle off Test mode. Go to https://dashboard.stripe.com/apikeys → copy the **live** Secret key (`sk_live_…`). Update `STRIPE_SECRET_KEY` in Vercel to the live value.
2. **Live webhook endpoint.** In Stripe Dashboard (live mode now), Developers → Webhooks → Add endpoint with the same URL (`https://bottom-line-apparel-1p4z.vercel.app/api/stripe-webhook`) and the same `checkout.session.completed` event. Copy its **new** signing secret (`whsec_…`) — it is different from the test secret. Update `STRIPE_WEBHOOK_SECRET` in Vercel.
3. **Activate your Stripe account** if you haven't yet (Stripe will prompt for tax/business info before live transactions are allowed).
4. **Apple Pay domain verification** (optional but recommended). In Stripe Dashboard → Settings → Payment methods → Apple Pay → Add domain → `bottom-line-apparel-1p4z.vercel.app`. Stripe gives you a verification file to host at `/.well-known/apple-developer-merchantid-domain-association`. Until this is done, Apple Pay simply won't appear at checkout — Stripe falls back to cards/Google Pay.
5. **Auto-confirm Printful drafts** (optional). Once you've watched a couple of test/live orders flow correctly, set `PRINTFUL_AUTO_CONFIRM=true` in Vercel. Printful drafts then submit to fulfillment automatically.
6. **Place a real order.** Buy your cheapest item with a real card. After it ships, you're live.

## Troubleshooting

**`/api/products` returns `configuration_missing`**
- `PRINTFUL_API_KEY` not set in Vercel → Step 3.

**`/api/checkout` returns 502 `variant_lookup_failed`**
- Printful API key invalid or rate limited. Check Vercel function logs.

**Stripe webhook returns 400 `invalid_signature`**
- `STRIPE_WEBHOOK_SECRET` in Vercel doesn't match the secret on the Stripe webhook endpoint → Step 2 + Step 3. Test-mode and live-mode webhooks have **different** signing secrets.

**Stripe webhook returns 503 `configuration_missing`**
- `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` env var not set → Step 3.

**Webhook fires but Printful never receives the order**
- Look at Vercel function logs for `[stripe-webhook] Fulfillment failed`. Most common causes:
  - `metadata_missing_variant_id`: the Stripe Checkout Session was created without the right metadata. This shouldn't happen via `/api/checkout` — investigate if you're creating sessions via another path.
  - `no_shipping_address`: you disabled shipping address collection in Stripe. Re-enable.
  - `Printful 404`: the `sync_variant_id` no longer exists in Printful (variant was deleted between session creation and webhook). Refund the Stripe charge manually.

## What stays automated

- **New Printful products** show up on the site automatically — `api/products.js` always reads live from Printful.
- **Price updates** in Printful flow to the site immediately (with up to 10 min cache).
- **Disabled variants** in Printful are dropped from the picker.
- **Order tracking** lives in Stripe (customer notifications) and Printful (fulfillment status).

## Out of scope for now (suggested follow-ups)

- **Cart / multi-item checkout.** Stripe Checkout supports multi-line items; needs frontend cart state.
- **Stripe Tax.** Turn it on once volume justifies ($120/yr or % per txn) — auto-handles US sales tax.
- **Order success page.** Currently we redirect to `/?order=success` and show a toast. A dedicated page with order summary is a UX win.
- **Klaviyo cart abandonment.** Hook up `checkout.session.expired` events to Klaviyo flows.
