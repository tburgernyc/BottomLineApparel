/**
 * Analytics façade. Loads pixel SDKs lazily after consent and exposes a single
 * typed surface for the rest of the app to call: `track.viewItem(...)`,
 * `track.addToCart(...)`, etc.
 *
 * Behavior:
 *  - If the relevant pixel ID is a placeholder (e.g. `G-XXXXXXXXXX`) or empty,
 *    we treat it as "not configured" and become a no-op for that channel.
 *    This means a dev environment without real IDs will never fire ghost events.
 *  - Marketing pixels (Meta, TikTok) only fire when `marketing` consent is given.
 *  - Analytics events (GA4) only fire when `analytics` consent is given.
 *  - Pixel SDK scripts are appended to <head> on first consent grant; subsequent
 *    consent revocations stop sending events but do not remove the SDK.
 */

import { hasConsent, onConsentChange } from './consent';

declare global {
    interface Window {
        BLA_GA_ID?: string;
        BLA_TTQ_ID?: string;
        BLA_META_ID?: string;
        dataLayer?: any[];
        gtag?: (...args: any[]) => void;
        fbq?: (...args: any[]) => void;
        ttq?: any;
    }
}

const PLACEHOLDER_RE = /^(|G-X+|XXX+)$/i;

function realId(raw: string | undefined): string | null {
    if (!raw) return null;
    if (PLACEHOLDER_RE.test(raw)) return null;
    return raw;
}

let gaLoaded = false;
let metaLoaded = false;
let ttqLoaded = false;

function loadGA4() {
    if (gaLoaded) return;
    const id = realId(window.BLA_GA_ID);
    if (!id) return;
    gaLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer!.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id, { send_page_view: true });

    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(s);
}

