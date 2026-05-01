// api/_printful.js
// Printful shapers — extracted from api/products.js so future endpoints
// (e.g. per-product detail, prerender-time hydration) can reuse them
// without duplicating logic.
//
// Vercel ignores files prefixed with `_` for routing — this is a shared
// module, not an HTTP endpoint.
// Ref: https://vercel.com/docs/projects/project-configuration#ignored-files

// Default preferred colors for the main product card image
const DEFAULT_PREFERRED_COLORS = ['white', 'solid white', 'gray', 'grey', 'heather gray', 'heather grey', 'ash', 'silver', 'light gray', 'light grey', 'oatmeal'];

// Per-product color overrides — matched by product name keywords
const COLOR_OVERRIDES = [
  { keywords: ['crop hoodie'],  colors: ['storm'] },
  { keywords: ['sweatpant', 'jogger'], colors: ['athletic heather', 'heather', 'gray', 'grey'] },
];

/**
 * Get the preferred color list for a specific product name.
 */
function getPreferredColors(productName) {
  const lower = (productName || '').toLowerCase();
  for (const rule of COLOR_OVERRIDES) {
    if (rule.keywords.some(k => lower.includes(k))) return rule.colors;
  }
  return DEFAULT_PREFERRED_COLORS;
}

function isPreferredColor(variant, preferredColors) {
  // Check the variant's product name for color info (e.g. "... (Solid White Triblend / XS)")
  const rawName = (variant.product?.name || variant.name || '').toLowerCase();
  const colorMatch = rawName.match(/\(([^()]+)\)\s*$/);
  if (colorMatch) {
    const colorPart = colorMatch[1].split('/')[0].trim().toLowerCase();
    if (preferredColors.some(c => colorPart.includes(c))) return true;
  }
  // Also check the variant's color field if present
  const color = (variant.color || '').toLowerCase();
  if (color && preferredColors.some(c => color.includes(c))) return true;
  return false;
}

/**
 * Get the preview mockup image for a variant.
 * Returns { url, isFront } where isFront indicates the filename contains 'front'.
 */
export function getVariantPreview(variant) {
  const files = variant.files || [];
  const preview = files.find(f => f.type === 'preview');
  if (!preview || !preview.preview_url) return null;
  const filename = (preview.filename || '').toLowerCase();
  const isFront = filename.includes('front');
  return { url: preview.preview_url, isFront };
}

/**
 * Select the best product card image from all variants.
 * Priority:
 *   1. Preferred-color variant with a FRONT-facing preview
 *   2. Any variant with a FRONT-facing preview
 *   3. Preferred-color variant with any preview
 *   4. Any variant with any preview
 *   5. Product thumbnail
 */
export function bestProductImage(syncProduct, syncVariants) {
  const enabled = (syncVariants || []).filter(v => v.is_enabled !== false && !v.is_ignored);
  const preferredColors = getPreferredColors(syncProduct.name);

  // Pass 1: preferred color + front-facing preview
  for (const variant of enabled) {
    if (isPreferredColor(variant, preferredColors)) {
      const p = getVariantPreview(variant);
      if (p && p.isFront) return p.url;
    }
  }

  // Pass 2: any color + front-facing preview
  for (const variant of enabled) {
    const p = getVariantPreview(variant);
    if (p && p.isFront) return p.url;
  }

  // Pass 3: preferred color + any preview (even back)
  for (const variant of enabled) {
    if (isPreferredColor(variant, preferredColors)) {
      const p = getVariantPreview(variant);
      if (p) return p.url;
    }
  }

  // Pass 4: any preview at all
  for (const variant of enabled) {
    const p = getVariantPreview(variant);
    if (p) return p.url;
  }

  return syncProduct.thumbnail_url || null;
}

/**
 * Get the best image for an individual variant (used in variant picker).
 */
function variantImage(variant) {
  const p = getVariantPreview(variant);
  if (p) return p.url;
  return variant.product?.image || null;
}

