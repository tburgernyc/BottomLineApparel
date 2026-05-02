import { escapeHtml, escapeAttr } from '../utils/helpers';
import { openCheckoutModal } from '../ui/modals';
import { observeNewReveals } from '../interactions/scroll';
import { track } from '../analytics/analytics';

export interface Variant {
    id: number;
    label: string;
    color: string | null;
    size: string | null;
    price: number;
    image: string | null;
    sku: string | null;
}

export interface Product {
    id: number;
    title: string;
    slug?: string;
    short_description: string;
    min_price: number;
    max_price: number;
    image: string;
    category: string;
    variants: Variant[];
}

export let allProducts: Record<string, Product[]> = {};

declare global {
  interface Window {
    slugIndex?: Record<string, { slug: string; title: string; image: string }>;
  }
}

// The slug map is { id: { slug, title, image } } both at build time
// (passed in from prerender) and at runtime (loaded from
// /products/_index.json into window.slugIndex). The renderers used to
// template-interpolate the entry directly, which produced
// `/products/[object Object]/`. Always extract `.slug` here.
type SlugMap = Record<string, { slug: string } | undefined>;

function pickHref(product: Product, slugIndex?: SlugMap) {
  const entry = slugIndex && slugIndex[product.id];
  const slug = entry?.slug ?? product.slug;
  return slug ? `/products/${slug}/` : '#';
}

function priceDisplay(p: Product) {
  if (p.min_price === p.max_price) return `$${p.min_price.toFixed(2)}`;
  return `From $${p.min_price.toFixed(2)}`;
}

/**
 * Render a 3D Orbit Card for T-shirts.
 */
export function renderOrbitCard(product: Product, slugIndex?: SlugMap) {
  const href = pickHref(product, slugIndex);
  return `
    <article class="orbit-card reveal"
             data-product-id="${product.id}">
      <div class="orbit-card__inner">
        <!-- Front Face -->
        <div class="orbit-card__front">
          <a href="${href}" class="orbit-card__link">
            <div class="orbit-card__img-wrap">
              <img src="${escapeAttr(product.image)}"
                   alt="${escapeAttr(product.title)}"
                   loading="lazy"
                   width="600"
                   height="600" />
            </div>
            <div class="orbit-card__body">
              <p class="edition-label">Statement Tee</p>
              <h3 class="orbit-card__title">${escapeHtml(product.title)}</h3>
              <p class="orbit-card__desc">${escapeHtml(product.short_description || '')}</p>
            </div>
          </a>
          <div class="orbit-card__footer">
            <span class="price-display">${priceDisplay(product)}</span>
            <button class="btn btn--primary orbit-card__cta" type="button"
                    aria-label="Choose options for ${escapeAttr(product.title)}">
              Choose Options
            </button>
          </div>
        </div>
        <!-- Back Face -->
        <div class="orbit-card__back" aria-label="Quick info for ${escapeAttr(product.title)}">
          <p class="edition-label">${escapeHtml(product.title)}</p>
          <h4 class="orbit-card__back-title">${priceDisplay(product)}</h4>
          <p class="orbit-card__back-desc">${escapeHtml(product.short_description || '')}</p>
          <button class="btn btn--primary orbit-card__back-cta orbit-card__cta" type="button">Choose Options →</button>
        </div>
      </div>
    </article>`;
}

/**
 * Render a standard product card for non-3D items.
 */
export function renderProductCard(product: Product, slugIndex?: SlugMap) {
  const href = pickHref(product, slugIndex);
  return `
    <article class="product-card reveal" data-product-id="${product.id}">
      <a href="${href}" class="product-card__link">
        <div class="product-card__image">
          <img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.title)}" loading="lazy" width="400" height="400" />
        </div>
        <div class="product-card__body">
          <h3 class="product-card__title">${escapeHtml(product.title)}</h3>
          <p class="product-card__desc">${escapeHtml(product.short_description)}</p>
        </div>
      </a>
      <div class="product-card__footer">
        <span class="price-display">${priceDisplay(product)}</span>
        <button class="btn btn--secondary product-card__btn orbit-card__cta" type="button">Choose Options →</button>
      </div>
    </article>`;
}

/**
 * Render an accessory card.
 */
