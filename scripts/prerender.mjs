#!/usr/bin/env node
// scripts/prerender.mjs
// Post-build prerender step. Reads the Vite-built dist/index.html (so hashed
// asset paths are correct), splits it on PRERENDER:HEAD / PRERENDER:MAIN
// sentinels (plus the </head>, <body>, <main> structural anchors), and
// emits per-route HTML alongside robots.txt + sitemap.xml.
//
// PR 1 scope: emit only robots.txt + sitemap.xml containing `/`.
// Future PRs (2–6) will call emitRoute() for /about, /collections/*,
// /products/*, /blog/*, etc.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { organizationSchema, breadcrumbSchema, faqSchema, productSchema } from './schema.mjs';
import { getProductsData } from '../api/products.js';
import { renderOrbitCard, renderProductCard, renderAccessoryCard } from './_card-renderers.mjs';

const SITE_URL = 'https://bottomlineapparel.com';
const DIST = 'dist';
const SHELL_PATH = join(DIST, 'index.html');
const CONTENT_PAGES_DIR = 'content/pages';
const CONTENT_COLLECTIONS_DIR = 'content/collections';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD').replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function uniqueSlug(title, productId, taken) {
  const base = slugify(title) || 'product';
  if (!taken.has(base)) return base;
  // Append last 4 chars of productId for stability across builds.
  const suffix = String(productId).slice(-4);
  const withSuffix = `${base}-${suffix}`;
  if (!taken.has(withSuffix)) return withSuffix;
  // Last resort: numeric counter.
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

const HEAD_SENTINEL = '<!-- PRERENDER:HEAD -->';
const MAIN_SENTINEL = '<!-- PRERENDER:MAIN -->';

function readShell() {
  return readFileSync(SHELL_PATH, 'utf8');
}

/**
 * Split the shell into the four pieces a non-home route needs to be
 * reconstructed:
 *
 *   [headBlock]
 *     ...everything from start of file through </head> (inclusive).
 *     Includes the HEAD_SENTINEL near the end so schema injection has an
 *     anchor.
 *
 *   [chromeAfterBodyOpen]
 *     Everything after the source <body...> tag up to and including the
 *     <main id="main-content"...> opening tag. This is the announcement
 *     bar / header / cart drawer / modals — content that should appear
 *     identically on every prerendered route.
 *
 *   [homeMainInner]
 *     The home's inner <main> content, between the <main> opener and the
 *     MAIN_SENTINEL. Used as the default if a route doesn't supply its
 *     own mainHtml.
 *
 *   [mainCloseAndFooter]
 *     From </main> through end of file. The MAIN_SENTINEL itself is
 *     stripped (it's just a marker, not content).
 *
 * Throws on any missing / out-of-order anchor so build fails loud rather
 * than silently emitting broken HTML.
 */
function splitShell(html) {
  const headIdx = html.indexOf(HEAD_SENTINEL);
  if (headIdx === -1) {
    throw new Error(`prerender: ${HEAD_SENTINEL} sentinel not found in ${SHELL_PATH}`);
  }
  const mainIdx = html.indexOf(MAIN_SENTINEL);
  if (mainIdx === -1) {
    throw new Error(`prerender: ${MAIN_SENTINEL} sentinel not found in ${SHELL_PATH}`);
  }
  if (mainIdx < headIdx) {
    throw new Error(`prerender: sentinels are out of order in ${SHELL_PATH}`);
  }

  const headCloseIdx = html.indexOf('</head>', headIdx);
  if (headCloseIdx === -1) {
    throw new Error('prerender: </head> not found after PRERENDER:HEAD sentinel');
  }
  const headEnd = headCloseIdx + '</head>'.length;

  const bodyOpenMatch = html.slice(headEnd).match(/<body[^>]*>/i);
  if (!bodyOpenMatch) {
    throw new Error('prerender: <body> tag not found after </head>');
  }
  const bodyOpenStart = headEnd + bodyOpenMatch.index;
  const bodyOpenEnd = bodyOpenStart + bodyOpenMatch[0].length;

  const chromeSlice = html.slice(bodyOpenEnd, mainIdx);
  const mainOpenMatch = chromeSlice.match(/<main[^>]*>/i);
  if (!mainOpenMatch) {
    throw new Error('prerender: <main> opening tag not found between <body> and PRERENDER:MAIN');
  }
  const mainOpenAbs = bodyOpenEnd + mainOpenMatch.index;
  const mainOpenEnd = mainOpenAbs + mainOpenMatch[0].length;

  const headBlock = html.slice(0, headEnd);
  const chromeAfterBodyOpen = html.slice(bodyOpenEnd, mainOpenEnd);
  const homeMainInner = html.slice(mainOpenEnd, mainIdx);
  const mainCloseAndFooter = html.slice(mainIdx + MAIN_SENTINEL.length);

  return { headBlock, chromeAfterBodyOpen, homeMainInner, mainCloseAndFooter };
}