function loadMetaPixel() {
    if (metaLoaded) return;
    const id = realId(window.BLA_META_ID);
    if (!id) return;
    metaLoaded = true;

    // Standard Meta Pixel bootstrap — verbatim per Meta's docs.
    /* eslint-disable */
    (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return; n = f.fbq = function () {
            n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
        n.queue = []; t = b.createElement(e); t.async = !0;
        t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq?.('init', id);
    window.fbq?.('track', 'PageView');
}

function loadTikTokPixel() {
    if (ttqLoaded) return;
    const id = realId(window.BLA_TTQ_ID);
    if (!id) return;
    ttqLoaded = true;

    // TikTok pixel bootstrap.
    /* eslint-disable */
    (function (w: any, d: any, t: any) {
        w.TiktokAnalyticsObject = t; const ttq: any = w[t] = w[t] || [];
        ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
        ttq.setAndDefer = function (e: any, t: any) { e[t] = function () { e.push([t].concat(Array.prototype.slice.call(arguments, 0))); }; };
        for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.instance = function (e: any) { const n = ttq._i[e] || []; for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(n, ttq.methods[i]); return n; };
        ttq.load = function (e: any, n: any) {
            const i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
            ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = i;
            ttq._t = ttq._t || {}; ttq._t[e] = +new Date(); ttq._o = ttq._o || {}; ttq._o[e] = n || {};
            const o = d.createElement('script'); o.type = 'text/javascript'; o.async = !0; o.src = i + '?sdkid=' + e + '&lib=' + t;
            const a = d.getElementsByTagName('script')[0]; a.parentNode.insertBefore(o, a);
        };
        ttq.load(id); ttq.page();
    })(window, document, 'ttq');
    /* eslint-enable */
}

export function initAnalytics() {
    onConsentChange(state => {
        if (state.analytics) loadGA4();
        if (state.marketing) {
            loadMetaPixel();
            loadTikTokPixel();
        }
    });
}

// ----- Typed ecommerce event payloads -----

export interface AnalyticsItem {
    item_id: string;
    item_name: string;
    item_brand?: string;
    item_category?: string;
    item_variant?: string;
    price: number;
    quantity?: number;
}

function gaEvent(name: string, params: Record<string, any>) {
    if (!hasConsent('analytics')) return;
    if (!realId(window.BLA_GA_ID)) return;
    if (!window.gtag) return;
    window.gtag('event', name, params);
}

function metaEvent(name: string, params: Record<string, any>) {
    if (!hasConsent('marketing')) return;
    if (!realId(window.BLA_META_ID)) return;
    window.fbq?.('track', name, params);
}

function ttqEvent(name: string, params: Record<string, any>) {
    if (!hasConsent('marketing')) return;
    if (!realId(window.BLA_TTQ_ID)) return;
    window.ttq?.track?.(name, params);
}

export const track = {
    viewItem(item: AnalyticsItem) {
        const value = (item.price || 0) * (item.quantity || 1);
        gaEvent('view_item', { currency: 'USD', value, items: [item] });
        metaEvent('ViewContent', { content_ids: [item.item_id], content_type: 'product', value, currency: 'USD' });
        ttqEvent('ViewContent', { contents: [{ content_id: item.item_id, content_name: item.item_name, quantity: item.quantity || 1, price: item.price }], value, currency: 'USD' });
    },
    selectItem(item: AnalyticsItem, listName?: string) {
        gaEvent('select_item', { item_list_name: listName, items: [item] });
    },
    viewItemList(items: AnalyticsItem[], listName?: string) {
        gaEvent('view_item_list', { item_list_name: listName, items });
    },
    addToCart(item: AnalyticsItem) {
        const value = (item.price || 0) * (item.quantity || 1);
        gaEvent('add_to_cart', { currency: 'USD', value, items: [item] });
        metaEvent('AddToCart', { content_ids: [item.item_id], content_type: 'product', value, currency: 'USD' });
        ttqEvent('AddToCart', { contents: [{ content_id: item.item_id, content_name: item.item_name, quantity: item.quantity || 1, price: item.price }], value, currency: 'USD' });
    },
    removeFromCart(item: AnalyticsItem) {
        const value = (item.price || 0) * (item.quantity || 1);
        gaEvent('remove_from_cart', { currency: 'USD', value, items: [item] });
    },
    viewCart(items: AnalyticsItem[]) {
        const value = items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
        gaEvent('view_cart', { currency: 'USD', value, items });
    },
    beginCheckout(items: AnalyticsItem[]) {
        const value = items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
        gaEvent('begin_checkout', { currency: 'USD', value, items });
        metaEvent('InitiateCheckout', { content_ids: items.map(i => i.item_id), content_type: 'product', value, currency: 'USD', num_items: items.length });
        ttqEvent('InitiateCheckout', { contents: items.map(i => ({ content_id: i.item_id, content_name: i.item_name, quantity: i.quantity || 1, price: i.price })), value, currency: 'USD' });
    },
    purchase(items: AnalyticsItem[], transactionId: string) {
        const value = items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
        gaEvent('purchase', { transaction_id: transactionId, currency: 'USD', value, items });
        metaEvent('Purchase', { content_ids: items.map(i => i.item_id), content_type: 'product', value, currency: 'USD', num_items: items.length });
        ttqEvent('CompletePayment', { contents: items.map(i => ({ content_id: i.item_id, content_name: i.item_name, quantity: i.quantity || 1, price: i.price })), value, currency: 'USD' });
    },
    search(query: string) {
        gaEvent('search', { search_term: query });
    },
    signup(method: string) {
        gaEvent('sign_up', { method });
        metaEvent('Lead', {});
    },
};

/**
 * Fire the `purchase` event when the buyer returns from Stripe checkout.
 *
 * Called once at boot if `?order=success&session_id=cs_...` is in the URL.
 * Reads the cart from localStorage (it hasn't been cleared yet), fires the
 * event, then clears the cart so the drawer starts fresh.
 */
export function completePurchaseIfReturning() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('order') !== 'success') return;
    const sessionId = params.get('session_id') || 'unknown';

    // Dedupe: prevent duplicate purchase events if the user reloads the page.
    const dedupeKey = `bla.purchase.${sessionId}`;
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, '1');

    // The cart is still in localStorage at this point (cleared after this call).
    try {
        const raw = localStorage.getItem('bla.cart');
        if (!raw) return;
        const cart = JSON.parse(raw);
        if (!Array.isArray(cart.items) || !cart.items.length) return;
        const analyticsItems: AnalyticsItem[] = cart.items.map((i: any) => ({
            item_id: String(i.sync_variant_id),
            item_name: i.title,
            item_brand: 'Bottom Line Apparel',
            item_variant: i.variant_label || '',
            price: i.price,
            quantity: i.quantity,
        }));
        track.purchase(analyticsItems, sessionId);
    } catch {
        // Silently ignore — analytics should never break the user flow.
    }
}