export function renderAccessoryCard(product: Product, slugIndex?: SlugMap) {
  const href = pickHref(product, slugIndex);
  return `
    <article class="accessory-card reveal" data-product-id="${product.id}">
      <a href="${href}" class="accessory-card__link">
        <div class="accessory-card__image">
          <img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.title)}" loading="lazy" width="300" height="300" />
        </div>
        <div class="accessory-card__body">
          <h3 class="accessory-card__title">${escapeHtml(product.title)}</h3>
        </div>
      </a>
      <div class="accessory-card__footer">
        <span class="price-display">${priceDisplay(product)}</span>
        <button class="btn btn--ghost accessory-card__btn orbit-card__cta" type="button">View Details</button>
      </div>
    </article>`;
}

type RenderFn = (p: Product, slugIndex?: SlugMap) => string;

const CATEGORY_RENDER: Record<string, { renderer: RenderFn; titleId?: string }> = {
  tshirts:     { renderer: renderOrbitCard },
  cropTops:    { renderer: renderOrbitCard,    titleId: 'crop-tops-title' },
  tanks:       { renderer: renderProductCard,  titleId: 'tanks-title' },
  hoodies:     { renderer: renderProductCard,  titleId: 'hoodies-title' },
  bottoms:     { renderer: renderProductCard,  titleId: 'bottoms-title' },
  phoneCases:  { renderer: renderAccessoryCard },
  headwear:    { renderer: renderAccessoryCard, titleId: 'headwear-title' },
  footwear:    { renderer: renderAccessoryCard, titleId: 'footwear-title' },
  accessories: { renderer: renderAccessoryCard, titleId: 'accessories-title' },
};

const CATEGORY_GRID_IDS: Record<string, string> = {
  tshirts:     'tshirts-grid',
  cropTops:    'crop-tops-grid',
  tanks:       'tanks-grid',
  hoodies:     'hoodies-grid',
  bottoms:     'bottoms-grid',
  phoneCases:  'phone-cases-grid',
  headwear:    'headwear-grid',
  footwear:    'footwear-grid',
  accessories: 'accessories-grid',
};

export async function loadProducts() {
  const grids: Record<string, HTMLElement | null> = {};
  for (const [cat, gridId] of Object.entries(CATEGORY_GRID_IDS)) {
    grids[cat] = document.getElementById(gridId);
  }

  try {
    const [res, slugRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/products/_index.json').catch(() => null)
    ]);
    if (!res.ok) throw new Error('API unavailable');
    allProducts = await res.json();
    if (slugRes && slugRes.ok) {
      window.slugIndex = await slugRes.json();
    } else {
      window.slugIndex = {};
    }

    for (const [cat, { renderer, titleId }] of Object.entries(CATEGORY_RENDER)) {
      const grid = grids[cat];
      const items = allProducts[cat] || [];
      if (!grid || grid.children.length > 0) continue;

      grid.innerHTML = items.map((p) => renderer(p, window.slugIndex)).join('');

      if (titleId) {
        const title = document.getElementById(titleId);
        if (title) title.style.display = items.length ? 'block' : 'none';
      }
    }

    attachProductListeners();

    // Observe newly-injected .reveal product cards so they animate in
    observeNewReveals();

  } catch (err) {
    console.error('[loadProducts]', err);
    Object.values(grids).forEach(g => {
        if (g) g.innerHTML = '<p class="error-msg">Failed to load collection. Please refresh.</p>';
    });
  }
}

function attachProductListeners() {
    document.querySelectorAll('.orbit-card__cta').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const el = (e.target as HTMLElement).closest('.orbit-card, .product-card, .accessory-card');
            if (!el) return;
            const productId = (el as HTMLElement).dataset.productId;
            const product = findProductById(productId!);
            if (product) {
                track.selectItem({
                    item_id: String(product.id),
                    item_name: product.title,
                    item_brand: 'Bottom Line Apparel',
                    item_category: product.category,
                    price: product.min_price,
                });
                openCheckoutModal(product);
            }
        });
    });
}

export function findProductById(id: string | number): Product | null {
  const categories = ['tshirts', 'cropTops', 'tanks', 'hoodies', 'bottoms', 'phoneCases', 'headwear', 'footwear', 'accessories'];
  for (const cat of categories) {
    const found = (allProducts[cat] || []).find(p => String(p.id) === String(id));
    if (found) return found;
  }
  return null;
}
