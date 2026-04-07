# Bottom Line Apparel — Printify Integration & Glassmorphism Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded product data with live Printify API products via a Vercel serverless function, apply a full dark glassmorphism visual theme, and fix all institutional quality gaps.

**Architecture:** A single Vercel Function (`api/products.js`) proxies the Printify API server-side, keeping the API key secure. The browser fetches `/api/products`, receives a `{ tees, accessories }` JSON shape, and renders product cards dynamically. The visual layer gets a complete dark glassmorphism retheme over an animated neon blob background.

**Tech Stack:** Vanilla HTML5/CSS3/ES6+, Vercel Functions (Node.js), Printify REST API, TikTok Shop as checkout.

**Spec:** `docs/superpowers/specs/2026-03-18-printify-integration-glassmorphism-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `api/products.js` | Create | Printify API proxy, classification, caching |
| `vercel.json` | Create | Security headers, CSP, routing |
| `.env.example` | Create | Documents required env vars |
| `index.html` | Modify | SEO meta, product grid placeholders, Accessories section |
| `script.js` | Modify | Live product rendering, skeletons, bug fixes |
| `styles.css` | Rewrite | Full glassmorphism theme, DM Sans, skeleton loaders |

---

## Chunk 1: Infrastructure & API Function

### Task 1: Set up Vercel CLI and local env

**Files:**
- Create: `.env.local` (gitignored — local secrets only)
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Check for Vercel CLI, install if missing**

```bash
vercel --version || npm install -g vercel
```

Expected: version string like `Vercel CLI 39.x.x`

- [ ] **Step 2: Create `.env.example`**

```
# Printify API token (JWT) — get from https://printify.com/app/account/connections
PRINTIFY_API_KEY=your_printify_jwt_here

# Printify shop ID — find in Printify dashboard URL or from /v1/shops.json
PRINTIFY_SHOP_ID=26847487
```

- [ ] **Step 3: Create `.env.local` with real credentials**

Create the file at the project root with the actual values (do NOT commit this file):

```
PRINTIFY_API_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIzN2Q0YmQzMDM1ZmUxMWU5YTgwM2FiN2VlYjNjY2M5NyIsImp0aSI6IjUzMTQ2MTcyN2I5Yjk4MmE0ODk1MzBiYWI3ZGQ3MTg4MjU1ZWYxMmJjMmFmZDU5MzFiZmEzNmM2YzEzMTM3ZGU2NTJlODBlMzc1MDFmZmNjIiwiaWF0IjoxNzczODM0Mjc5Ljg2MjYwOSwibmJmIjoxNzczODM0Mjc5Ljg2MjYxMiwiZXhwIjoxODA1MzcwMjc5Ljg1NDg4LCJzdWIiOiIyNjY3NzE4MyIsInNjb3BlcyI6WyJzaG9wcy5tYW5hZ2UiLCJzaG9wcy5yZWFkIiwiY2F0YWxvZy5yZWFkIiwib3JkZXJzLnJlYWQiLCJvcmRlcnMud3JpdGUiLCJwcm9kdWN0cy5yZWFkIiwicHJvZHVjdHMud3JpdGUiLCJ3ZWJob29rcy5yZWFkIiwid2ViaG9va3Mud3JpdGUiLCJ1cGxvYWRzLnJlYWQiLCJ1cGxvYWRzLndyaXRlIiwicHJpbnRfcHJvdmlkZXJzLnJlYWQiLCJ1c2VyLmluZm8iXX0.Js75s2P8hqcYHN1DEk7Rl8655qb4hxrnHJN54flZQu3g-qR4caITbkX7weCc4WvULJHWyg4eLwc39osB_mxJFJbMGS23LQyKDV2LHvjXeqFnqLJaXYf00q-a_hq61DiSxA27p0WX6U86V-fPRskQShpAFCHEN_aVD-ZRkc2emWQMTDiH-kDE9y-29ZkewO4tZzwzHmM9BPQmO7-6eB93whsT2-ABkwFprY-rqnUTSZUwV6xCfOC9TLKtxMDqRz4v1247mmB67jlBsV5CGSKEqPJWRTz0cCHLfPKZ67KSo0fX1-jUPv3VZZo8XZhQI8NpcgpIJZr-5LI5AglQM4LXPxU64hRvp6VAkfILiR1gwIthGZvDx8RxQsBOsShQcMvp9tVMErQyAHk67UMHvizByqnqy4cJhDwYoCDhOuJlxFzIpPeOgXTZ7kOl7D64uktxCX6qJi54pIXffSsyBqyRd8ardpllwRNFS-T4sAWDtARPaZv4ZOw5UlacA_hb2Z3ZA_0MuNJlt0WudDpJFUm35pDZOTdr9q3OQz9ywcvGD2usm2mIrjzkA2IWpvrb0mHM5VsVlWf-ORGi6lw5djvbaqh5Yka_7bK88bixOO4Es_OH5iPXcooVC21249abl1N5kE6fJmDEJ5trO1j1Gs35TWz8gAHsUaTp-3CM1P-ShUc
PRINTIFY_SHOP_ID=26847487
```

- [ ] **Step 4: Create `.gitignore` to protect secrets**

```
.env.local
.env
node_modules/
.vercel/
```

- [ ] **Step 5: Commit infrastructure scaffolding**

```bash
git init
git add .env.example .gitignore
git commit -m "chore: add env example and gitignore"
```

---

### Task 2: Create `vercel.json`

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create `vercel.json`**

Create `vercel.json` at the project root:

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
      ]
    }
  ]
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "chore: add vercel.json with security headers and CSP"
```

---

### Task 3: Create `api/products.js` — skeleton

**Files:**
- Create: `api/products.js`

- [ ] **Step 1: Create `api/` directory and stub function**

```bash
mkdir -p api
```

Create `api/products.js`:

```js
// api/products.js
// Vercel serverless function — proxies Printify API, returns classified products.
// Never called directly from the browser to api.printify.com — all calls happen here.

export default async function handler(req, res) {
  const apiKey = process.env.PRINTIFY_API_KEY;
  const shopId = process.env.PRINTIFY_SHOP_ID;

  if (!apiKey || !shopId) {
    return res.status(503).json({ error: 'unavailable' });
  }

  // Stub — full implementation replaces this file in Task 4
  return res.status(200).json({ tees: [], accessories: [] });
}
```

> **Note:** This stub is intentionally minimal. Task 4 replaces this file completely with the full implementation. The empty-array response from the stub is a valid API shape (the frontend handles empty arrays gracefully by hiding sections).

- [ ] **Step 2: Start vercel dev to confirm function is reachable**

```bash
vercel dev
```

Expected: Dev server starts on `http://localhost:3000`

- [ ] **Step 3: Test the stub endpoint**

In a new terminal:

```bash
curl http://localhost:3000/api/products
```

Expected:
```json
{"tees":[],"accessories":[]}
```

- [ ] **Step 4: Commit**

```bash
git add api/products.js
git commit -m "feat: add api/products.js stub"
```

---

### Task 4: Implement `api/products.js` — full logic

**Files:**
- Modify: `api/products.js`

