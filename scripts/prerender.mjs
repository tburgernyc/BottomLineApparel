#!/usr/bin/env node
// scripts/prerender.mjs
// Post-build prerender step. Reads the Vite-built dist/index.html (so hashed
// asset paths are correct), splits it on PRERENDER:HEAD / PRERENDER:MAIN
// sentinels, and emits per-route HTML alongside robots.txt + sitemap.xml.
//
// PR 1 scope: emit only robots.txt + sitemap.xml containing `/`.
// Future PRs (2–6) will call emitRoute() for /about, /collections/*,
// /products/*, /blog/*, etc.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const SITE_URL = 'https://bottomlineapparel.com';
const DIST = 'dist';
const SHELL_PATH = join(DIST, 'index.html');

const HEAD_SENTINEL = '<!-- PRERENDER:HEAD -->';
const MAIN_SENTINEL = '<!-- PRERENDER:MAIN -->';

function readShell() {
  return readFileSync(SHELL_PATH, 'utf8');
}

/**
 * Split the shell into head, mainShell (home content between <main>...</main>),
 * and footer (everything after </main>). Sentinels are preserved at the split
 * points so emitRoute() can reconstruct cleanly.
 *
 * Layout:
 *   ...head...<!-- PRERENDER:HEAD --></head><body data-route="home">...
 *     <main>... home main ... <!-- PRERENDER:MAIN --></main>
 *   ...scripts/footer...
 *
 * Returns:
 *   - headBlock: everything up to and including HEAD_SENTINEL
 *   - homeMain: home's <main> contents up to but excluding MAIN_SENTINEL
 *     (used as default if a route doesn't supply its own main HTML)
 *   - footerBlock: MAIN_SENTINEL + everything after
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
  const headBlock = html.slice(0, headIdx + HEAD_SENTINEL.length);
  const homeMain = html.slice(headIdx + HEAD_SENTINEL.length, mainIdx);
  const footerBlock = html.slice(mainIdx);
  return { headBlock, homeMain, footerBlock };
}

/**
 * Emit a route's index.html. The split shell's head and footer are reused so
 * hashed asset paths and shared scripts stay consistent across routes.
 *
 * @param {string} route          e.g. '/about/' or '/collections/tees/'
 * @param {object} opts
 * @param {string} opts.dataRoute body data-route attribute (e.g. 'about', 'collection', 'product')
 * @param {string} opts.title     <title> override (replaces existing in head)
 * @param {string} opts.description meta description override
 * @param {string} opts.canonical canonical URL (defaults to SITE_URL + route)
 * @param {string} opts.mainHtml  HTML to inject between <main> and </main>
 * @param {string[]} [opts.schemaJsonLd] additional JSON-LD blocks to inject before </head>
 */
function emitRoute(route, opts, split) {
  const { headBlock, footerBlock } = split;
  const dataRoute = opts.dataRoute || 'page';
  const canonical = opts.canonical || `${SITE_URL}${route}`;

  let head = headBlock;
  if (opts.title) {
    head = head.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(opts.title)}</title>`);
  }
  if (opts.description) {
    head = head.replace(
      /<meta name="description" content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${escapeAttr(opts.description)}" />`,
    );
  }
  head = head.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
  );
  if (opts.schemaJsonLd && opts.schemaJsonLd.length) {
    const blocks = opts.schemaJsonLd
      .map(s => `<script type="application/ld+json">${s}</script>`)
      .join('\n');
    head = head.replace(HEAD_SENTINEL, `${blocks}\n${HEAD_SENTINEL}`);
  }

  const body = `<body data-route="${escapeAttr(dataRoute)}">`;
  const footerWithBody = footerBlock.replace(/<body[^>]*>/, body);

  const main = `<main id="main-content" tabindex="-1">\n${opts.mainHtml || ''}\n`;

  // Reconstruction: head ... </head><body data-route="..."> + main + footer-from-MAIN
  // The original shell's <body> tag is in headBlock — we need to swap it.
  const headWithBody = head.replace(/<body[^>]*>/, body);
  const html = `${headWithBody}\n${main}${footerWithBody}`;

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

function escapeHtml(s) {
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

function main() {
  const shell = readShell();
  const split = splitShell(shell);
  // Sanity: the split must succeed on the home shell so future routes can rely on it.
  if (!split.homeMain.length) {
    throw new Error('prerender: home main slice is empty — sentinels may be adjacent');
  }
  // Future PRs: emitRoute('/about/', { ... }, split); etc.
  // emitRoute is exported below for that purpose.

  const routes = ['/'];
  emitRobots();
  emitSitemap(routes);
  console.log(`prerender: emitted dist/robots.txt and dist/sitemap.xml (${routes.length} URL${routes.length === 1 ? '' : 's'}).`);
}

export { readShell, splitShell, emitRoute, emitRobots, emitSitemap, SITE_URL, DIST };

main();
