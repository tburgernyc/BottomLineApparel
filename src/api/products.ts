import { escapeHtml, escapeAttr } from '../utils/helpers';
import { openCheckoutModal } from '../ui/modals';
import { observeNewReveals } from '../interactions/scroll';

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
    short_description: string;
    min_price: number;
    max_price: number;
    image: string;
    category: string;
    variants: Variant[];
}

export let allProducts: Record<string, Product[]> = {};

/**
 * Institutional Grade simulated scarcity logic.
 */
function getScarcityCount() {
  const r = Math.random();
  if (r < 0.12) return Math.floor(Math.random() * 2) + 1; // 1-2
  if (r < 0.30) return Math.floor(Math.random() * 2) + 3; // 3-4
  return null;
}

const SCARCITY_MESSAGES = (n: number) =>
  n <= 2 ? `Only ${n} left` :
  n <= 4 ? `${n} left` :
  null;

function priceDisplay(p: Product) {
  if (p.min_price === p.max_price) return `$${p.min_price.toFixed(2)}`;
  return `From $${p.min_price.toFixed(2)}`;
}

/**
 * Render a 3D Orbit Card for T-shirts.
 */
function renderOrbitCard(product: Product) {
  const scarcityCount = getScarcityCount();
  const scarcityMsg = scarcityCount ? SCARCITY_MESSAGES(scarcityCount) : null;
  const scarcityHtml = scarcityMsg
    ? `<div class="orbit-card__scarcity" aria-label="${scarcityMsg}">${scarcityMsg}</div>`
    : '';

  return `
    <article class="orbit-card reveal"
             data-product-id="${product.id}">
      <div class="orbit-card__inner">
        <!-- Front Face -->
        <div class="orbit-card__front">
          <div class="orbit-card__img-wrap">
            <img src="${escapeAttr(product.image)}"
                 alt="${escapeAttr(product.title)}"
                 loading="lazy"
                 width="600"
                 height="600" />
            ${scarcityHtml}
          </div>
          <div class="orbit-card__body">
            <p class="edition-label">Statement Tee</p>
            <h3 class="orbit-card__title">${escapeHtml(product.title)}</h3>
            <p class="orbit-card__desc">${escapeHtml(product.short_description || '')}</p>
            <div class="orbit-card__footer">
              <span class="price-display">${priceDisplay(product)}</span>
              <button class="btn btn--primary orbit-card__cta" type="button"
                      aria-label="Choose options for ${escapeAttr(product.title)}">
                Choose Options
              </button>
            </div>
          </div>
        </div>
        <!-- Back Face -->
        <div class="orbit-card__back" aria-label="Quick info for ${escapeAttr(product.title)}">
          <p class="edition-label">${escapeHtml(product.title)}</p>
          <h4 class="orbit-card__back-title">${priceDisplay(product)}</h4>
          <p class="orbit-card__back-desc">${escapeHtml(product.short_description || '')}</p>
          <button class="btn btn--primary orbit-card__back-cta" type="button">Choose Options →</button>
        </div>
      </div>
    </article>`;
}

/**
 * Render a standard product card for non-3D items.
 */
function renderProductCard(product: Product) {
  return `
    <article class="product-card reveal" data-product-id="${product.id}">
      <div class="product-card__image">
        <img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.title)}" loading="lazy" width="400" height="400" />
      </div>
      <div class="product-card__body">
        <h3 class="product-card__title">${escapeHtml(product.title)}</h3>
        <p class="product-card__desc">${escapeHtml(product.short_description)}</p>
        <span class="price-display">${priceDisplay(product)}</span>
        <button class="btn btn--secondary product-card__btn" type="button">Choose Options →</button>
      </div>
    </article>`;
}

/**
 * Render an accessory card.
 */
function renderAccessoryCard(product: Product) {
  return `
    <article class="accessory-card reveal" data-product-id="${product.id}">
      <div class="accessory-card__image">
        <img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.title)}" loading="lazy" width="300" height="300" />
      </div>
      <div class="accessory-card__body">
        <h3 class="accessory-card__title">${escapeHtml(product.title)}</h3>
        <span class="price-display">${priceDisplay(product)}</span>
        <button class="btn btn--ghost accessory-card__btn" type="button">View Details</button>
      </div>
    </article>`;
}

type RenderFn = (p: Product) => string;

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
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('API unavailable');
    allProducts = await res.json();

    for (const [cat, { renderer, titleId }] of Object.entries(CATEGORY_RENDER)) {
      const grid = grids[cat];
      const items = allProducts[cat] || [];
      if (!grid) continue;

      grid.innerHTML = items.map(renderer).join('');

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
    document.querySelectorAll('.orbit-card, .product-card, .accessory-card').forEach(el => {
        el.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.btn')) return;
            const productId = (el as HTMLElement).dataset.productId;
            const product = findProductById(productId!);
            if (product) openCheckoutModal(product);
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
