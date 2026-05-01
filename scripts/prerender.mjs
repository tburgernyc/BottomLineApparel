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

function main() {
  const shell = readShell();
  const split = splitShell(shell);
  if (!split.chromeAfterBodyOpen.length) {
    throw new Error('prerender: chrome slice is empty — sentinels and structure may be out of sync');
  }

  const routes = ['/'];
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
