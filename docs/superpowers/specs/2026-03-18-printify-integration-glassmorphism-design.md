# Bottom Line Apparel — Institutional Upgrade & Printify Integration

**Date:** 2026-03-18
**Status:** Approved
**Scope:** Quality upgrade + live Printify product integration + full glassmorphism redesign

---

## Overview

Upgrade the existing vanilla HTML/CSS/JS Bottom Line Apparel marketing site to institutional quality. Replace hardcoded product data with live products fetched from the Printify API via a Vercel serverless function. Redesign the visual layer with a dark glassmorphism theme. All product purchases route to TikTok Shop.

---

## Goals

1. Display live products from Printify (auto-updated when Printify catalog changes)
2. Secure the Printify API key server-side (never exposed to the browser)
3. Apply a cohesive dark glassmorphism visual theme throughout
4. Fix all institutional quality gaps: SEO, accessibility, performance, security, code quality
5. Add an Accessories section (separate from tees) to support future catalog expansion

---

## Non-Goals

- No shopping cart or on-site checkout (purchases happen on TikTok Shop)
- No CMS or product management UI
- No framework migration (stay vanilla HTML/CSS/JS + Vercel Functions)
- No blog or editorial content
- No `robots.txt` or `sitemap.xml` (intentionally deferred — site is single-page, no crawlable deep links)

---

## Architecture

```
bottomlineapparel/
├── api/
│   └── products.js        ← Vercel serverless function (Printify proxy)
├── index.html             ← Updated: SEO, OG tags, product placeholders, Accessories section
├── script.js              ← Updated: live product rendering, skeletons, bug fixes
├── styles.css             ← Updated: full glassmorphism theme, DM Sans, skeleton loaders
├── vercel.json            ← New: security headers, CSP, routing
└── .env.example           ← New: documents required env vars
```

### Data Flow

1. Browser loads page → product grid shows animated skeleton placeholders
2. `script.js` calls `GET /api/products`
3. Vercel Function reads `PRINTIFY_SHOP_ID` from env, fetches `https://api.printify.com/v1/shops/{PRINTIFY_SHOP_ID}/products.json` server-side (never hardcoded)
4. Response cached at Vercel edge for 5 minutes (`Cache-Control: s-maxage=300`)
5. Function returns structured JSON split into `tees` and `accessories` arrays
6. `script.js` renders product cards with real data into the DOM
7. Cards with no TikTok Shop link show a "Coming Soon" badge instead of a buy button

---

## API Function — `/api/products.js`

**Environment variables required:**
- `PRINTIFY_API_KEY` — Printify JWT token (stored as Vercel secret, never committed)
- `PRINTIFY_SHOP_ID` — `26847487` (TikTok shop)

**Response shape:**
```json
{
  "tees": [
    {
      "id": "69ba7c438d05d85a150dda59",
      "title": "Bottom Line \"Push Out For Clout\" Tee – Do It for the Tops",
      "short_description": "First sentence of description, HTML stripped.",
      "price": 24.69,
      "image": "https://images.printify.com/mockup/...",
      "tiktok_url": "https://www.tiktok.com/view/product/1732296059243040901"
    }
  ],
  "accessories": [
    {
      "id": "69ba606c34837e7e1506c312",
      "title": "HO LIFE IS THE GO LIFE sticker",
      "short_description": "...",
      "price": 4.99,
      "image": "https://images.printify.com/mockup/...",
      "tiktok_url": null
    }
  ]
}
```

**Classification logic:** Products are classified by a Printify tag applied in the Printify dashboard:
- Tag `tee` → classified as a tee
- Tag `accessory` → classified as an accessory
- No matching tag → price fallback: lowest enabled variant price ≤ 1000 cents ($10.00) → accessory, otherwise → tee

**Price handling:** Printify API returns prices as integers in cents (e.g., `2469` = $24.69). The function converts to a float: `price / 100`. The lowest enabled variant is determined by finding the minimum `price` value among all `variants` where `is_enabled === true`. If a product has no enabled variants, it is excluded from the response entirely.

**Partial failure handling:**
- Printify unreachable → return HTTP 503 `{ "error": "unavailable" }`
- Printify returns empty `data` array → return HTTP 200 `{ "tees": [], "accessories": [] }` (valid empty state)
- Malformed JSON from Printify → return HTTP 503 `{ "error": "unavailable" }`
- Product has no enabled variants → skip product (exclude from response)
- Product has no mockup images → exclude from response (don't render an imageless card)

Frontend behavior on HTTP 503 or network error: clear skeletons, show fallback message. On empty arrays: hide that section's heading and grid (don't show an empty section).

---

## Frontend — `index.html`

### SEO & Meta
- `<html lang="en">`
- `<meta name="description">` — existing, verified
- Open Graph tags: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`
- Twitter Card tags: `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- Schema.org `Organization` JSON-LD block

### Structure Changes
- Products section: replace 4 hardcoded `.product-card` elements with `<div id="products-grid"></div>`
- Add Accessories section after products:
  ```html
  <section id="accessories" class="accessories-section">
    <h2>Accessories</h2>
    <div id="accessories-grid"></div>
  </section>
  ```
- Accessories section designed to scale — future items drop in automatically from the API

---

## Frontend — `script.js`

### Product Rendering
- On `DOMContentLoaded`: inject 3 skeleton cards into `#products-grid`, 2 into `#accessories-grid` (fixed defaults — not tied to current catalog size, designed to look natural while loading)
- Fetch `/api/products`
- On success: clear skeletons, render real cards; if either array is empty, hide that section's `<section>` element entirely
- On error (network or 503): clear skeletons, show fallback message in both grids: *"Shop is temporarily unavailable — check back soon."*

