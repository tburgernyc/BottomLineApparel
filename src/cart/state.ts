/**
 * Cart state with localStorage persistence and pub/sub for UI subscribers.
 *
 * One source of truth for the cart. Items are keyed by sync_variant_id so the
 * same variant added twice merges into a single line with quantity++.
 *
 * Persistence: written to `bla.cart` on every mutation. Re-hydrated on load.
 *
 * Free-shipping threshold and max-quantity-per-line are config constants here
 * (single place to tune). Money values are stored in dollars (decimals) to
 * match the rest of the app; convert to cents only at the Stripe boundary.
 */

export interface CartLineItem {
    sync_variant_id: number;
    product_id: number;
    title: string;
    variant_label: string;   // e.g. "Black / M"
    image: string | null;
    price: number;
    quantity: number;
}

export interface Cart {
    items: CartLineItem[];
    updatedAt: number;
}

const STORAGE_KEY = 'bla.cart';
export const FREE_SHIPPING_THRESHOLD = 75;
export const MAX_QUANTITY_PER_LINE = 10;

type CartListener = (cart: Cart) => void;
const listeners: CartListener[] = [];

function read(): Cart {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { items: [], updatedAt: Date.now() };
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.items)) return { items: [], updatedAt: Date.now() };
        // Defensive: drop malformed lines so a corrupt entry can't break the UI.
        const items = parsed.items.filter((i: any) =>
            i && typeof i.sync_variant_id === 'number'
              && typeof i.title === 'string'
              && typeof i.price === 'number'
              && typeof i.quantity === 'number',
        );
        return { items, updatedAt: parsed.updatedAt || Date.now() };
    } catch {
        return { items: [], updatedAt: Date.now() };
    }
}

let cart: Cart = read();

function persist() {
    cart.updatedAt = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch {}
    listeners.forEach(fn => { try { fn(cart); } catch {} });
}

export function getCart(): Cart {
    return { items: cart.items.map(i => ({ ...i })), updatedAt: cart.updatedAt };
}

export function itemCount(): number {
    return cart.items.reduce((s, i) => s + i.quantity, 0);
}

export function subtotal(): number {
    return cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
}

export function freeShippingRemaining(): number {
    return Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal());
}

export function addItem(item: Omit<CartLineItem, 'quantity'> & { quantity?: number }) {
    const qty = clampQty(item.quantity ?? 1);
    const existing = cart.items.find(i => i.sync_variant_id === item.sync_variant_id);
    if (existing) {
        existing.quantity = clampQty(existing.quantity + qty);
    } else {
        cart.items.push({
            sync_variant_id: item.sync_variant_id,
            product_id: item.product_id,
            title: item.title,
            variant_label: item.variant_label,
            image: item.image,
            price: item.price,
            quantity: qty,
        });
    }
    persist();
}

export function removeItem(sync_variant_id: number) {
    cart.items = cart.items.filter(i => i.sync_variant_id !== sync_variant_id);
    persist();
}

export function updateQuantity(sync_variant_id: number, quantity: number) {
    const line = cart.items.find(i => i.sync_variant_id === sync_variant_id);
    if (!line) return;
    if (quantity <= 0) {
        removeItem(sync_variant_id);
        return;
    }
    line.quantity = clampQty(quantity);
    persist();
}

export function clear() {
    cart.items = [];
    persist();
}

export function onCartChange(fn: CartListener): () => void {
    listeners.push(fn);
    try { fn(cart); } catch {}
    return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
    };
}

function clampQty(n: number): number {
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(MAX_QUANTITY_PER_LINE, Math.floor(n)));
}
