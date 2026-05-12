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
import { track } from '../analytics/analytics';

const DRAWER_ID = 'cart-drawer';
const BACKDROP_ID = 'cart-drawer-backdrop';
const SHIPPING_ADDR_KEY = 'bla.ship.addr';
const SHIPPING_RATES_KEY = 'bla.ship.rates';

interface ShippingAddress {
    country: string;
    state?: string;
    zip: string;
    city?: string;
}

interface ShippingRate {
    id: string;
    name: string;
    rate_cents: number;
    currency: string;
    min_delivery_days: number | null;
    max_delivery_days: number | null;
}

interface ShippingState {
    address: ShippingAddress | null;
    rates: ShippingRate[];
    selectedId: string | null;
    status: 'idle' | 'loading' | 'loaded' | 'error';
    error: string | null;
}

let drawerEl: HTMLElement | null = null;
let backdropEl: HTMLElement | null = null;

let shipping: ShippingState = {
    address: null,
    rates: [],
    selectedId: null,
    status: 'idle',
    error: null,
};

function hydrateShippingFromStorage() {
    try {
        const rawAddr = localStorage.getItem(SHIPPING_ADDR_KEY);
        if (rawAddr) {
            const parsed = JSON.parse(rawAddr);
            if (parsed && typeof parsed.country === 'string' && typeof parsed.zip === 'string') {
                shipping.address = parsed;
            }
        }
        const rawRates = sessionStorage.getItem(SHIPPING_RATES_KEY);
        if (rawRates) {
            const parsed = JSON.parse(rawRates);
            if (parsed && Array.isArray(parsed.rates) && parsed.cartFingerprint) {
                if (parsed.cartFingerprint === cartFingerprint()) {
                    shipping.rates = parsed.rates;
                    shipping.selectedId = parsed.selectedId || parsed.rates[0]?.id || null;
                    shipping.status = 'loaded';
                }
            }
        }
    } catch {}
}

function persistAddress() {
    if (!shipping.address) return;
    try { localStorage.setItem(SHIPPING_ADDR_KEY, JSON.stringify(shipping.address)); } catch {}
}

function persistRates() {
    try {
        sessionStorage.setItem(SHIPPING_RATES_KEY, JSON.stringify({
            cartFingerprint: cartFingerprint(),
            rates: shipping.rates,
            selectedId: shipping.selectedId,
        }));
    } catch {}
}

function cartFingerprint(): string {
    return getCart().items
        .map(i => `${i.sync_variant_id}x${i.quantity}`)
        .sort()
        .join('|');
}

