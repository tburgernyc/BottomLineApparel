/**
 * Bottom Line Apparel — Main Entry Point
 * Upgraded to Institutional Grade (Vite + TypeScript)
 */

import { initNavigation } from './ui/navigation';
import { initModalListeners } from './ui/modals';
import { initCarousel } from './interactions/carousel';
import { initCountdown } from './interactions/countdown';
import { initUGCTicker } from './interactions/ticker';
import { initScrollInteractions } from './interactions/scroll';
import { initVideoAutoplay } from './interactions/video';
import { loadProducts } from './api/products';
import { initAnalytics, completePurchaseIfReturning } from './analytics/analytics';
import { initCookieConsent } from './ui/cookie-consent';
import { initCartDrawer, openCartDrawer } from './ui/cart-drawer';
import { initAnnouncementBar } from './ui/announcement-bar';
import { initSearch } from './ui/search';
import { initNewsletter } from './ui/newsletter';
import { track } from './analytics/analytics';
import { allProducts } from './api/products';
import { clear as clearCart } from './cart/state';

document.addEventListener('DOMContentLoaded', () => {

    // Analytics + consent must come first so any later module that emits
    // events finds the gtag/fbq/ttq hooks already wired.
    initAnalytics();
    initCookieConsent();

    // Fire the purchase event if returning from a successful Stripe checkout.
    // Must run BEFORE cart is cleared, since it reads cart items from localStorage.
    completePurchaseIfReturning();
    // Clear cart on successful return so the drawer shows fresh.
    if (new URLSearchParams(window.location.search).get('order') === 'success') {
        clearCart();
    }

    // Cart + announcement bar must subscribe to cart state before any
    // add-to-cart action fires. The drawer is mounted but hidden until opened.
    initCartDrawer();
    initAnnouncementBar();

    // Core infrastructure
    initNavigation();
    initModalListeners();
    initScrollInteractions();
    initVideoAutoplay();

    // Header search wires its own listeners; index builds lazily on first open.
    initSearch();

    // Features
    initCarousel();
    initCountdown();
    initUGCTicker();   // No-op now that fake UGC is removed; retained for safe boot.

    // Header cart icon → open drawer
    document.getElementById('cart-toggle')?.addEventListener('click', openCartDrawer);

    // Newsletter signup
    initNewsletter();

    // Data hydration. Products power both the grids and the search index.
    // Once loaded, fire one `view_item_list` event per category so GA4 can
    // measure category impressions vs. clicks.
    loadProducts().then(() => {
        for (const [category, items] of Object.entries(allProducts)) {
            if (!items.length) continue;
            track.viewItemList(
                items.slice(0, 10).map(p => ({
                    item_id: String(p.id),
                    item_name: p.title,
                    item_brand: 'Bottom Line Apparel',
                    item_category: category,
                    price: p.min_price,
                })),
                category,
            );
        }
    });

    // Footer year
    const footerYear = document.getElementById('footer-year');
    if (footerYear) footerYear.textContent = String(new Date().getFullYear());

    console.log('%c Bottom Line Apparel %c v3.1 Cart + Express Pay + Search ',
                'background: #ff0055; color: #fff; font-weight: bold;',
                'background: #333; color: #fff;');
});