- [ ] **Step 1: Replace stub with full implementation**

Replace `api/products.js` entirely:

```js
// api/products.js
// Vercel serverless function — proxies Printify API, returns classified products.
// All Printify API calls happen server-side. The API key is never sent to the browser.

/**
 * Strip HTML tags and return only the first sentence of text.
 * Printify descriptions contain rich HTML; we want a clean one-liner.
 */
function extractShortDescription(html) {
  if (!html) return '';
  // Strip all HTML tags
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  // Return up to the first sentence-ending punctuation
  const match = text.match(/^.+?[.!?](?:\s|$)/);
  return match ? match[0].trim() : text.slice(0, 120);
}

/**
 * Build the public TikTok Shop URL from the seller-facing handle.
 * Seller handle:  https://seller-us.tiktok.com/product/edit/1732296059243040901
 * Public URL:     https://www.tiktok.com/view/product/1732296059243040901
 * Returns null if no external handle exists (product not yet published).
 */
function buildTikTokUrl(external) {
  if (!external || !external.handle) return null;
  const segments = external.handle.split('/');
  const productId = segments[segments.length - 1];
  if (!productId || !/^\d+$/.test(productId)) return null;
  return `https://www.tiktok.com/view/product/${productId}`;
}

/**
 * Find the lowest price (in cents) among all enabled variants.
 * Returns null if no enabled variants exist.
 */
function lowestEnabledPrice(variants) {
  const enabled = (variants || []).filter(v => v.is_enabled);
  if (!enabled.length) return null;
  return Math.min(...enabled.map(v => v.price));
}

/**
 * Classify a product as 'tee' or 'accessory'.
 * Priority: explicit Printify tag → price fallback (≤ $10.00 = accessory).
 */
function classify(product, priceCents) {
  const tags = (product.tags || []).map(t => t.toLowerCase());
  if (tags.includes('tee')) return 'tee';
  if (tags.includes('accessory') || tags.includes('accessories')) return 'accessory';
  return priceCents <= 1000 ? 'accessory' : 'tee';
}

/**
 * Shape a raw Printify product into our clean API response shape.
 */
function shapeProduct(product) {
  const priceCents = lowestEnabledPrice(product.variants);
  if (priceCents === null) return null; // no enabled variants — skip

  const images = product.images || [];
  if (!images.length) return null; // no images — skip

  return {
    id: product.id,
    title: product.title,
    short_description: extractShortDescription(product.description),
    price: priceCents / 100,
    image: images[0].src,
    tiktok_url: buildTikTokUrl(product.external),
    category: classify(product, priceCents),
  };
}