function invalidateRatesIfCartChanged() {
    // Cart items changed → previously fetched rates may not apply. Drop them.
    try {
        const raw = sessionStorage.getItem(SHIPPING_RATES_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed.cartFingerprint !== cartFingerprint()) {
            shipping.rates = [];
            shipping.selectedId = null;
            shipping.status = 'idle';
            shipping.error = null;
            sessionStorage.removeItem(SHIPPING_RATES_KEY);
        }
    } catch {}
}

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
      <div class="cart-drawer__shipcalc" id="cart-drawer-shipcalc" hidden>
        <p class="cart-drawer__shipcalc-label">Shipping estimate</p>
        <form class="cart-drawer__shipcalc-form" id="cart-drawer-shipcalc-form" novalidate>
          <div class="cart-drawer__shipcalc-row">
            <label class="cart-drawer__shipcalc-field">
              <span>Country</span>
              <select name="country" id="cart-drawer-shipcalc-country" required>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
              </select>
            </label>
            <label class="cart-drawer__shipcalc-field" id="cart-drawer-shipcalc-state-wrap">
              <span>State</span>
              <input type="text" name="state" id="cart-drawer-shipcalc-state" maxlength="3" autocomplete="address-level1" placeholder="NY" />
            </label>
            <label class="cart-drawer__shipcalc-field">
              <span>ZIP / Postal</span>
              <input type="text" name="zip" id="cart-drawer-shipcalc-zip" maxlength="10" autocomplete="postal-code" required />
            </label>
          </div>
          <button type="submit" class="cart-drawer__shipcalc-submit" id="cart-drawer-shipcalc-submit">Get shipping rates</button>
        </form>
        <div class="cart-drawer__shipcalc-rates" id="cart-drawer-shipcalc-rates" aria-live="polite"></div>
        <div class="cart-drawer__shipcalc-error" id="cart-drawer-shipcalc-error" role="alert" hidden></div>
      </div>
      <div class="cart-drawer__footer">
        <div class="cart-drawer__subtotal-row">
          <span class="cart-drawer__subtotal-label">Subtotal</span>
          <span class="cart-drawer__subtotal-value" id="cart-drawer-subtotal">$0.00</span>
        </div>
        <div class="cart-drawer__subtotal-row cart-drawer__shipping-row" id="cart-drawer-shipping-row" hidden>
          <span class="cart-drawer__subtotal-label">Shipping</span>
          <span class="cart-drawer__subtotal-value" id="cart-drawer-shipping-cost">—</span>
        </div>
        <div class="cart-drawer__subtotal-row cart-drawer__total-row" id="cart-drawer-total-row" hidden>
          <span class="cart-drawer__subtotal-label">Estimated total</span>
          <span class="cart-drawer__subtotal-value" id="cart-drawer-total">$0.00</span>
        </div>
        <p class="cart-drawer__taxes">Sales tax calculated at checkout.</p>
        <button type="button" class="btn btn--primary cart-drawer__checkout" id="cart-drawer-checkout" disabled>
          Checkout
        </button>
      </div>
    `;
    document.body.appendChild(drawerEl);

    backdropEl.addEventListener('click', closeCartDrawer);
    document.getElementById('cart-drawer-close')?.addEventListener('click', closeCartDrawer);
    document.getElementById('cart-drawer-checkout')?.addEventListener('click', startCheckout);
    document.getElementById('cart-drawer-shipcalc-form')?.addEventListener('submit', onShipCalcSubmit);
    document.getElementById('cart-drawer-shipcalc-country')?.addEventListener('change', onCountryChange);
    document.getElementById('cart-drawer-shipcalc-rates')?.addEventListener('change', onRateSelect);

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
    const shipCalcEl = document.getElementById('cart-drawer-shipcalc');

    if (!body || !subtotalEl || !checkoutBtn || !shippingEl || !shipCalcEl) return;

    invalidateRatesIfCartChanged();

    if (!cart.items.length) {
        body.innerHTML = `
          <div class="cart-drawer__empty">
            <p>Your bag is empty.</p>
            <button type="button" class="btn btn--secondary" id="cart-drawer-empty-shop">Continue Shopping</button>
          </div>
        `;
        document.getElementById('cart-drawer-empty-shop')?.addEventListener('click', closeCartDrawer);
        shipCalcEl.hidden = true;
    } else {
        body.innerHTML = cart.items.map(lineHtml).join('');
        shipCalcEl.hidden = false;
        seedShipCalcForm();
    }

    subtotalEl.textContent = fmt(subtotal());
    shippingEl.innerHTML = shippingHtml();
    renderCrossSell(cart);
    renderShippingRates();
    renderTotals();
    updateCheckoutGating();

    // Keep the header cart count badge in sync.
    const badge = document.getElementById('cart-icon-count');
    if (badge) {
        const n = itemCount();
        badge.textContent = n > 0 ? String(n) : '';
        badge.hidden = n === 0;
    }
}

function seedShipCalcForm() {
    if (!shipping.address) return;
    const c = document.getElementById('cart-drawer-shipcalc-country') as HTMLSelectElement | null;
    const s = document.getElementById('cart-drawer-shipcalc-state') as HTMLInputElement | null;
    const z = document.getElementById('cart-drawer-shipcalc-zip') as HTMLInputElement | null;
    if (c && shipping.address.country) c.value = shipping.address.country;
    if (s && shipping.address.state) s.value = shipping.address.state;
    if (z && shipping.address.zip) z.value = shipping.address.zip;
    syncStateFieldVisibility();
}

function syncStateFieldVisibility() {
    const c = document.getElementById('cart-drawer-shipcalc-country') as HTMLSelectElement | null;
    const wrap = document.getElementById('cart-drawer-shipcalc-state-wrap');
    if (!c || !wrap) return;
    // State/region is meaningful for US + CA + AU; UK doesn't use one in shipping rates.
    const showState = c.value === 'US' || c.value === 'CA' || c.value === 'AU';
    wrap.style.display = showState ? '' : 'none';
}

function onCountryChange() {
    syncStateFieldVisibility();
}

async function onShipCalcSubmit(e: Event) {
    e.preventDefault();
    const country = (document.getElementById('cart-drawer-shipcalc-country') as HTMLSelectElement)?.value || 'US';
    const state = (document.getElementById('cart-drawer-shipcalc-state') as HTMLInputElement)?.value?.trim().toUpperCase() || '';
    const zip = (document.getElementById('cart-drawer-shipcalc-zip') as HTMLInputElement)?.value?.trim() || '';

    if (!zip) {
        setShipError('Please enter a ZIP or postal code.');
        return;
    }

    shipping.address = { country, state: state || undefined, zip };
    persistAddress();

    shipping.status = 'loading';
    shipping.error = null;
    renderShippingRates();
    updateCheckoutGating();

    const submitBtn = document.getElementById('cart-drawer-shipcalc-submit') as HTMLButtonElement | null;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Calculating…';
    }

    try {
        const cart = getCart();
        const res = await fetch('/api/shipping-rates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                country_code: country,
                state_code: state || undefined,
                zip,
                line_items: cart.items.map(i => ({ sync_variant_id: i.sync_variant_id, quantity: i.quantity })),
            }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const code = data.error || '';
            throw Object.assign(new Error(data.message || code || `HTTP ${res.status}`), { code, status: res.status });
        }
        const data = await res.json();
        const rates: ShippingRate[] = Array.isArray(data.rates) ? data.rates : [];
        if (!rates.length) {
            throw Object.assign(new Error('No shipping rates available for this address.'), { code: 'no_rates' });
        }
        shipping.rates = rates;
        shipping.selectedId = rates[0].id;
        shipping.status = 'loaded';
        shipping.error = null;
        persistRates();
    } catch (err: any) {
        shipping.rates = [];
        shipping.selectedId = null;
        shipping.status = 'error';
        shipping.error = classifyShipCalcError(err);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Get shipping rates';
        }
        renderShippingRates();
        renderTotals();
        updateCheckoutGating();
    }
}

function classifyShipCalcError(err: any): string {
    const code = err?.code || '';
    if (code === 'invalid_address') return 'We couldn’t find a rate for that address. Double-check the ZIP and try again.';
    if (code === 'unsupported_country') return 'We don’t currently ship to that country.';
    if (code === 'no_rates' || code === 'no_rates_available') return 'No carriers serve that address. Try a different ZIP.';
    if (code === 'configuration_missing') return 'Shipping calculator is temporarily unavailable.';
    if (!navigator.onLine) return 'You appear to be offline. Check your connection and try again.';
    return 'We couldn’t fetch shipping rates right now. Please try again.';
}

function setShipError(msg: string) {
    const errEl = document.getElementById('cart-drawer-shipcalc-error');
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.hidden = false;
}

function clearShipError() {
    const errEl = document.getElementById('cart-drawer-shipcalc-error');
    if (!errEl) return;
    errEl.textContent = '';
    errEl.hidden = true;
}

function onRateSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target?.name !== 'shipping-rate') return;
    shipping.selectedId = target.value;
    persistRates();
    renderTotals();
    updateCheckoutGating();
}

function renderShippingRates() {
    const ratesEl = document.getElementById('cart-drawer-shipcalc-rates');
    if (!ratesEl) return;
    if (shipping.status === 'idle') {
        ratesEl.innerHTML = '';
        clearShipError();
        return;
    }
    if (shipping.status === 'loading') {
        ratesEl.innerHTML = `<p class="cart-drawer__shipcalc-loading">Checking rates with Printful…</p>`;
        clearShipError();
        return;
    }
    if (shipping.status === 'error') {
        ratesEl.innerHTML = '';
        setShipError(shipping.error || 'Could not load shipping rates.');
        return;
    }
    // loaded
    clearShipError();
    ratesEl.innerHTML = shipping.rates.map(r => {
        const eta = formatEta(r.min_delivery_days, r.max_delivery_days);
        const checked = r.id === shipping.selectedId ? 'checked' : '';
        return `
          <label class="cart-drawer__shipcalc-rate">
            <input type="radio" name="shipping-rate" value="${escapeAttr(r.id)}" ${checked} />
            <span class="cart-drawer__shipcalc-rate-name">${escapeHtml(r.name)}</span>
            ${eta ? `<span class="cart-drawer__shipcalc-rate-eta">${escapeHtml(eta)}</span>` : ''}
            <span class="cart-drawer__shipcalc-rate-price">${fmt(r.rate_cents / 100)}</span>
          </label>
        `;
    }).join('');
}

function formatEta(min: number | null, max: number | null): string {
    if (!min && !max) return '';
    if (min && max && min !== max) return `${min}-${max} business days`;
    const n = max ?? min;
    return `${n} business day${n === 1 ? '' : 's'}`;
}

function getSelectedRate(): ShippingRate | null {
    if (shipping.status !== 'loaded' || !shipping.selectedId) return null;
    return shipping.rates.find(r => r.id === shipping.selectedId) || null;
}

function renderTotals() {
    const shippingRow = document.getElementById('cart-drawer-shipping-row');
    const shippingCostEl = document.getElementById('cart-drawer-shipping-cost');
    const totalRow = document.getElementById('cart-drawer-total-row');
    const totalEl = document.getElementById('cart-drawer-total');
    if (!shippingRow || !shippingCostEl || !totalRow || !totalEl) return;

    const sub = subtotal();
    const rate = getSelectedRate();

    if (!rate) {
        shippingRow.hidden = true;
        totalRow.hidden = true;
        return;
    }

    const freeShip = sub >= FREE_SHIPPING_THRESHOLD;
    const shipCents = freeShip ? 0 : rate.rate_cents;
    shippingCostEl.textContent = freeShip
        ? 'Free'
        : (shipCents === 0 ? 'Free' : fmt(shipCents / 100));
    shippingRow.hidden = false;
    totalEl.textContent = fmt(sub + shipCents / 100);
    totalRow.hidden = false;
}

function updateCheckoutGating() {
    const checkoutBtn = document.getElementById('cart-drawer-checkout') as HTMLButtonElement | null;
    if (!checkoutBtn) return;
    const cart = getCart();
    if (!cart.items.length) {
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Checkout';
        return;
    }
    const rate = getSelectedRate();
    if (!rate) {
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Add shipping address to checkout';
        return;
    }
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = 'Checkout';
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

    const rate = getSelectedRate();
    if (!rate) {
        renderCheckoutError('Please add a shipping address to see rates before checkout.');
        return;
    }

    const checkoutBtn = document.getElementById('cart-drawer-checkout') as HTMLButtonElement | null;
    if (!checkoutBtn) return;

    clearCheckoutError();
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
                shipping_rate: {
                    name: rate.name,
                    amount_cents: rate.rate_cents,
                    min_delivery_days: rate.min_delivery_days,
                    max_delivery_days: rate.max_delivery_days,
                },
            }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const code = data.error || '';
            throw Object.assign(
                new Error(data.message || data.error || `HTTP ${res.status}`),
                { code, status: res.status },
            );
        }

        const { url } = await res.json();
        if (!url) throw new Error('No checkout URL returned');
        window.location.href = url;
    } catch (err: any) {
        console.error('[cart-drawer]', err);
        const msg = classifyCheckoutError(err);
        renderCheckoutError(msg);
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = original;
    }
}

function classifyCheckoutError(err: any): string {
    const code = err?.code || '';
    const status = err?.status || 0;
    if (code === 'configuration_missing') {
        return 'Checkout is temporarily unavailable. Please try again later.';
    }
    if (code === 'variant_not_found' || code === 'variant_not_available') {
        return 'One or more items in your cart are no longer available. Please update your cart and try again.';
    }
    if (code === 'variant_lookup_failed' || status === 502) {
        return 'We couldn\u2019t verify your items right now. Please try again in a moment.';
    }
    if (code === 'cart_too_large') {
        return 'Your cart has too many items. Please remove some items and try again.';
    }
    if (!navigator.onLine) {
        return 'You appear to be offline. Please check your connection and try again.';
    }
    return 'Something went wrong during checkout. Please try again.';
}

function renderCheckoutError(msg: string) {
    const footer = drawerEl?.querySelector('.cart-drawer__footer');
    if (!footer) return;
    clearCheckoutError();
    const region = document.createElement('div');
    region.className = 'cart-drawer__error';
    region.setAttribute('role', 'alert');
    region.setAttribute('aria-live', 'assertive');
    region.innerHTML = `
        <p>${msg}</p>
        <button type="button" class="cart-drawer__error-retry">Try again</button>
    `;
    region.querySelector('.cart-drawer__error-retry')?.addEventListener('click', () => {
        clearCheckoutError();
        startCheckout();
    });
    footer.appendChild(region);
}

function clearCheckoutError() {
    drawerEl?.querySelector('.cart-drawer__error')?.remove();
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
    hydrateShippingFromStorage();
    buildDrawer();
    onCartChange(render);
}
