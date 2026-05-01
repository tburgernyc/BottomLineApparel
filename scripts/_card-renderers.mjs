// scripts/_card-renderers.mjs
// Parallel node-consumable copy of the card renderers from src/api/products.ts
// so prerender can inject cards into collection grids.
import { escapeHtmlText as escapeHtml, escapeAttr } from './prerender.mjs';

function priceDisplay(p) {
  if (p.min_price === p.max_price) return `$${p.min_price.toFixed(2)}`;
  return `From $${p.min_price.toFixed(2)}`;
}

export function renderOrbitCard(product, slugIndex) {
  const slug = slugIndex ? slugIndex[product.id]?.slug : product.slug;
  const href = slug ? `/products/${slug}/` : '#';
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

export function renderProductCard(product, slugIndex) {
  const slug = slugIndex ? slugIndex[product.id]?.slug : product.slug;
  const href = slug ? `/products/${slug}/` : '#';
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

export function renderAccessoryCard(product, slugIndex) {
  const slug = slugIndex ? slugIndex[product.id]?.slug : product.slug;
  const href = slug ? `/products/${slug}/` : '#';
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
