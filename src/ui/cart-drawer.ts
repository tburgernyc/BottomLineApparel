/**
 * Slide-from-right cart drawer.
 *
 * Renders cart contents from the cart state module, with quantity steppers,
 * remove buttons, free-shipping progress bar, subtotal, and a primary checkout
 * CTA. Up to 4 cross-sell items are pulled from the existing product catalog
 * and shown below the line items.
 *
 * The drawer DOM is created once and appended to <body>. It re-renders on every
 * cart change via the `onCartChange` subscription.
 *
 * Public API:
 *   - initCartDrawer(): wire up DOM and listeners (call once at boot)
 *   - openCartDrawer(): show the drawer
 *   - closeCartDrawer(): hide the drawer
 */

import {
    getCart,
    onCartChange,
    removeItem,
    updateQuantity,
    subtotal,
    itemCount,
    freeShippingRemaining,
    FREE_SHIPPING_THRESHOLD,
    type Cart,
    type CartLineItem,
} from '../cart/state';
import { allProducts, findProductById, type Product } from '../api/products';
import { escapeHtml, escapeAttr } from '../utils/helpers';
import { showToast } from './toast';
import { track } from '../analytics/analytics';

const DRAWER_ID = 'cart-drawer';
const BACKDROP_ID = 'cart-drawer-backdrop';

let drawerEl: HTMLElement | null = null;
let backdropEl: HTMLElement | null = null;

function buildDrawer() {
    if (document.getElementById(DRAWER_ID)) return;

    backdropEl = document.createElement('div');
    backdropEl.id = BACKDROP_ID;
    backdropEl.className = 'cart-drawer-backdrop';
    backdropEl.hidden = true;
    document.body.appendChild(backdropEl);

    drawerEl = document.createElement('aside');
    drawerEl.id = DRAWER_ID;
    drawerEl.className = 'cart-drawer';
    drawerEl.setAttribute('role', 'dialog');
    drawerEl.setAttribute('aria-modal', 'true');
    drawerEl.setAttribute('aria-labelledby', 'cart-drawer-title');
    drawerEl.hidden = true;
    drawerEl.innerHTML = `
      <div class="cart-drawer__header">
        <h2 id="cart-drawer-title" class="cart-drawer__title">Your Bag</h2>
        <button type="button" class="cart-drawer__close" id="cart-drawer-close" aria-label="Close cart">×</button>
      </div>
      <div class="cart-drawer__shipping" id="cart-drawer-shipping" aria-live="polite"></div>
      <div class="cart-drawer__body" id="cart-drawer-body"></div>
      <div class="cart-drawer__crosssell" id="cart-drawer-crosssell" hidden>
        <p class="edition-label">You Might Also Like</p>
        <div class="cart-drawer__crosssell-grid" id="cart-drawer-crosssell-grid"></div>
      </div>
      <div class="cart-drawer__footer">
        <div class="cart-drawer__subtotal-row">
          <span class="cart-drawer__subtotal-label">Subtotal</span>
          <span class="cart-drawer__subtotal-value" id="cart-drawer-subtotal">$0.00</span>
        </div>
        <p class="cart-drawer__taxes">Shipping &amp; taxes calculated at checkout.</p>
        <button type="button" class="btn btn--primary cart-drawer__checkout" id="cart-drawer-checkout" disabled>
          Checkout
        </button>
      </div>
    `;
    document.body.appendChild(drawerEl);

    backdropEl.addEventListener('click', closeCartDrawer);
    document.getElementById('cart-drawer-close')?.addEventListener('click', closeCartDrawer);
    document.getElementById('cart-drawer-checkout')?.addEventListener('click', startCheckout);

    // Quantity / remove are handled via event delegation since lines re-render.
    drawerEl.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const action = target.dataset.cartAction;
        if (!action) return;
        const idStr = target.dataset.variantId || target.closest<HTMLElement>('[data-variant-id]')?.dataset.variantId;
        const id = idStr ? parseInt(idStr, 10) : NaN;
        if (!Number.isFinite(id)) return;

        if (action === 'remove') {
            const cart = getCart();
            const removed = cart.items.find(i => i.sync_variant_id === id);
            removeItem(id);
            if (removed) {
                track.removeFromCart(toAnalyticsItem(removed));
            }
        } else if (action === 'inc' || action === 'dec') {
            const cart = getCart();
            const line = cart.items.find(i => i.sync_variant_id === id);
            if (!line) return;
            const next = action === 'inc' ? line.quantity + 1 : line.quantity - 1;
            updateQuantity(id, next);
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !drawerEl?.hidden) closeCartDrawer();
    });
}