/**
 * Replace via regex; throw if the regex didn't match. Same loud-failure
 * ethos as splitShell — if the source HTML drifts and a replacement
 * silently no-ops, every emitted route would inherit the home's title /
 * description / canonical. Preferable to fail the build.
 */
function replaceOrThrow(html, regex, replacement, what) {
  if (!regex.test(html)) {
    throw new Error(`prerender: regex for "${what}" did not match — source HTML may have drifted`);
  }
  return html.replace(regex, replacement);
}

/**
 * Emit a route's index.html. The split shell's head, chrome, and footer
 * are reused so hashed asset paths and shared scripts stay consistent
 * across routes.
 *
 * @param {string} route          e.g. '/about/' or '/collections/tees/'
 * @param {object} opts
 * @param {string} opts.dataRoute body data-route attribute (e.g. 'page', 'collection', 'product')
 * @param {string} opts.title     <title> override
 * @param {string} opts.description meta description override
 * @param {string} [opts.canonical] canonical URL (defaults to SITE_URL + route)
 * @param {string} opts.mainHtml  HTML to inject between <main>...</main>
 * @param {string[]} [opts.schemaJsonLd] additional JSON-LD blocks to inject before </head>
 * @param {object} split          result of splitShell()
 */
function emitRoute(route, opts, split) {
  const { headBlock, chromeAfterBodyOpen, mainCloseAndFooter } = split;
  const dataRoute = opts.dataRoute || 'page';
  const canonical = opts.canonical || `${SITE_URL}${route}`;

  let head = headBlock;

  if (opts.title) {
    head = replaceOrThrow(
      head,
      /<title>[^<]*<\/title>/i,
      `<title>${escapeHtmlText(opts.title)}</title>`,
      '<title>',
    );
  }

  if (opts.description) {
    head = replaceOrThrow(
      head,
      /<meta name="description" content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${escapeAttr(opts.description)}" />`,
      'meta description',
    );
  }

  head = replaceOrThrow(
    head,
    /<link rel="canonical" href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
    'canonical link',
  );

  if (opts.schemaJsonLd && opts.schemaJsonLd.length) {
    const blocks = opts.schemaJsonLd
      .map(s => `<script type="application/ld+json">${s}</script>`)
      .join('\n');
    head = replaceOrThrow(
      head,
      new RegExp(escapeRegex(HEAD_SENTINEL)),
      `${blocks}\n${HEAD_SENTINEL}`,
      'PRERENDER:HEAD sentinel',
    );
  }

  const bodyOpen = `<body data-route="${escapeAttr(dataRoute)}">`;
  const html = `${head}\n${bodyOpen}${chromeAfterBodyOpen}\n${opts.mainHtml || ''}\n${mainCloseAndFooter}`;

  const outPath = join(DIST, route.replace(/^\/|\/$/g, ''), 'index.html');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf8');
}

function emitRobots() {
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
  writeFileSync(join(DIST, 'robots.txt'), body, 'utf8');
}

