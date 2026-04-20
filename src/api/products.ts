import { escapeHtml, escapeAttr } from '../utils/helpers';
import { openCheckoutModal } from '../ui/modals';

export interface Product {
    id: number;
    title: string;
    short_description: string;
    price: number;
    image: string;
    lemonsqueezy_url: string | null;
    category: string;
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
              <span class="price-display">$${product.price.toFixed(2)}</span>
              <button class="btn btn--primary orbit-card__cta" type="button"
                      data-url="${product.lemonsqueezy_url || ''}"
                      aria-label="${product.lemonsqueezy_url ? `Buy ${escapeAttr(product.title)}` : `Notify when ${escapeAttr(product.title)} is live`}">
                ${product.lemonsqueezy_url ? 'Buy Now' : 'Get Early Access'}
              </button>
            </div>
          </div>
        </div>
        <!-- Back Face: Size Selector -->
        <div class="orbit-card__back" aria-label="Size selection for ${escapeAttr(product.title)}">
          <p class="edition-label">Choose Your Size</p>
          <h4 class="orbit-card__back-title">${escapeHtml(product.title)}</h4>
          <div class="size-grid orbit-size-grid">
            <button class="size-tag" data-size="XS" type="button">XS</button>
            <button class="size-tag" data-size="S"  type="button">S</button>
            <button class="size-tag" data-size="M"  type="button">M</button>
            <button class="size-tag" data-size="L"  type="button">L</button>
            <button class="size-tag" data-size="XL" type="button">XL</button>
            <button class="size-tag" data-size="2XL" type="button">2XL</button>
          </div>
          <button class="btn btn--ghost btn--sm size-guide-trigger" type="button">Size Guide ↗</button>
          <button class="btn btn--primary orbit-card__back-cta" type="button" disabled>Select Size</button>
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
        <span class="price-display">$${product.price.toFixed(2)}</span>
        <button class="btn btn--secondary product-card__btn" type="button">Add to Cart →</button>
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
        <span class="price-display">$${product.price.toFixed(2)}</span>
        <button class="btn btn--ghost accessory-card__btn" type="button">View Details</button>
      </div>
    </article>`;
}

export async function loadProducts() {
  const grids = {
    tshirts: document.getElementById('tshirts-grid'),
    tanks: document.getElementById('tanks-grid'),
    hoodies: document.getElementById('hoodies-grid'),
    phoneCases: document.getElementById('phone-cases-grid'),
  };

  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('API unavailable');
    allProducts = await res.json();

    // Render T-shirts
    if (grids.tshirts && allProducts.tshirts) {
        grids.tshirts.innerHTML = allProducts.tshirts.map(renderOrbitCard).join('');
    }

    // Render others
    if (grids.tanks && allProducts.tanks) {
        grids.tanks.innerHTML = allProducts.tanks.map(renderProductCard).join('');
        const title = document.getElementById('tanks-title');
        if (title && allProducts.tanks.length) title.style.display = 'block';
    }

    if (grids.hoodies && allProducts.hoodies) {
        grids.hoodies.innerHTML = allProducts.hoodies.map(renderProductCard).join('');
        const title = document.getElementById('hoodies-title');
        if (title && allProducts.hoodies.length) title.style.display = 'block';
    }

    if (grids.phoneCases && allProducts.phoneCases) {
        grids.phoneCases.innerHTML = allProducts.phoneCases.map(renderAccessoryCard).join('');
    }

    // Attach listeners for newly rendered product buttons
    attachProductListeners();

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
            if (target.closest('.btn') || target.closest('.size-tag')) {
                const productId = (el as HTMLElement).dataset.productId;
                const product = findProductById(productId!);
                if (product) {
                    if (target.closest('.orbit-card__cta') && product.lemonsqueezy_url) {
                         (window as any).createLSCheckout(product.lemonsqueezy_url);
                    } else {
                        openCheckoutModal(product);
                    }
                }
            }
        });
    });
}

function findProductById(id: string | number): Product | null {
  const categories = ['tshirts', 'tanks', 'hoodies', 'phoneCases', 'accessories'];
  for (const cat of categories) {
    const found = (allProducts[cat] || []).find(p => String(p.id) === String(id));
    if (found) return found;
  }
  return null;
}