export default async function handler(req, res) {
  const apiKey = process.env.PRINTIFY_API_KEY;
  const shopId = process.env.PRINTIFY_SHOP_ID;

  if (!apiKey || !shopId) {
    console.error('Missing PRINTIFY_API_KEY or PRINTIFY_SHOP_ID env vars');
    return res.status(503).json({ error: 'unavailable' });
  }

  let data;
  try {
    const response = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/products.json`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'BottomLineApparel/1.0',
        },
      }
    );

    if (!response.ok) {
      console.error('Printify API error:', response.status, response.statusText);
      return res.status(503).json({ error: 'unavailable' });
    }

    data = await response.json();
  } catch (err) {
    console.error('Printify fetch failed:', err.message);
    return res.status(503).json({ error: 'unavailable' });
  }

  const rawProducts = data.data || [];

  const tees = [];
  const accessories = [];

  for (const raw of rawProducts) {
    const shaped = shapeProduct(raw);
    if (!shaped) continue;
    if (shaped.category === 'tee') {
      tees.push(shaped);
    } else {
      accessories.push(shaped);
    }
  }

  // Cache at Vercel edge for 5 minutes
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  return res.status(200).json({ tees, accessories });
}
```

- [ ] **Step 2: Restart vercel dev and test full response**

```bash
# Kill the existing dev server (Ctrl+C), then:
vercel dev
```

In another terminal:

```bash
curl http://localhost:3000/api/products | python3 -m json.tool
```

Expected: JSON with 4 items in `tees` array and 1 item in `accessories` array. Each item should have `id`, `title`, `short_description`, `price`, `image`, `tiktok_url`. The sticker should have `"tiktok_url": null`.

- [ ] **Step 3: Verify error handling — test with missing env vars**

Vercel dev reads from `.env.local`. To test the 503 path, temporarily rename the file, restart the dev server, then restore it:

```bash
# 1. Stop vercel dev (Ctrl+C)
# 2. Rename .env.local so env vars are absent
mv .env.local .env.local.bak

# 3. Restart dev server
vercel dev

# 4. In another terminal, test:
curl -i http://localhost:3000/api/products
```

Expected: HTTP `503` with body `{"error":"unavailable"}`

```bash
# 5. Restore after testing:
# Stop vercel dev (Ctrl+C)
mv .env.local.bak .env.local
vercel dev
```

- [ ] **Step 4: Commit**

```bash
git add api/products.js
git commit -m "feat: implement Printify API proxy with classification and error handling"
```

---

## Chunk 2: HTML & JavaScript Updates

### Task 5: Update `index.html` — SEO, meta tags, structure

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the `<head>` font import (Inter → DM Sans)**

Find this line in `index.html`:
```html
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Oswald:wght@500;600;700&display=swap" rel="stylesheet" />
```

Replace with:
```html
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Oswald:wght@500;600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Add SEO and Open Graph meta tags**

After the `<meta name="description">` tag, add:

```html
  <!-- Open Graph -->
  <meta property="og:type"        content="website" />
  <meta property="og:url"         content="https://bottomlineapparel.com/" />
  <meta property="og:title"       content="Bottom Line Apparel — Your Ass Deserves a Punchline" />
  <meta property="og:description" content="Bottom Line Apparel is a queer-owned NYC brand serving gay men who like their tees unhinged, slightly cynical, and always loving. Shop the first drop." />
  <meta property="og:image"       content="https://bottomlineapparel.com/logo.png" />
  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="Bottom Line Apparel — Your Ass Deserves a Punchline" />
  <meta name="twitter:description" content="Bottom Line Apparel is a queer-owned NYC brand serving gay men who like their tees unhinged, slightly cynical, and always loving." />
  <meta name="twitter:image"       content="https://bottomlineapparel.com/logo.png" />
```

- [ ] **Step 3: Add Schema.org JSON-LD before `</head>`**

```html
  <!-- Schema.org Organization -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Bottom Line Apparel",
    "url": "https://bottomlineapparel.com",
    "description": "Queer-owned NYC apparel brand for gay men who like their tees unhinged, slightly cynical, and always loving.",
    "foundingLocation": "New York City, NY"
  }
  </script>
```

- [ ] **Step 4: Add animated blob background elements after `<body>`**

Immediately after `<body>`, before the header, add:

```html
  <!-- Animated glassmorphism blob background (positioned fixed via CSS) -->
  <div class="blob-bg" aria-hidden="true">
    <div class="blob blob--pink"></div>
    <div class="blob blob--blue"></div>
    <div class="blob blob--green"></div>
  </div>
```

- [ ] **Step 5: Replace the entire product showcase section**

Find the comment anchor `<!-- ═══════════════════ PRODUCT SHOWCASE ═══════════════════ -->` in `index.html` and replace everything from that comment through the closing `</section>` tag of the product showcase (the block ends just before the `<!-- ═══════════════════ LOOKBOOK` comment). Replace with:

```html
    <!-- ═══════════════════ PRODUCT SHOWCASE ═══════════════════ -->
    <section class="product-showcase" id="shop">
      <div class="container">
        <h2 class="section-title">The Drop</h2>
        <p class="showcase-intro">Four statements, zero subtlety. Each one is a piece for the messiest (and best) versions of you.</p>
        <div class="products-grid" id="products-grid">
          <!-- Products are injected here by script.js -->
        </div>
      </div>
    </section>

    <!-- ═══════════════════ ACCESSORIES ═══════════════════ -->
    <section class="accessories-section" id="accessories">
      <div class="container">
        <h2 class="section-title">Accessories</h2>
        <div class="accessories-grid" id="accessories-grid">
          <!-- Accessories are injected here by script.js -->
        </div>
      </div>
    </section>
```

- [ ] **Step 6: Update the hero card to use a dynamic image**

Find the hero card image in the hero section:
```html
          <img src="push-out-for-clout.png" alt="Push Out For Clout Tee" class="hero-card__img" />
```

Replace with an `id` so JavaScript can update it:
```html
          <img src="push-out-for-clout.png" alt="Featured tee" class="hero-card__img" id="hero-product-img" />
```

- [ ] **Step 7: Verify HTML is valid — open in browser**

```bash
vercel dev
```

Open `http://localhost:3000` in a browser. Confirm: page loads, product section shows an empty container (no products yet — that comes in Task 6).

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: add OG/Twitter meta, Schema.org, product grid placeholders, accessories section"
```

---

### Task 6: Update `script.js` — product fetching and rendering

**Files:**
- Modify: `script.js`

- [ ] **Step 1: Replace the entire `script.js` with the updated version**

This replaces `script.js` in full (preserving all existing functionality, adding product fetch/render, fixing bugs):

```js
/* ═══════════════════════════════════════════════
   Bottom Line Apparel — Scripts
   ═══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Mobile nav toggle ── */
  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');

  if (toggle && navLinks) {
    const closeNav = () => {
      toggle.setAttribute('aria-expanded', 'false');
      navLinks.classList.remove('open');
    };

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      navLinks.classList.toggle('open');
    });

    // Close on nav link click
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeNav);
    });

    // Close on Escape key — accessibility fix
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeNav();
        toggle.focus();
      }
    });
  }

  /* ── Header scroll state ── */
  const header = document.getElementById('site-header');

  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 80);
    }, { passive: true });
  }

  /* ── Active nav highlight on scroll ── */
  try {
    const sections = document.querySelectorAll('section[id]');
    const navItems = document.querySelectorAll('.nav-links a');

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navItems.forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
          });
        }
      });
    }, { root: null, rootMargin: '-40% 0px -60% 0px', threshold: 0 });

    sections.forEach(section => sectionObserver.observe(section));
  } catch (err) {
    console.error('[nav observer]', err);
  }

  /* ── Reveal-on-scroll animation ── */
  try {
    const revealTargets = document.querySelectorAll(
      '.section-title, .story-body p, .social-card, .join-copy, .signup-form'
    );
    revealTargets.forEach(el => el.classList.add('reveal'));

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    revealTargets.forEach(el => revealObserver.observe(el));
  } catch (err) {
    console.error('[reveal observer]', err);
  }

  /* ── Email signup form ── */
  try {
    const form = document.getElementById('signup-form');
    const emailInput = document.getElementById('email-input');
    const msg = document.getElementById('signup-msg');

    if (form && emailInput && msg) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        msg.classList.remove('signup-form__msg--success', 'signup-form__msg--error');

        if (!email) {
          msg.textContent = 'Enter your email, babe.';
          msg.classList.add('signup-form__msg--error');
          return;
        }
        if (!isValid) {
          msg.textContent = "That doesn't look like a real email. Try again.";
          msg.classList.add('signup-form__msg--error');
          return;
        }

        msg.textContent = "You're in. First dibs are yours. 💅";
        msg.classList.add('signup-form__msg--success');
        emailInput.value = '';
      });
    }
  } catch (err) {
    console.error('[signup form]', err);
  }

  /* ── 3D Image Carousel (Coverflow) ── */
  try {
    const carouselTrack = document.getElementById('carousel-track');
    const slides = document.querySelectorAll('.carousel-slide');
    const btnPrev = document.getElementById('carousel-prev');
    const btnNext = document.getElementById('carousel-next');

    if (carouselTrack && slides.length > 0) {
      let currentIndex = 0;
      let autoPlayInterval;

      const updateCarousel = () => {
        slides.forEach((slide, index) => {
          slide.classList.remove('active');
          const offset = index - currentIndex;
          const translateX = offset * 140;
          const scale = 1 - Math.abs(offset) * 0.15;
          const rotateY = offset === 0 ? 0 : (offset > 0 ? -30 : 30);
          const translateZ = -Math.abs(offset) * 100;
          const zIndex = slides.length - Math.abs(offset);
          slide.style.transform = `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
          slide.style.zIndex = zIndex;
          if (offset === 0) slide.classList.add('active');
        });
      };

      const startAutoPlay = () => {
        autoPlayInterval = setInterval(() => {
          currentIndex = (currentIndex + 1) % slides.length;
          updateCarousel();
        }, 3500);
      };

      const resetAutoPlay = () => {
        clearInterval(autoPlayInterval);
        startAutoPlay();
      };

      if (btnNext) btnNext.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % slides.length;
        updateCarousel();
        resetAutoPlay();
      });

      if (btnPrev) btnPrev.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + slides.length) % slides.length;
        updateCarousel();
        resetAutoPlay();
      });

      slides.forEach((slide, index) => {
        slide.addEventListener('click', () => {
          if (currentIndex !== index) {
            currentIndex = index;
            updateCarousel();
            resetAutoPlay();
          }
        });
        slide.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (currentIndex !== index) {
              currentIndex = index;
              updateCarousel();
            }
          }
        });
      });

      // Arrow key navigation — scoped to carousel container only
      carouselTrack.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          currentIndex = (currentIndex - 1 + slides.length) % slides.length;
          updateCarousel();
          resetAutoPlay();
        } else if (e.key === 'ArrowRight') {
          currentIndex = (currentIndex + 1) % slides.length;
          updateCarousel();
          resetAutoPlay();
        }
      });

      updateCarousel();
      startAutoPlay();
    }
  } catch (err) {
    console.error('[carousel]', err);
  }

  /* ── Smooth scroll polyfill ── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      try {
        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      } catch (err) {
        console.error('[smooth scroll]', err);
      }
    });
  });

  /* ══════════════════════════════════════════════════
     PRODUCT LOADING — Printify via /api/products
     ══════════════════════════════════════════════════ */

  const productsGrid = document.getElementById('products-grid');
  const accessoriesGrid = document.getElementById('accessories-grid');
  const accessoriesSection = document.getElementById('accessories');

  /**
   * Builds a single skeleton card HTML string.
   * Used while /api/products is loading.
   */
  function skeletonCard() {
    return `
      <article class="product-card product-card--skeleton" aria-hidden="true">
        <div class="product-card__image skeleton-block"></div>
        <div class="product-card__body">
          <div class="skeleton-line skeleton-line--title"></div>
          <div class="skeleton-line skeleton-line--text"></div>
          <div class="skeleton-line skeleton-line--text skeleton-line--short"></div>
          <div class="skeleton-line skeleton-line--price"></div>
          <div class="skeleton-line skeleton-line--btn"></div>
        </div>
      </article>
    `;
  }

  /**
   * Builds an accessory skeleton card (slightly smaller).
   */
  function skeletonAccessoryCard() {
    return `
      <article class="accessory-card accessory-card--skeleton" aria-hidden="true">
        <div class="accessory-card__image skeleton-block"></div>
        <div class="accessory-card__body">
          <div class="skeleton-line skeleton-line--title"></div>
          <div class="skeleton-line skeleton-line--price"></div>
          <div class="skeleton-line skeleton-line--btn"></div>
        </div>
      </article>
    `;
  }

  /**
   * Renders a tee product card.
   */
  function renderTeeCard(product) {
    // Neon glow colors cycle pink → blue → green
    const glowColors = ['--color-pink', '--color-blue', '--color-green'];
    const glowVar = glowColors[Math.floor(Math.random() * glowColors.length)];

    const buyBtn = product.tiktok_url
      ? `<a href="${product.tiktok_url}" class="btn btn--glass" target="_blank" rel="noopener noreferrer"
           aria-label="${escapeAttr(product.title)} — Shop on TikTok">
           Shop on TikTok
         </a>`
      : `<span class="badge-coming-soon" aria-label="Not yet available for purchase">Coming Soon</span>`;

    return `
      <article class="product-card reveal" style="--glow-color: var(${glowVar})">
        <div class="product-card__image">
          <img src="${product.image}"
               alt="${escapeAttr(product.title)}"
               loading="lazy"
               width="600"
               height="600" />
        </div>
        <div class="product-card__body">
          <h3 class="product-card__title">${escapeHtml(product.title)}</h3>
          <p class="product-card__desc">${escapeHtml(product.short_description)}</p>
          <div class="product-card__footer">
            <span class="product-card__price">$${product.price.toFixed(2)}</span>
            ${buyBtn}
          </div>
        </div>
      </article>
    `;
  }

  /**
   * Renders an accessory card.
   */
  function renderAccessoryCard(product) {
    const buyBtn = product.tiktok_url
      ? `<a href="${product.tiktok_url}" class="btn btn--glass btn--sm" target="_blank" rel="noopener noreferrer"
           aria-label="${escapeAttr(product.title)} — Shop on TikTok">
           Shop on TikTok
         </a>`
      : `<span class="badge-coming-soon" aria-label="Not yet available for purchase">Coming Soon</span>`;

    return `
      <article class="accessory-card reveal">
        <div class="accessory-card__image">
          <img src="${product.image}"
               alt="${escapeAttr(product.title)}"
               loading="lazy"
               width="400"
               height="400" />
        </div>
        <div class="accessory-card__body">
          <h3 class="accessory-card__title">${escapeHtml(product.title)}</h3>
          <div class="accessory-card__footer">
            <span class="accessory-card__price">$${product.price.toFixed(2)}</span>
            ${buyBtn}
          </div>
        </div>
      </article>
    `;
  }

  /**
   * Renders a fallback error/unavailable state into a grid element.
   */
  function renderFallback(gridEl) {
    gridEl.innerHTML = `
      <p class="products-unavailable">
        Shop is temporarily unavailable — check back soon.
      </p>
    `;
  }

  /** Escape HTML entities to prevent XSS in rendered strings. */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Escape for use inside HTML attribute values. */
  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * After products render, observe new .reveal elements for the scroll animation.
   */
  function observeNewRevealTargets() {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.product-card.reveal:not(.visible), .accessory-card.reveal:not(.visible)')
      .forEach(el => revealObserver.observe(el));
  }

  /**
   * Main product load function.
   */
  async function loadProducts() {
    if (!productsGrid && !accessoriesGrid) return;

    // Inject skeletons while loading
    if (productsGrid) {
      productsGrid.innerHTML = Array(3).fill(skeletonCard()).join('');
    }
    if (accessoriesGrid) {
      accessoriesGrid.innerHTML = Array(2).fill(skeletonAccessoryCard()).join('');
    }

    let data;
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.error('[loadProducts] fetch failed:', err);
      if (productsGrid) renderFallback(productsGrid);
      if (accessoriesGrid) renderFallback(accessoriesGrid);
      return;
    }

    // Render tees
    if (productsGrid) {
      if (!data.tees || !data.tees.length) {
        productsGrid.closest('section')?.style.setProperty('display', 'none');
      } else {
        productsGrid.innerHTML = data.tees.map(renderTeeCard).join('');
      }
    }

    // Render accessories
    if (accessoriesGrid && accessoriesSection) {
      if (!data.accessories || !data.accessories.length) {
        accessoriesSection.style.display = 'none';
      } else {
        accessoriesGrid.innerHTML = data.accessories.map(renderAccessoryCard).join('');
      }
    }

    // Update hero card with first tee's image
    try {
      const heroImg = document.getElementById('hero-product-img');
      if (heroImg && data.tees && data.tees.length > 0) {
        heroImg.src = data.tees[0].image;
        heroImg.alt = data.tees[0].title;
      }
    } catch (err) {
      console.error('[hero img update]', err);
    }

    // Observe new reveal targets
    observeNewRevealTargets();
  }

  loadProducts();

});
```

- [ ] **Step 2: Verify in browser — products load and render**

With `vercel dev` running, open `http://localhost:3000`. Expected:
1. Page loads with 3 skeleton cards briefly appearing in the products section and 2 in the accessories section
2. Skeletons are replaced by real product cards with Printify mockup images, real titles, real prices
3. Sticker in Accessories section shows "Coming Soon" badge (no TikTok link yet)
4. Hero card image updates to the first tee's Printify mockup image
5. Console shows no errors

- [ ] **Step 3: Verify bug fixes**

- Open mobile view in DevTools (≤768px), open hamburger nav, then press `Escape`: nav should close and focus should return to the hamburger button
- Arrow key scope fix: click a nav link (so focus is on a non-carousel element), then press `ArrowRight` or `ArrowLeft` — the carousel must NOT advance. The carousel only responds to arrow keys when focus is inside `#carousel-track`.

- [ ] **Step 4: Commit**

```bash
git add script.js
git commit -m "feat: live Printify product rendering, skeletons, error states, accessibility fixes"
```

---

## Chunk 3: CSS Glassmorphism Theme

### Task 7: Complete `styles.css` glassmorphism rewrite

**Files:**
- Rewrite: `styles.css`

This task replaces `styles.css` in its entirety. The structure matches the original (tokens → reset → layout → components → responsive) but every visual value is updated for the glassmorphism theme.

- [ ] **Step 1: Replace `styles.css` entirely**

```css
/* ═══════════════════════════════════════════════
   Bottom Line Apparel — Styles (Glassmorphism Edition)
   Body font: DM Sans | Display font: Oswald
   Theme: Dark glassmorphism over animated neon blob background
   ═══════════════════════════════════════════════ */

/* ── Design Tokens ── */
:root {
  /* Brand palette */
  --color-bg:           #0d0d0d;
  --color-dark:         #1a1a1a;
  --color-pink:         #ff2d87;
  --color-blue:         #2df4ff;
  --color-green:        #b5ff2d;
  --color-text:         #f0f0f0;
  --color-text-muted:   #888;

  /* Glass surfaces */
  --color-surface:      rgba(255, 255, 255, 0.05);
  --color-surface-warm: rgba(255, 45, 135, 0.05);
  --color-border:        rgba(255, 255, 255, 0.08);
  --color-border-hover:  rgba(255, 255, 255, 0.18);
  --color-border-accent: rgba(255, 45, 135, 0.3);   /* spec-defined token for pink accent borders */

  /* Blur values — hold full filter function values (intentional).
     Use as: backdrop-filter: var(--blur-glass)
     Cannot be composed arithmetically. */
  --blur-glass: blur(20px);
  --blur-nav:   blur(24px);
  --blur-hero:  blur(16px);

  /* Kept for backwards compatibility with existing component refs */
  --c-black:       #0d0d0d;
  --c-dark:        #1a1a1a;
  --c-gray:        #2a2a2a;
  --c-mid-gray:    #888;
  --c-light-gray:  #f0f0f0;
  --c-white:       #ffffff;
  --c-pink:        #ff2d87;
  --c-green:       #b5ff2d;
  --c-blue:        #2df4ff;
  --accent:        var(--c-pink);
  --accent-alt:    var(--c-green);

  /* Typography */
  --ff-display: 'Oswald', 'Impact', sans-serif;
  --ff-body:    'DM Sans', 'Helvetica Neue', Arial, sans-serif;
  --fw-bold:    700;
  --fw-semi:    600;
  --fw-medium:  500;
  --fw-regular: 400;

  /* Spacing */
  --space-xs: 0.5rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 3rem;
  --space-xl: 5rem;

  /* Shape */
  --radius:    8px;
  --radius-lg: 16px;

  /* Misc */
  --header-h:  64px;
  --transition: 0.25s ease;
}

/* ── Reset & Base ── */
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
  scroll-padding-top: var(--header-h);
  -webkit-text-size-adjust: 100%;
}

body {
  font-family: var(--ff-body);
  font-weight: var(--fw-regular);
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
}

img {
  display: block;
  max-width: 100%;
}

a {
  color: inherit;
  text-decoration: none;
}

ul {
  list-style: none;
}

/* Screen-reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  border: 0;
}

/* ── Container ── */
.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-md);
}

/* ── Section title ── */
.section-title {
  font-family: var(--ff-display);
  font-weight: var(--fw-bold);
  font-size: clamp(1.8rem, 5vw, 3rem);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text);
  margin-bottom: var(--space-md);
  position: relative;
  display: inline-block;
}

.section-title::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -4px;
  width: 60px;
  height: 4px;
  background: var(--color-pink);
}

/* ══════════════════════════════════════════════════
   ANIMATED BLOB BACKGROUND
   ══════════════════════════════════════════════════ */
.blob-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
}

.blob {
  position: absolute;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.12;
}

.blob--pink {
  background: var(--color-pink);
  top: -100px;
  left: -100px;
  animation: blobDrift1 22s ease-in-out infinite alternate;
}

.blob--blue {
  background: var(--color-blue);
  bottom: 20%;
  right: -150px;
  animation: blobDrift2 28s ease-in-out infinite alternate;
}

.blob--green {
  background: var(--color-green);
  top: 50%;
  left: 30%;
  animation: blobDrift3 18s ease-in-out infinite alternate;
}

@keyframes blobDrift1 {
  from { transform: translate(0, 0) scale(1); }
  to   { transform: translate(120px, 80px) scale(1.15); }
}

@keyframes blobDrift2 {
  from { transform: translate(0, 0) scale(1); }
  to   { transform: translate(-100px, -60px) scale(0.9); }
}

@keyframes blobDrift3 {
  from { transform: translate(0, 0) scale(1); }
  to   { transform: translate(60px, -100px) scale(1.1); }
}

/* Accessibility: stop animations for users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  .blob {
    animation: none;
  }
  .reveal {
    transition: none !important;
  }
  .hero-card--featured {
    transition: none !important;
  }
}

/* ══════════════════════════════════════════════════
   BUTTONS
   ══════════════════════════════════════════════════ */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--ff-display);
  font-weight: var(--fw-semi);
  font-size: 0.95rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius);
  border: none;
  cursor: pointer;
  transition: all var(--transition);
  white-space: nowrap;
  position: relative;
}

/* Glass pill button with pseudo-element gradient border */
.btn--glass {
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  border-radius: var(--radius);
  isolation: isolate;
}

/* Gradient border via ::before — border-image is incompatible with border-radius */
.btn--glass::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: calc(var(--radius) + 1px);
  background: linear-gradient(135deg, var(--color-pink), var(--color-blue));
  z-index: -1;
  opacity: 0.7;
  transition: opacity var(--transition);
}

.btn--glass:hover {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 24px rgba(255, 45, 135, 0.35);
  color: var(--color-text);
}

.btn--glass:hover::before {
  opacity: 1;
}

/* Legacy solid primary button (kept for header CTA and hero) */
.btn--primary {
  background: var(--color-pink);
  color: #0d0d0d;
  border-radius: var(--radius);
}

.btn--primary:hover {
  background: transparent;
  color: var(--color-pink);
  box-shadow: 0 0 20px rgba(255, 45, 135, 0.45);
  outline: 2px solid var(--color-pink);
  outline-offset: -2px;
}

.btn--secondary {
  background: transparent;
  color: var(--color-text);
  outline: 2px solid rgba(255, 255, 255, 0.4);
  outline-offset: -2px;
  border-radius: var(--radius);
}

.btn--secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  outline-color: var(--color-text);
}

.btn--lg {
  padding: 1rem 2rem;
  font-size: 1.05rem;
}

.btn--sm {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
}

/* ══════════════════════════════════════════════════
   HEADER
   ══════════════════════════════════════════════════ */
.site-header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: var(--header-h);
  background: rgba(13, 13, 13, 0.6);
  backdrop-filter: var(--blur-nav);
  -webkit-backdrop-filter: var(--blur-nav);
  z-index: 1000;
  border-bottom: 1px solid var(--color-border);
  transition: background var(--transition);
}

.site-header.scrolled {
  background: rgba(13, 13, 13, 0.88);
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-md);
  gap: var(--space-sm);
}

/* Logo */
.logo {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.logo-svg {
  height: 48px;
  width: auto;
  display: block;
}

/* Navigation */
.nav-links {
  display: flex;
  gap: var(--space-md);
}

.nav-links a {
  font-family: var(--ff-display);
  font-weight: var(--fw-medium);
  font-size: 0.9rem;
  color: rgba(240, 240, 240, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  position: relative;
  padding: 4px 0;
  transition: color var(--transition);
}

.nav-links a::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 0;
  height: 2px;
  background: var(--color-pink);
  transition: width var(--transition);
}

.nav-links a:hover::after,
.nav-links a.active::after {
  width: 100%;
}

.nav-links a:hover {
  color: var(--color-text);
}

/* Hamburger toggle — mobile */
.nav-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  z-index: 10;
}

.hamburger {
  display: block;
  width: 24px;
  height: 2px;
  background: var(--color-text);
  position: relative;
  transition: background 0.2s;
}

.hamburger::before,
.hamburger::after {
  content: '';
  position: absolute;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--color-text);
  transition: transform 0.3s, top 0.3s;
}

.hamburger::before { top: -7px; }
.hamburger::after  { top: 7px; }

.nav-toggle[aria-expanded="true"] .hamburger {
  background: transparent;
}
.nav-toggle[aria-expanded="true"] .hamburger::before {
  top: 0;
  transform: rotate(45deg);
}
.nav-toggle[aria-expanded="true"] .hamburger::after {
  top: 0;
  transform: rotate(-45deg);
}

.header-cta {
  font-size: 0.82rem;
  padding: 0.55rem 1.1rem;
  flex-shrink: 0;
}

/* ══════════════════════════════════════════════════
   HERO
   ══════════════════════════════════════════════════ */
.hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: calc(var(--header-h) + var(--space-lg)) var(--space-md) var(--space-lg);
  background: transparent; /* blobs show through */
  color: var(--color-text);
  overflow: hidden;
  position: relative;
}

/* Dark overlay over video */
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(13, 13, 13, 0.55);
  z-index: 1;
  pointer-events: none;
}

.hero-video-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}

.hero-content {
  max-width: 700px;
  position: relative;
  z-index: 2;
  /* Frosted glass card */
  background: rgba(13, 13, 13, 0.4);
  backdrop-filter: var(--blur-hero);
  -webkit-backdrop-filter: var(--blur-hero);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.hero-headline {
  font-family: var(--ff-display);
  font-weight: var(--fw-bold);
  font-size: clamp(2.2rem, 7vw, 4.5rem);
  line-height: 1.1;
  text-transform: uppercase;
  margin-bottom: var(--space-md);
}

.hero-highlight {
  color: var(--color-pink);
  display: block;
}

.hero-subhead {
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  color: rgba(240, 240, 240, 0.78);
  line-height: 1.6;
  margin-bottom: var(--space-lg);
  max-width: 560px;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

/* Hero featured card */
.hero-visual {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: var(--space-lg);
  position: relative;
  z-index: 2;
  perspective: 1000px;
}

.hero-card--featured {
  max-width: 420px;
  background: var(--color-surface);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  transform: rotateY(-10deg) rotateX(5deg);
  transition: transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.8s ease;
  box-shadow:
    -20px 20px 60px rgba(0, 0, 0, 0.5),
    0 0 40px rgba(255, 45, 135, 0.12);
}

.hero-card--featured:hover {
  transform: rotateY(0deg) rotateX(0deg) scale(1.02);
  box-shadow:
    0 20px 80px rgba(0, 0, 0, 0.6),
    0 0 60px rgba(255, 45, 135, 0.25);
}

.hero-card--featured .hero-card__img {
  width: 100%;
  max-width: 340px;
  filter: drop-shadow(0 20px 30px rgba(0,0,0,0.5));
  transition: transform 0.5s ease;
}

.hero-card--featured:hover .hero-card__img {
  transform: translateY(-10px);
}

.hero-card__label {
  margin-top: var(--space-md);
  font-family: var(--ff-display);
  font-size: 1.1rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-pink);
  text-shadow: 0 0 10px rgba(255, 45, 135, 0.5);
}

/* ══════════════════════════════════════════════════
   STORY
   ══════════════════════════════════════════════════ */
.story {
  padding: var(--space-xl) 0;
  background: transparent;
  color: var(--color-text);
}

.story-body {
  max-width: 720px;
}

.story-body p {
  font-size: clamp(1rem, 2vw, 1.15rem);
  color: rgba(240, 240, 240, 0.82);
  margin-bottom: var(--space-md);
  line-height: 1.75;
}

.story-body p:last-child {
  margin-bottom: 0;
}

.story-grid {
  display: grid;
  gap: var(--space-lg);
  align-items: center;
}

@media (min-width: 900px) {
  .story-grid {
    grid-template-columns: 1fr 1fr;
    gap: var(--space-xl);
  }
  .story-content {
    padding-right: var(--space-lg);
  }
}

/* ══════════════════════════════════════════════════
   COMMUNITY CAROUSEL (3D Coverflow)
   ══════════════════════════════════════════════════ */
.carousel-container {
  position: relative;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-lg) 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.carousel-track {
  position: relative;
  width: 100%;
  height: 400px;
  display: flex;
  justify-content: center;
  align-items: center;
  perspective: 1200px;
  transform-style: preserve-3d;
}

.carousel-slide {
  position: absolute;
  width: 300px;
  height: 400px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.6s ease, box-shadow 0.6s ease;
  cursor: pointer;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.carousel-slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.carousel-slide:not(.active) {
  opacity: 0.5;
}

.carousel-slide.active {
  opacity: 1;
  box-shadow: 0 20px 50px rgba(255, 45, 135, 0.18);
}

.carousel-controls {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-xl);
  z-index: 10;
}

.carousel-btn {
  background: var(--color-surface);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color var(--transition), box-shadow var(--transition), transform var(--transition);
}

.carousel-btn:hover {
  border-color: var(--color-pink);
  box-shadow: 0 0 16px rgba(255, 45, 135, 0.3);
  transform: scale(1.05);
}

/* ══════════════════════════════════════════════════
   PRODUCT SHOWCASE
   ══════════════════════════════════════════════════ */
.product-showcase {
  padding: var(--space-xl) 0;
  background: transparent;
}

.showcase-intro {
  max-width: 600px;
  margin-bottom: var(--space-xl);
  color: var(--color-text-muted);
  font-size: 1.1rem;
}

/* Product cards grid */
.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-lg);
}

/* Individual product card */
.product-card {
  background: var(--color-surface);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition:
    transform var(--transition),
    box-shadow var(--transition),
    border-color var(--transition);
}

.product-card:hover {
  transform: translateY(-4px);
  border-color: var(--color-border-hover);
  /* Glow color is set per-card via CSS custom property --glow-color.
     color-mix() requires Chrome 111+/Safari 16.2+/Firefox 113+. Fallback to solid pink glow. */
  box-shadow: 0 0 40px rgba(255, 45, 135, 0.3); /* fallback */
  box-shadow: 0 0 40px color-mix(in srgb, var(--glow-color, var(--color-pink)) 30%, transparent);
}

.product-card__image {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
}

.product-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.product-card:hover .product-card__image img {
  transform: scale(1.04);
}

.product-card__body {
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.product-card__title {
  font-family: var(--ff-display);
  font-size: clamp(1rem, 2vw, 1.25rem);
  font-weight: var(--fw-semi);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text);
  line-height: 1.2;
}

.product-card__desc {
  font-size: 0.92rem;
  color: var(--color-text-muted);
  line-height: 1.55;
}

.product-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-border);
}

.product-card__price {
  font-family: var(--ff-display);
  font-size: 1.5rem;
  font-weight: var(--fw-bold);
  color: var(--color-text);
}

/* ══════════════════════════════════════════════════
   ACCESSORIES SECTION
   ══════════════════════════════════════════════════ */
.accessories-section {
  padding: var(--space-xl) 0;
  background: transparent;
}

/* Accessories grid — same pattern, slightly tighter */
.accessories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-md);
  max-width: 800px;
}

/* Accessory card — same glass pattern, warm tint */
.accessory-card {
  background: var(--color-surface-warm);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  border: 1px solid rgba(255, 45, 135, 0.12);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition:
    transform var(--transition),
    box-shadow var(--transition),
    border-color var(--transition);
}

.accessory-card:hover {
  transform: translateY(-4px);
  border-color: rgba(255, 45, 135, 0.3);
  box-shadow: 0 0 30px rgba(255, 45, 135, 0.15);
}

.accessory-card__image {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
}

.accessory-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.accessory-card:hover .accessory-card__image img {
  transform: scale(1.04);
}

.accessory-card__body {
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.accessory-card__title {
  font-family: var(--ff-display);
  font-size: 1rem;
  font-weight: var(--fw-semi);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text);
}

.accessory-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: var(--space-sm);
  border-top: 1px solid rgba(255, 45, 135, 0.12);
}

.accessory-card__price {
  font-family: var(--ff-display);
  font-size: 1.25rem;
  font-weight: var(--fw-bold);
  color: var(--color-text);
}

/* Coming Soon badge */
.badge-coming-soon {
  display: inline-flex;
  align-items: center;
  font-family: var(--ff-display);
  font-size: 0.75rem;
  font-weight: var(--fw-semi);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: transparent;
}

/* Unavailable fallback */
.products-unavailable {
  color: var(--color-text-muted);
  font-size: 1rem;
  padding: var(--space-lg) 0;
  grid-column: 1 / -1;
}

/* ══════════════════════════════════════════════════
   SKELETON LOADERS
   ══════════════════════════════════════════════════ */
@keyframes shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position: 600px 0; }
}

.skeleton-block,
.skeleton-line {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.03) 25%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.03) 75%
  );
  background-size: 600px 100%;
  animation: shimmer 1.6s infinite linear;
  border-radius: var(--radius);
}

.product-card--skeleton .product-card__image,
.accessory-card--skeleton .accessory-card__image {
  aspect-ratio: 1 / 1;
}

.product-card--skeleton .skeleton-block,
.accessory-card--skeleton .skeleton-block {
  width: 100%;
  height: 100%;
  border-radius: 0;
}

.skeleton-line {
  height: 14px;
  margin-bottom: 8px;
}

.skeleton-line--title  { height: 20px; width: 85%; }
.skeleton-line--text   { width: 100%; }
.skeleton-line--short  { width: 60%; }
.skeleton-line--price  { width: 30%; height: 24px; margin-top: 8px; }
.skeleton-line--btn    { width: 50%; height: 36px; margin-top: 8px; border-radius: var(--radius); }

/* ══════════════════════════════════════════════════
   LOOKBOOK / SOCIAL
   ══════════════════════════════════════════════════ */
.lookbook {
  padding: var(--space-xl) 0;
  background: transparent;
  color: var(--color-text);
}

.lookbook-intro {
  max-width: 640px;
  margin-bottom: var(--space-lg);
  color: rgba(240, 240, 240, 0.72);
  line-height: 1.7;
}

.social-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-md);
}

.social-card {
  background: var(--color-surface);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--color-border);
  transition: transform var(--transition), border-color var(--transition), box-shadow var(--transition);
}

.social-card:hover {
  transform: translateY(-3px);
  border-color: var(--color-pink);
  box-shadow: 0 0 20px rgba(255, 45, 135, 0.15);
}

.social-card__img {
  height: 200px;
  background: linear-gradient(135deg, rgba(255,45,135,0.08) 0%, rgba(45,244,255,0.08) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.social-card__icon {
  font-size: 3rem;
  opacity: 0.6;
}

.social-card__body {
  padding: var(--space-md);
}

.social-card__user {
  font-family: var(--ff-display);
  font-weight: var(--fw-semi);
  font-size: 0.95rem;
  color: var(--color-pink);
  margin-bottom: var(--space-xs);
}

.social-card__caption {
  font-size: 0.9rem;
  color: rgba(240, 240, 240, 0.65);
  line-height: 1.55;
}

/* ══════════════════════════════════════════════════
   JOIN / SIGNUP
   ══════════════════════════════════════════════════ */
.join {
  padding: var(--space-xl) 0;
  background: transparent;
  text-align: center;
}

.join .section-title {
  display: block;
  text-align: center;
}

.join .section-title::after {
  left: 50%;
  transform: translateX(-50%);
}

.join-copy {
  max-width: 560px;
  margin: 0 auto var(--space-lg);
  color: rgba(240, 240, 240, 0.75);
  font-size: 1.05rem;
  line-height: 1.7;
}

.signup-form__group {
  display: flex;
  max-width: 480px;
  margin: 0 auto;
  gap: 0;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
}

.signup-form__input {
  flex: 1;
  font-family: var(--ff-body);
  font-size: 1rem;
  padding: 0.85rem 1rem;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  min-width: 0;
}

.signup-form__input::placeholder {
  color: var(--color-text-muted);
}

.signup-form__input:focus {
  background: rgba(255, 255, 255, 0.03);
}

.signup-form__btn {
  border-radius: 0;
  border: none;
  padding: 0.85rem 1.4rem;
  font-size: 0.85rem;
}

.signup-form__msg {
  margin-top: var(--space-sm);
  font-size: 0.9rem;
  min-height: 1.4em;
}

.signup-form__msg--success { color: var(--color-green); font-weight: var(--fw-medium); }
.signup-form__msg--error   { color: var(--color-pink);  font-weight: var(--fw-medium); }

/* ══════════════════════════════════════════════════
   FOOTER
   ══════════════════════════════════════════════════ */
.site-footer {
  background: rgba(13, 13, 13, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--space-md);
  font-size: 0.85rem;
  border-top: 1px solid var(--color-border);
  /* Dot-grid texture via SVG data URI */
  background-image: url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='rgba(255,255,255,0.03)'/%3E%3C/svg%3E");
  background-repeat: repeat;
}

/* ══════════════════════════════════════════════════
   ANIMATIONS
   ══════════════════════════════════════════════════ */
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ══════════════════════════════════════════════════
   SCROLLBAR
   ══════════════════════════════════════════════════ */
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: var(--color-dark); }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--color-pink); }

/* ══════════════════════════════════════════════════
   RESPONSIVE
   ══════════════════════════════════════════════════ */

/* Mobile */
@media (max-width: 768px) {
  .nav-toggle {
    display: block;
  }

  .nav-links {
    position: fixed;
    top: var(--header-h);
    left: 0;
    width: 100%;
    flex-direction: column;
    background: rgba(13, 13, 13, 0.96);
    backdrop-filter: var(--blur-nav);
    -webkit-backdrop-filter: var(--blur-nav);
    padding: var(--space-md);
    gap: var(--space-sm);
    transform: translateY(-120%);
    transition: transform 0.35s ease;
    z-index: 999;
    border-bottom: 1px solid var(--color-border);
  }

  .nav-links.open {
    transform: translateY(0);
  }

  .nav-links a {
    font-size: 1.1rem;
    padding: var(--space-xs) 0;
  }

  .header-cta {
    display: none;
  }

  .hero {
    min-height: auto;
    padding-top: calc(var(--header-h) + var(--space-lg));
    padding-bottom: var(--space-lg);
  }

  .hero-visual {
    flex-direction: column;
    align-items: stretch;
  }

  .hero-card {
    max-width: none;
  }

  .social-grid {
    grid-template-columns: 1fr;
  }

  .signup-form__group {
    flex-direction: column;
    border-radius: var(--radius);
    border: 1px solid var(--color-border);
    overflow: visible;
    background: transparent;
  }

  .signup-form__input {
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    backdrop-filter: var(--blur-glass);
    margin-bottom: var(--space-xs);
  }

  .signup-form__btn {
    border-radius: var(--radius);
  }

  .products-grid {
    grid-template-columns: 1fr;
  }

  .accessories-grid {
    grid-template-columns: 1fr;
  }
}

/* Medium+ */
@media (min-width: 769px) {
  .hero {
    flex-direction: row;
    align-items: center;
    gap: var(--space-xl);
    padding-left: var(--space-xl);
    padding-right: var(--space-xl);
  }

  .hero-content {
    flex: 1;
  }

  .hero-visual {
    flex: 0 0 auto;
    flex-direction: column;
    margin-top: 0;
  }

  .products-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .accessories-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
}

/* Large */
@media (min-width: 1080px) {
  .hero-visual {
    flex-direction: row;
  }

  .products-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

- [ ] **Step 2: Verify glassmorphism theme renders correctly**

With `vercel dev` running, open `http://localhost:3000`. Expected:
1. Dark background with subtle neon blob glow in corners
2. Header is frosted glass — slightly transparent, deepens on scroll
3. Hero text content sits on a frosted glass panel over the video
4. Product cards are glass panels with subtle borders; hover produces colored glow
5. Accessories cards have a subtle warm pink tint
6. Skeleton shimmer matches glass card shape
7. Footer has dot-grid texture visible on close inspection
8. No flash of light background; entire page is dark

- [ ] **Step 3: Verify DM Sans loaded correctly**

In browser DevTools → Network → filter by "fonts" → confirm `DM+Sans` appears in the loaded resources (not Inter).

- [ ] **Step 4: Verify `prefers-reduced-motion`**

In Chrome DevTools → Rendering → enable "Emulate CSS media feature prefers-reduced-motion: reduce". Reload page. Expected: blobs are visible but NOT animating. Reveal transitions are instant (no slide-up).

- [ ] **Step 5: Commit**

```bash
git add styles.css
git commit -m "feat: full glassmorphism theme — dark glass panels, animated neon blobs, DM Sans, skeleton loaders"
```

---

## Chunk 4: Cleanup & Final Verification

### Task 8: Remove obsolete product PNG images

**Files:**
- Delete: `push-out-for-clout.png`, `gapin-and-vapin.png`, `wall-less-flaw-less.png`, `ho-life-go-life.png`

- [ ] **Step 1: Confirm Printify images are loading correctly first**

Open `http://localhost:3000` and confirm all 4 tee product cards show Printify mockup images (URLs from `images.printify.com`). Do NOT proceed with deletion until images are confirmed.

- [ ] **Step 2: Delete the obsolete local product images**

```bash
rm "push-out-for-clout.png" "gapin-and-vapin.png" "wall-less-flaw-less.png" "ho-life-go-life.png"
```

- [ ] **Step 3: Reload page and verify no broken images**

Reload `http://localhost:3000`. Expected: no broken image icons anywhere. The hero card should show the first Printify tee image (updated by JS). The carousel images (`carousel-*.jpg`), lifestyle image, and logo are unaffected.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove obsolete local product PNGs (superseded by Printify CDN images)"
```

---

### Task 9: Deploy to Vercel and set environment variables

- [ ] **Step 1: Add Printify env vars to Vercel project**

```bash
vercel env add PRINTIFY_API_KEY
# Paste the API key when prompted
# Select: Production, Preview, Development

vercel env add PRINTIFY_SHOP_ID
# Type: 26847487
# Select: Production, Preview, Development
```

- [ ] **Step 2: Deploy to Vercel (preview)**

```bash
vercel
```

Expected: Vercel builds and deploys. Note the preview URL (e.g., `https://bottom-line-apparel-xxxx.vercel.app`).

- [ ] **Step 3: Test the live preview deployment**

Open the preview URL. Confirm:
- `/api/products` returns real Printify data (`curl https://YOUR-PREVIEW-URL.vercel.app/api/products | python3 -m json.tool`)
- All 4 tees display with Printify images
- Sticker shows in Accessories with "Coming Soon" badge
- Security headers are present

```bash
curl -I https://YOUR-PREVIEW-URL.vercel.app | grep -E "X-Frame|X-Content|CSP|Referrer"
```

Expected: all 4 security headers present in response.

- [ ] **Step 4: Deploy to production**

```bash
vercel --prod
```

- [ ] **Step 5: Final commit with deployment confirmation**

```bash
git add -A
git commit -m "chore: verified production deployment — Printify live, security headers active"
```

---

### Task 10: Final quality check

- [ ] **Step 1: Run Lighthouse audit**

Open Chrome DevTools → Lighthouse → run on the production URL. Target:
- Performance: ≥ 80 (Printify CDN images + no local PNGs helps significantly)
- Accessibility: ≥ 90
- SEO: ≥ 90
- Best Practices: ≥ 90

- [ ] **Step 2: Validate Open Graph tags**

Use `https://opengraph.xyz` to preview how the site looks when shared on social media. Confirm title, description, and image appear.

- [ ] **Step 3: Validate Schema.org markup**

Paste the production URL into Google's Rich Results Test. Confirm the `Organization` schema is detected without errors.

- [ ] **Step 4: Cross-browser smoke test**

Open on mobile (or DevTools mobile emulation). Confirm:
- Mobile nav opens/closes correctly
- Escape key closes nav
- Product cards render in single-column layout
- Accessories section visible below products
- No horizontal scroll on mobile

- [ ] **Step 5: Done ✅**

The site now has:
- Live Printify products (auto-refreshing every 5 minutes via Vercel edge cache)
- API key secured server-side
- Dark glassmorphism theme throughout
- Accessories section ready for future expansion
- Full SEO meta tags, OG tags, Schema.org
- Security headers and CSP on all routes
- Accessibility fixes (Escape nav, scoped arrow keys, ARIA labels)
- `prefers-reduced-motion` support
- All institutional quality issues resolved
