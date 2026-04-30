#!/usr/bin/env node
/**
 * Image optimization pass.
 *
 * Reads every carousel-*.{png,jpg,jpeg} and lifestyle-*.{png,jpg,jpeg} in the
 * project root and emits two derivatives per source into ./optimized/:
 *
 *   - <name>.webp  (q=78, ~modern browsers)
 *   - <name>.avif  (q=55, ~best compression)
 *
 * It also resizes anything wider than 1800px down to 1800px wide (carousels
 * never display larger than that in our layout). Originals are left intact.
 *
 * Run:    npm run optimize:images
 * Output: ./optimized/<name>.{webp,avif}
 *
 * Update HTML to use <picture><source type="image/avif"…><source type="image/webp"…><img …></picture>
 * after running.
 */
import { readdir, mkdir, stat } from 'node:fs/promises';
import { join, parse } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT_DIR = join(ROOT, 'optimized');
const MAX_WIDTH = 1800;
const TARGETS = /^(carousel|lifestyle).*\.(png|jpe?g)$/i;

async function ensureDir(dir) {
  try { await mkdir(dir, { recursive: true }); } catch {}
}

function fmtKB(bytes) {
  return `${(bytes / 1024).toFixed(0)}KB`;
}

async function processOne(file) {
  const src = join(ROOT, file);
  const { name } = parse(file);
  const srcStat = await stat(src);

  const base = sharp(src).rotate();
  const meta = await base.metadata();
  const resized = (meta.width || 0) > MAX_WIDTH
    ? base.resize({ width: MAX_WIDTH, withoutEnlargement: true })
    : base;

  const webpOut = join(OUT_DIR, `${name}.webp`);
  const avifOut = join(OUT_DIR, `${name}.avif`);

  await resized.clone().webp({ quality: 78, effort: 5 }).toFile(webpOut);
  await resized.clone().avif({ quality: 55, effort: 6 }).toFile(avifOut);

  const [w, a] = await Promise.all([stat(webpOut), stat(avifOut)]);
  const orig = fmtKB(srcStat.size);
  console.log(
    `${file}  ${orig.padStart(8)}  →  webp ${fmtKB(w.size).padStart(7)}  avif ${fmtKB(a.size).padStart(7)}`
  );
}

async function main() {
  await ensureDir(OUT_DIR);
  const entries = await readdir(ROOT);
  const targets = entries.filter(f => TARGETS.test(f));
  if (!targets.length) {
    console.log('No carousel-* or lifestyle-* images found at project root.');
    return;
  }
  console.log(`Optimizing ${targets.length} images → ${OUT_DIR}`);
  for (const f of targets) {
    try { await processOne(f); }
    catch (err) { console.error(`FAILED ${f}: ${err.message}`); }
  }
  console.log('\nNext: replace <img src="carousel-N.png"> with <picture><source type="image/avif" srcset="optimized/carousel-N.avif"><source type="image/webp" srcset="optimized/carousel-N.webp"><img src="carousel-N.png" loading="lazy"></picture>');
}

main();
