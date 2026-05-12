#!/usr/bin/env node
/**
 * Image optimization pass.
 *
 * Reads every carousel-*.{png,jpg,jpeg} and lifestyle-*.{png,jpg,jpeg} in the
 * project root and emits responsive AVIF + WebP derivatives at 480/960/1800
 * widths into ./optimized/:
 *
 *   - <name>-w480.{webp,avif}
 *   - <name>-w960.{webp,avif}
 *   - <name>-w1800.{webp,avif}
 *   - <name>.{webp,avif}        (legacy alias, equals the 1800w variant)
 *
 * The legacy unsuffixed file is kept so existing <picture> markup that
 * doesn't yet use srcset continues to work. Originals are left intact.
 *
 * Run:    npm run optimize:images
 * Update HTML <source srcset="optimized/carousel-1-w480.avif 480w, ...">
 */
import { readdir, mkdir, stat } from 'node:fs/promises';
import { join, parse } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT_DIR = join(ROOT, 'optimized');
const WIDTHS = [480, 960, 1800];
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
  const sourceWidth = meta.width || 0;

  const sizeReports = [];

  for (const width of WIDTHS) {
    const resized = sourceWidth > width
      ? base.clone().resize({ width, withoutEnlargement: true })
      : base.clone();
    const webpOut = join(OUT_DIR, `${name}-w${width}.webp`);
    const avifOut = join(OUT_DIR, `${name}-w${width}.avif`);
    await resized.clone().webp({ quality: 78, effort: 5 }).toFile(webpOut);
    await resized.clone().avif({ quality: 55, effort: 6 }).toFile(avifOut);
    const [w, a] = await Promise.all([stat(webpOut), stat(avifOut)]);
    sizeReports.push(`w${width}: webp ${fmtKB(w.size)} avif ${fmtKB(a.size)}`);
  }

  // Legacy unsuffixed filenames — equal to the 1800w variant. Keeps any old
  // markup working until every <picture> is migrated.
  const legacyResized = sourceWidth > 1800
    ? base.clone().resize({ width: 1800, withoutEnlargement: true })
    : base.clone();
  await legacyResized.clone().webp({ quality: 78, effort: 5 }).toFile(join(OUT_DIR, `${name}.webp`));
  await legacyResized.clone().avif({ quality: 55, effort: 6 }).toFile(join(OUT_DIR, `${name}.avif`));

  console.log(`${file}  ${fmtKB(srcStat.size).padStart(8)}  →  ${sizeReports.join('  ')}`);
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