### Product Card Template
```html
<article class="product-card">
  <div class="product-image">
    <img src="{image}" alt="{title}" loading="lazy" width="600" height="600">
  </div>
  <div class="product-info">
    <h3>{title}</h3>
    <p>{short_description}</p>
    <span class="price">${price}</span>
    <a href="{tiktok_url}" class="btn-primary" target="_blank" rel="noopener noreferrer">
      Shop on TikTok
    </a>
    <!-- OR if tiktok_url is null: -->
    <span class="badge-coming-soon">Coming Soon</span>
  </div>
</article>
```

### Bug Fixes
- Mobile nav: add `Escape` key listener to close menu and return focus to hamburger button
- Carousel arrow key listener: scope to carousel element only, not `document`
- Wrap all DOM operations in `try/catch` with console error logging
- Add `loading="lazy"` to all images not in the initial viewport

---

## Visual Design — Glassmorphism Theme

### Design Direction
Dark glassmorphism: frosted dark glass panels floating over animated neon gradient blobs. Retains the brand's existing neon color palette and Oswald display typography. Body font upgraded from Inter to DM Sans.

### Color System (CSS variables)
```css
--color-bg: #0d0d0d;
--color-surface: rgba(255, 255, 255, 0.05);
--color-surface-warm: rgba(255, 45, 135, 0.05);
--color-border: rgba(255, 255, 255, 0.08);
--color-border-accent: rgba(255, 45, 135, 0.3);
--color-pink: #ff2d87;
--color-blue: #2df4ff;
--color-green: #b5ff2d;
--color-text: #f0f0f0;
--color-text-muted: #888;
/* Blur variables hold full filter function values (intentional).
   Use as: backdrop-filter: var(--blur-glass).
   Cannot be composed arithmetically — create new variables if intermediate values needed. */
--blur-glass: blur(20px);
--blur-nav: blur(24px);
```

### Background
- Full-page animated gradient blobs (`position: fixed`, `z-index: -1`, `pointer-events: none`)
- 3 blobs: pink, blue, green — slow drift animation (~20s loop, staggered)
- Blob opacity: ~0.15 so they're atmospheric, not distracting
- `@media (prefers-reduced-motion: reduce)`: blobs rendered as static (no animation), `animation: none`

### Component Styles

**Navigation (sticky):**
- `backdrop-filter: var(--blur-nav)`
- `background: rgba(13,13,13,0.6)`
- On scroll: increases to `rgba(13,13,13,0.85)`
- Bottom border: `1px solid var(--color-border)`

**Product & Accessory Cards:**
- `background: var(--color-surface)`
- `backdrop-filter: var(--blur-glass)`
- `border: 1px solid var(--color-border)`
- `border-radius: 16px`
- Hover: glow ring via `box-shadow`, neon color rotates per card (pink / blue / green cycle)

**Hero text block:**
- Frosted glass card over the video background
- `background: rgba(13,13,13,0.4)`, `backdrop-filter: blur(16px)`

**Buttons:**
- Glass pill: transparent background, neon gradient border via `::before` pseudo-element with `border-radius` matching the button (NOT `border-image` — incompatible with `border-radius`)
- Technique: `::before` positioned absolutely behind button, `padding: 1px`, gradient background, same `border-radius`, `-z-index` to sit behind content
- Inner glow on hover via `box-shadow`
- No solid fills

**Accessories section:**
- Same card grid pattern as tees
- Glass tint: `var(--color-surface-warm)` — subtle pink warmth to distinguish from tees
- Slightly smaller card sizing (accessories are physically smaller products)

**Skeleton loaders:**
- Match glass card shape exactly
- Shimmer animation: linear gradient sweep from `rgba(255,255,255,0.03)` to `rgba(255,255,255,0.08)`

**Footer:**
- Deep frosted panel: `background: rgba(13,13,13,0.7)`, `backdrop-filter: blur(12px)`
- Subtle dot-grid texture overlay via SVG background-image

**Typography:**
- Display: Oswald (existing, keep)
- Body: DM Sans (replace Inter — add to Google Fonts import with `&display=swap` for `font-display: swap` performance strategy)

---

## Infrastructure — `vercel.json`

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https://images.printify.com data:; media-src 'self'; connect-src 'self';"
        }
```

> **Spec note (not part of the JSON file):** Printify API is called server-side only — no browser request ever reaches `api.printify.com`. `connect-src` stays `'self'` only; the browser calls `/api/products` (same-origin). Remove any `api.printify.com` entry if it appears.

```json
      ]
    }
  ]
}
```

---

## Accessibility Fixes

- Mobile nav closes on `Escape`, focus returns to hamburger button
- Carousel arrow key listener scoped to carousel, not document
- All product images have descriptive `alt` text from Printify title
- "Coming Soon" badge uses `aria-label="Not yet available for purchase"`
- "Shop on TikTok" links include `aria-label="{title} — Shop on TikTok"`

---

## Quality Checklist

| Area | Fix |
|------|-----|
| SEO | OG tags, Twitter Card, Schema.org, lang attribute |
| Performance | Printify CDN images (no local large PNGs), lazy loading, 5-min API cache |
| Security | API key in env var, security headers, CSP |
| Accessibility | Escape nav, scoped key listeners, descriptive aria labels |
| Code quality | try/catch throughout, no global side effects, clean DOM templating |
| Visual | Full glassmorphism retheme, DM Sans body font, animated blob background |

---

## Files to Delete After Implementation

Once Printify mockup images are confirmed live in the browser:
- `push-out-for-clout.png`
- `gapin-and-vapin.png`
- `wall-less-flaw-less.png`
- `ho-life-go-life.png`

These are superseded by Printify CDN images. The carousel and lifestyle images (`carousel-*.jpg`, `lifestyle-dock.jpg`, `logo.png`) remain.