function emitSitemap(routes) {
  if (!routes.length) {
    throw new Error('prerender: refusing to emit empty sitemap.xml');
  }
  const today = new Date().toISOString().slice(0, 10);
  const urls = routes
    .map(route => {
      const loc = route === '/' ? SITE_URL + '/' : `${SITE_URL}${route}`;
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  writeFileSync(join(DIST, 'sitemap.xml'), xml, 'utf8');
}

// Text-context HTML escaping. Use escapeAttr inside attribute values.
function escapeHtmlText(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function escapeXml(s) {
  return String(s).replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Render the optional `faqs` frontmatter array as a native
 * <details>/<summary> accordion. No JS required — browsers handle
 * open/close natively, and the accordion is fully crawlable. Q/A text is
 * passed through markdown-it inline so light formatting (links, em, code)
 * still works inside an answer.
 */
function renderFaqAccordion(faqs) {
  if (!Array.isArray(faqs) || faqs.length === 0) return '';
  const items = faqs
    .map(f => {
      const q = escapeHtmlText(String(f.q ?? ''));
      const a = md.renderInline(String(f.a ?? ''));
      return `      <details class="faq-item">\n        <summary>${q}</summary>\n        <div class="faq-answer"><p>${a}</p></div>\n      </details>`;
    })
    .join('\n');
  return `\n    <div class="faq-list">\n${items}\n    </div>\n`;
}

/**
 * Read content/pages/*.md, parse frontmatter + body, and call emitRoute()
 * for each. Returns the list of emitted routes so they can be added to
 * the sitemap.
 */
function emitContentPages(split) {
  let entries;
  try {
    entries = readdirSync(CONTENT_PAGES_DIR);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.warn(`prerender: ${CONTENT_PAGES_DIR}/ does not exist; skipping content pages.`);
      return [];
    }
    throw err;
  }

  const mdFiles = entries.filter(f => f.endsWith('.md')).sort();
  const emitted = [];

  for (const file of mdFiles) {
    const filePath = join(CONTENT_PAGES_DIR, file);
    const raw = readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    const fm = parsed.data || {};

    const slug = String(fm.slug || file.replace(/\.md$/, ''));
    const title = String(fm.title || '');
    const description = String(fm.description || '');
    const h1 = String(fm.h1 || title);

    if (!slug || !title || !description || !h1) {
      throw new Error(
        `prerender: ${filePath} missing required frontmatter (slug/title/description/h1).`,
      );
    }

    const route = `/${slug}/`;
    const bodyHtml = md.render(parsed.content || '');
    const faqsHtml = renderFaqAccordion(fm.faqs);

    const mainHtml = [
      '<div class="container">',
      '  <article class="prose">',
      `    <h1>${escapeHtmlText(h1)}</h1>`,
      bodyHtml,
      faqsHtml,
      '  </article>',
      '</div>',
    ].join('\n');

    const crumbs = [
      { name: 'Home', url: `${SITE_URL}/` },
      { name: h1, url: `${SITE_URL}${route}` },
    ];
    const schemaJsonLd = [organizationSchema(), breadcrumbSchema(crumbs)];
    if (Array.isArray(fm.faqs) && fm.faqs.length) {
      schemaJsonLd.push(faqSchema(fm.faqs));
    }

    emitRoute(
      route,
      { dataRoute: 'page', title, description, mainHtml, schemaJsonLd },
      split,
    );
    emitted.push(route);
    console.log(`prerender: emitted dist${route}index.html`);
  }

  return emitted;
}

/**
 * Read content/collections/*.md, parse frontmatter + body, and call emitRoute()
 * for each. Generates the grid container for JS to hydrate.
 */
function emitCollectionPages(split, groupedProducts, slugIndex) {
  let entries;
  try {
    entries = readdirSync(CONTENT_COLLECTIONS_DIR);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.warn(`prerender: ${CONTENT_COLLECTIONS_DIR}/ does not exist; skipping collection pages.`);
      return [];
    }
    throw err;
  }

  const mdFiles = entries.filter(f => f.endsWith('.md')).sort();
  const emitted = [];

  for (const file of mdFiles) {
    const filePath = join(CONTENT_COLLECTIONS_DIR, file);
    const raw = readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    const fm = parsed.data || {};

    const slug = String(fm.slug || file.replace(/\.md$/, ''));
    const title = String(fm.title || '');
    const description = String(fm.description || '');
    const h1 = String(fm.h1 || title);
    const gridId = String(fm.gridId || '');
    const gridClass = String(fm.gridClass || '');

    if (!slug || !title || !description || !h1 || !gridId || !gridClass) {
      throw new Error(
        `prerender: ${filePath} missing required frontmatter (slug/title/description/h1/gridId/gridClass).`
      );
    }

    const route = `/collections/${slug}/`;
    const bodyHtml = md.render(parsed.content || '');

    const mainHtml = [
      '<div class="container" style="padding-top: 120px; padding-bottom: 80px;">',
      '  <article class="prose" style="margin-bottom: 3rem; text-align: center;">',
      `    <h1 class="lux-title">${escapeHtmlText(h1)}</h1>`,
      bodyHtml,
      '  </article>',
      `  <div class="${escapeAttr(gridClass)}" id="${escapeAttr(gridId)}" aria-label="${escapeAttr(h1)} products">`,
      (function(){
        const JS_CAT_MAP = { 'tshirts': 'tshirts', 'crop-tops': 'cropTops', 'tanks': 'tanks', 'hoodies': 'hoodies', 'bottoms': 'bottoms', 'phone-cases': 'phoneCases', 'headwear': 'headwear', 'footwear': 'footwear', 'accessories': 'accessories' };
        const jsCat = JS_CAT_MAP[slug];
        const items = groupedProducts[jsCat] || [];
        let renderer = renderAccessoryCard;
        if (jsCat === 'tshirts' || jsCat === 'cropTops') renderer = renderOrbitCard;
        else if (['tanks', 'hoodies', 'bottoms'].includes(jsCat)) renderer = renderProductCard;
        return items.map(p => renderer(p, slugIndex)).join('\\n');
      })(),
      `  </div>`,
      '</div>',
    ].join('\n');

    const crumbs = [
      { name: 'Home', url: `${SITE_URL}/` },
      { name: 'Collections', url: `${SITE_URL}/#tshirts` },
      { name: h1, url: `${SITE_URL}${route}` },
    ];
    const schemaJsonLd = [organizationSchema(), breadcrumbSchema(crumbs)];

    emitRoute(
      route,
      { dataRoute: 'collection', title, description, mainHtml, schemaJsonLd },
      split,
    );
    emitted.push(route);
    console.log(`prerender: emitted dist${route}index.html`);
  }

  return emitted;
}

function emitProductPages(allProds, split, slugIndex) {
  const emitted = [];
  const CONTENT_PRODUCTS_DIR = 'content/products';

  for (const product of allProds) {
    const slug = slugIndex[product.id].slug;
    const route = `/products/${slug}/`;
    
    let overrideBody = '';
    const overridePath = join(CONTENT_PRODUCTS_DIR, `${slug}.md`);
    if (existsSync(overridePath)) {
      const raw = readFileSync(overridePath, 'utf8');
      const parsed = matter(raw);
      overrideBody = md.render(parsed.content || '');
    }
    
    const descriptionHtml = overrideBody || product.description_html;
    const wordCount = descriptionHtml.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length;
    if (wordCount < 250 && !overrideBody) {
      console.warn(`prerender warning: Product ${product.id} (${slug}) has thin description (${wordCount} words).`);
    }

    const categoryTitle = product.category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    const catSlugMap = {
      tshirts: 'tshirts', cropTops: 'crop-tops', tanks: 'tanks', hoodies: 'hoodies',
      bottoms: 'bottoms', phoneCases: 'phone-cases', headwear: 'headwear', footwear: 'footwear', accessories: 'accessories'
    };
    const catRouteSlug = catSlugMap[product.category] || 'accessories';

    const priceDisplay = product.min_price === product.max_price
      ? `$${product.min_price.toFixed(2)}`
      : `From $${product.min_price.toFixed(2)}`;

    const gridClass = (product.category === 'tshirts' || product.category === 'cropTops') ? 'orbit-grid' : 'products-grid';
    let renderer = renderAccessoryCard;
    if (product.category === 'tshirts' || product.category === 'cropTops') renderer = renderOrbitCard;
    else if (['tanks', 'hoodies', 'bottoms'].includes(product.category)) renderer = renderProductCard;

    const related = allProds.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
    let relatedHtml = '';
    if (related.length > 0) {
      relatedHtml = [
        '  <section class="pdp-related" style="margin-top: 5rem;">',
        '    <h2 style="text-align: center; margin-bottom: 2rem;">More from this collection</h2>',
        `    <div class="${escapeAttr(gridClass)}">`,
        related.map(p => renderer(p, slugIndex)).join('\\n'),
        '    </div>',
        '  </section>'
      ].join('\\n');
    }

    const mainHtml = [
      '<article class="pdp container" style="padding-top: 120px; padding-bottom: 80px;">',
      '  <nav class="breadcrumbs" aria-label="Breadcrumb" style="margin-bottom: 2rem;">',
      `    <a href="/">Home</a> › <a href="/collections/${catRouteSlug}/">${escapeHtmlText(categoryTitle)}</a> › <span>${escapeHtmlText(product.title)}</span>`,
      '  </nav>',
      '  <div class="pdp-hero" style="display: flex; gap: 4rem; margin-bottom: 4rem; align-items: flex-start; flex-wrap: wrap;">',
      '    <picture class="pdp-image" style="flex: 1; min-width: 300px;">',
      `      <img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.title)}" width="900" height="900" loading="eager" style="width: 100%; height: auto; border-radius: 8px;" />`,
      '    </picture>',
      '    <div class="pdp-info" style="flex: 1; min-width: 300px;">',
      `      <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">${escapeHtmlText(product.title)} by Bottom Line Apparel</h1>`,
      `      <p class="pdp-price" style="font-size: 1.5rem; font-weight: bold; margin-bottom: 2rem;">${priceDisplay}</p>`,
      `      <button id="pdp-buy-btn" class="btn btn--primary" data-product-id="${product.id}">Choose Options</button>`,
      '    </div>',
      '  </div>',
      '  <section class="pdp-description prose" style="max-width: 800px; margin: 0 auto;">',
      '    <h2>About this piece</h2>',
      `    ${descriptionHtml}`,
      '  </section>',
      relatedHtml,
      `  <script type="application/json" id="bla-product">\n${JSON.stringify({ ...product, slug }).replace(/<\/script>/gi, '<\\/script>')}\n  </script>`,
      '</article>'
    ].join('\n');

    const crumbs = [
      { name: 'Home', url: `${SITE_URL}/` },
      { name: categoryTitle, url: `${SITE_URL}/collections/${catRouteSlug}/` },
      { name: product.title, url: `${SITE_URL}${route}` }
    ];
    
    product.slug = slug; 

    const schemaJsonLd = [
      organizationSchema(),
      breadcrumbSchema(crumbs),
      productSchema(product)
    ];

    emitRoute(
      route,
      { dataRoute: 'product', title: product.title, description: product.short_description, mainHtml, schemaJsonLd },
      split
    );
    emitted.push(route);
    console.log(`prerender: emitted dist${route}index.html`);
  }
  return emitted;
}

async function main() {
  const shell = readShell();
  const split = splitShell(shell);
  if (!split.chromeAfterBodyOpen.length) {
    throw new Error('prerender: chrome slice is empty — sentinels and structure may be out of sync');
  }

  // Fetch product data and generate slug index
  const groupedProducts = await getProductsData();
  const allProds = Object.values(groupedProducts).flat();
  
  const indexFile = join(DIST, 'products', '_index.json');
  let oldIndex = {};
  if (existsSync(indexFile)) {
    try {
      oldIndex = JSON.parse(readFileSync(indexFile, 'utf8'));
    } catch(e) {}
  }
  
  const takenSlugs = new Set();
  const slugIndex = {};
  
  // First pass: preserve existing slugs
  for (const p of allProds) {
    const old = oldIndex[p.id];
    if (old && old.slug && !takenSlugs.has(old.slug)) {
      takenSlugs.add(old.slug);
      slugIndex[p.id] = { slug: old.slug, title: p.title, image: p.image };
    }
  }
  
  // Second pass: generate new slugs
  for (const p of allProds) {
    if (!slugIndex[p.id]) {
      const s = uniqueSlug(p.title, p.id, takenSlugs);
      takenSlugs.add(s);
      slugIndex[p.id] = { slug: s, title: p.title, image: p.image };
    }
  }
  
  mkdirSync(dirname(indexFile), { recursive: true });
  writeFileSync(indexFile, JSON.stringify(slugIndex, null, 2), 'utf8');

  const contentRoutes = emitContentPages(split);
  const collectionRoutes = emitCollectionPages(split, groupedProducts, slugIndex);
  const productRoutes = emitProductPages(allProds, split, slugIndex);

  const routes = ['/', ...contentRoutes, ...collectionRoutes, ...productRoutes];
  emitRobots();
  emitSitemap(routes);
  console.log(`prerender: emitted dist/robots.txt and dist/sitemap.xml (${routes.length} URL${routes.length === 1 ? '' : 's'}).`);
}

export {
  readShell, splitShell, emitRoute, emitRobots, emitSitemap,
  escapeHtmlText, escapeAttr, escapeXml,
  SITE_URL, DIST, HEAD_SENTINEL, MAIN_SENTINEL,
};

main();