export function extractShortDescription(html) {
  if (!html) return '';
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const match = text.match(/^.+?[.!?](?:\s|$)/);
  return match ? match[0].trim() : text.slice(0, 120);
}

export function extractDescriptionText(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function classify(name) {
  const lower = (name || '').toLowerCase();
  const rules = [
    { keywords: ['crop hoodie'], category: 'hoodies' },
    { keywords: ['crop top', 'crop tee'], category: 'cropTops' },
    { keywords: ['sweatpant', 'jogger', 'pant'], category: 'bottoms' },
    { keywords: ['hoodie', 'sweat', 'zip'], category: 'hoodies' },
    { keywords: ['tank'], category: 'tanks' },
    { keywords: ['phone', 'case'], category: 'phoneCases' },
    { keywords: ['hat', 'cap', 'beanie'], category: 'headwear' },
    { keywords: ['shoe', 'slide', 'sneaker'], category: 'footwear' },
    { keywords: ['tee', 't-shirt', 'shirt'], category: 'tshirts' },
  ];
  for (const rule of rules) {
    if (rule.keywords.some(k => lower.includes(k))) return rule.category;
  }
  return 'accessories';
}

const SIZE_TOKENS = new Set([
  'xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', '4xl', '5xl',
  'one size', 'os',
]);

// Printful's sync_variant.product.name embeds the variant info inside the LAST
// parenthesized group, e.g. "Bella + Canvas 3413 Unisex Tee (Navy Triblend / XS)".
// Strip the garment description and return just what's inside the last (...).
function extractVariantInfo(rawLabel) {
  if (!rawLabel) return '';
  const m = rawLabel.match(/\(([^()]+)\)\s*$/);
  return m ? m[1].trim() : rawLabel.trim();
}

// Parse the cleaned variant info ("Navy Triblend / XS" or "Matte / iPhone 14"
// or "16 oz"). Printful's convention is "Color / Size" — we trust that order
// for 2-part labels rather than guessing which side is which.
function parseVariantLabel(rawLabel) {
  const cleaned = extractVariantInfo(rawLabel);
  if (!cleaned) return { color: null, size: null, label: '' };
  const parts = cleaned.split('/').map(s => s.trim()).filter(Boolean);
  if (parts.length === 1) {
    const lower = parts[0].toLowerCase();
    const looksLikeSize = SIZE_TOKENS.has(lower) || /^\d+(\.\d+)?$/.test(parts[0]);
    if (looksLikeSize) return { color: null, size: parts[0], label: cleaned };
    return { color: parts[0], size: null, label: cleaned };
  }
  return {
    color: parts[0],
    size: parts.slice(1).join(' / '),
    label: cleaned,
  };
}

export function shapeVariant(syncVariant) {
  const price = parseFloat(syncVariant.retail_price);
  const rawLabel = syncVariant.product?.name || syncVariant.name || '';
  const { color, size, label } = parseVariantLabel(rawLabel);
  return {
    id: syncVariant.id, // sync_variant_id — what /api/checkout takes
    label, // cleaned, e.g. "Navy Triblend / XS"
    color,
    size,
    price: Number.isFinite(price) ? price : null,
    image: variantImage(syncVariant),
    sku: syncVariant.sku || null,
  };
}

export function shapeProduct(syncProduct, syncVariants) {
  const enabled = (syncVariants || []).filter(v => v.is_enabled !== false && !v.is_ignored);
  if (!enabled.length) return null;

  const variants = enabled.map(shapeVariant).filter(v => v.price !== null);
  if (!variants.length) return null;

  const prices = variants.map(v => v.price);
  return {
    id: syncProduct.id,
    title: syncProduct.name,
    short_description: extractShortDescription(syncProduct.description || ''),
    description_html: syncProduct.description || '',
    description_text: extractDescriptionText(syncProduct.description || ''),
    min_price: Math.min(...prices),
    max_price: Math.max(...prices),
    image: bestProductImage(syncProduct, syncVariants),
    category: classify(syncProduct.name),
    variants,
  };
}