function fmt(n: number): string {
    return `$${n.toFixed(2)}`;
}

function lineHtml(line: CartLineItem): string {
    return `
      <div class="cart-line" data-variant-id="${line.sync_variant_id}">
        <div class="cart-line__image">
          ${line.image
            ? `<img src="${escapeAttr(line.image)}" alt="${escapeAttr(line.title)}" loading="lazy" width="72" height="72" />`
            : ''}
        </div>
        <div class="cart-line__info">
          <p class="cart-line__title">${escapeHtml(line.title)}</p>
          ${line.variant_label
            ? `<p class="cart-line__variant">${escapeHtml(line.variant_label)}</p>`
            : ''}
          <p class="cart-line__price">${fmt(line.price)}</p>
          <div class="cart-line__qty">
            <button type="button" class="cart-line__qty-btn" data-cart-action="dec" data-variant-id="${line.sync_variant_id}" aria-label="Decrease quantity">−</button>
            <span class="cart-line__qty-value" aria-live="polite">${line.quantity}</span>
            <button type="button" class="cart-line__qty-btn" data-cart-action="inc" data-variant-id="${line.sync_variant_id}" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <button type="button" class="cart-line__remove" data-cart-action="remove" data-variant-id="${line.sync_variant_id}" aria-label="Remove ${escapeAttr(line.title)}">Remove</button>
      </div>
    `;
}

function shippingHtml(): string {
    const remaining = freeShippingRemaining();
    const sub = subtotal();
    const pct = Math.min(100, Math.round((sub / FREE_SHIPPING_THRESHOLD) * 100));
    if (remaining <= 0 && sub > 0) {
        return `
          <p class="cart-drawer__shipping-msg cart-drawer__shipping-msg--earned">
            You've unlocked free shipping.
          </p>
          <div class="cart-drawer__shipping-bar"><span style="width: 100%"></span></div>
        `;
    }
    return `
      <p class="cart-drawer__shipping-msg">
        ${sub > 0
          ? `${fmt(remaining)} away from <strong>free shipping</strong>.`
          : `Free shipping on orders over ${fmt(FREE_SHIPPING_THRESHOLD)}.`}
      </p>
      <div class="cart-drawer__shipping-bar"><span style="width: ${pct}%"></span></div>
    `;
}

function pickCrossSell(currentIds: number[]): Product[] {
    const pool = [
        ...(allProducts.tshirts || []),
        ...(allProducts.tanks || []),
        ...(allProducts.hoodies || []),
        ...(allProducts.accessories || []),
    ];
    const seen = new Set<number>(currentIds);
    const picks: Product[] = [];
    for (const p of pool) {
        if (seen.has(p.id)) continue;
        picks.push(p);
        seen.add(p.id);
        if (picks.length >= 4) break;
    }
    return picks;
}

function renderCrossSell(cart: Cart) {
    const wrap = document.getElementById('cart-drawer-crosssell');
    const grid = document.getElementById('cart-drawer-crosssell-grid');
    if (!wrap || !grid) return;

    if (!cart.items.length) {
        wrap.hidden = true;
        return;
    }

    const inCartProductIds = cart.items.map(i => i.product_id);
    const picks = pickCrossSell(inCartProductIds);
    if (!picks.length) {
        wrap.hidden = true;
        return;
    }

    wrap.hidden = false;
    grid.innerHTML = picks.map(p => `
      <button type="button" class="cart-crosssell-item" data-product-id="${p.id}">
        <img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.title)}" loading="lazy" width="64" height="64" />
        <span class="cart-crosssell-item__title">${escapeHtml(p.title)}</span>
        <span class="cart-crosssell-item__price">${fmt(p.min_price)}</span>
      </button>
    `).join('');

    grid.querySelectorAll<HTMLElement>('.cart-crosssell-item').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.dataset.productId;
            if (!id) return;
            const p = findProductById(id);
            if (p) {
                closeCartDrawer();
                // Lazily import to avoid a circular dep at module load time.
                import('./modals').then(m => m.openCheckoutModal(p));
            }
        });
    });
}

function render(cart: Cart) {
    const body = document.getElementById('cart-drawer-body');
    const subtotalEl = document.getElementById('cart-drawer-subtotal');
    const checkoutBtn = document.getElementById('cart-drawer-checkout') as HTMLButtonElement | null;
    const shippingEl = document.getElementById('cart-drawer-shipping');

    if (!body || !subtotalEl || !checkoutBtn || !shippingEl) return;

    if (!cart.items.length) {
        body.innerHTML = `
          <div class="cart-drawer__empty">
            <p>Your bag is empty.</p>
            <button type="button" class="btn btn--secondary" id="cart-drawer-empty-shop">Continue Shopping</button>
          </div>
        `;
        document.getElementById('cart-drawer-empty-shop')?.addEventListener('click', closeCartDrawer);
        checkoutBtn.disabled = true;
    } else {
        body.innerHTML = cart.items.map(lineHtml).join('');
        checkoutBtn.disabled = false;
    }

    subtotalEl.textContent = fmt(subtotal());
    shippingEl.innerHTML = shippingHtml();
    renderCrossSell(cart);

    // Keep the header cart count badge in sync.
    const badge = document.getElementById('cart-icon-count');
    if (badge) {
        const n = itemCount();
        badge.textContent = n > 0 ? String(n) : '';
        badge.hidden = n === 0;
    }
}

function toAnalyticsItem(line: CartLineItem) {
    return {
        item_id: String(line.sync_variant_id),
        item_name: line.title,
        item_brand: 'Bottom Line Apparel',
        item_variant: line.variant_label,
        price: line.price,
        quantity: line.quantity,
    };
}

async function startCheckout() {
    const cart = getCart();
    if (!cart.items.length) return;

    const checkoutBtn = document.getElementById('cart-drawer-checkout') as HTMLButtonElement | null;
    if (!checkoutBtn) return;

    track.beginCheckout(cart.items.map(toAnalyticsItem));

    const original = checkoutBtn.textContent || 'Checkout';
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Loading checkout…';

    try {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                line_items: cart.items.map(i => ({
                    sync_variant_id: i.sync_variant_id,
                    quantity: i.quantity,
                })),
            }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || data.error || `HTTP ${res.status}`);
        }

        const { url } = await res.json();
        if (!url) throw new Error('No checkout URL returned');
        window.location.href = url;
    } catch (err: any) {
        console.error('[cart-drawer]', err);
        showToast('Checkout unavailable right now. Please try again.', 'error');
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = original;
    }
}

export function openCartDrawer() {
    if (!drawerEl || !backdropEl) return;
    track.viewCart(getCart().items.map(toAnalyticsItem));
    drawerEl.hidden = false;
    backdropEl.hidden = false;
    requestAnimationFrame(() => {
        drawerEl?.classList.add('open');
        backdropEl?.classList.add('open');
    });
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('cart-drawer-close')?.focus(), 100);
}

export function closeCartDrawer() {
    if (!drawerEl || !backdropEl) return;
    drawerEl.classList.remove('open');
    backdropEl.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => {
        if (drawerEl) drawerEl.hidden = true;
        if (backdropEl) backdropEl.hidden = true;
    }, 280);
}

export function initCartDrawer() {
    buildDrawer();
    onCartChange(render);
}
