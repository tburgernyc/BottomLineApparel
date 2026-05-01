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
import { initNewsletter } from './ui/newsletter';
import { track } from './analytics/analytics';
import { allProducts } from './api/products';
import { clear as clearCart } from './cart/state';

import { initSearch } from './ui/search';
import { openCheckoutModal } from './ui/modals';

/**
 * Initialize the Product Detail Page logic.
 * Reads the inline JSON payload, configures the "Choose Options" button, and optionally updates the document title.
 */
function initProductDetailPage() {
    const scriptTag = document.getElementById('bla-product');
    if (!scriptTag) return;
    try {
        const productData = JSON.parse(scriptTag.textContent || '');
        const buyBtn = document.getElementById('pdp-buy-btn');
        if (buyBtn) {
            buyBtn.addEventListener('click', () => {
                openCheckoutModal(productData);
            });
        }
    } catch (e) {
        console.error('Failed to parse PDP inline JSON', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {

    // Route identifier comes from <body data-route="..."> in index.html (and
    // future prerendered routes). Defaults to an empty string so unknown
    // routes don't accidentally trigger home-only inits.
    const route = document.body.dataset.route ?? '';
    const isHome = route === 'home';
    const isCollection = route === 'collection';

    // Analytics + consent must come first so any later module that emits
    // events finds the gtag/fbq/ttq hooks already wired.
    initAnalytics();
    initCookieConsent();

    // Fire the purchase event if returning from a successful Stripe checkout.
    // Must run BEFORE cart is cleared, since it reads cart items from localStorage.
    // URL-state driven, not route-specific.
    completePurchaseIfReturning();
    // Clear cart on successful return so the drawer shows fresh.
    if (new URLSearchParams(window.location.search).get('order') === 'success') {
        clearCart();
    }

    // Cart + announcement bar must subscribe to cart state before any
    // add-to-cart action fires. The drawer is mounted but hidden until opened.
    initCartDrawer();
    initAnnouncementBar();

    // Core infrastructure — universal (every route)
    initNavigation();
    initModalListeners();
    initScrollInteractions();
    initVideoAutoplay();

    // Header search wires its own listeners; index builds lazily on first open.
    initSearch();

    // Home-only features. Carousel, countdown, ticker, and the home product
    // grids only exist on `/` — gate them behind data-route="home" so
    // prerendered routes don't waste cycles querying for elements that
    // aren't there.
    if (isHome) {
        initCarousel();
        initCountdown();
        initUGCTicker();   // No-op now that fake UGC is removed; retained for safe boot.
    }

    if (isHome || isCollection) {
        // Data hydration. Products power both the grids and the search index.
        // Once loaded, fire one `view_item_list` event per category so GA4 can
        // measure category impressions vs. clicks.
        loadProducts().then(() => {
            for (const [category, items] of Object.entries(allProducts)) {
                if (!items.length) continue;
                // Only track impression if the category grid is in the DOM
                const gridId = category === 'tshirts' ? 'tshirts-grid' :
                               category === 'cropTops' ? 'crop-tops-grid' :
                               category === 'tanks' ? 'tanks-grid' :
                               category === 'hoodies' ? 'hoodies-grid' :
                               category === 'bottoms' ? 'bottoms-grid' :
                               category === 'phoneCases' ? 'phone-cases-grid' :
                               category === 'headwear' ? 'headwear-grid' :
                               category === 'footwear' ? 'footwear-grid' :
                               category === 'accessories' ? 'accessories-grid' : null;
                if (gridId && !document.getElementById(gridId)) continue;

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
    }

    if (route === 'product') {
        initProductDetailPage();
    }

    // Header cart icon → open drawer (universal)
    document.getElementById('cart-toggle')?.addEventListener('click', openCartDrawer);

    // Newsletter signup — present in footer/join sections; universal for now.
    // TODO[PR1]: route-gate if proven home-only
    initNewsletter();

    // Footer year — universal
    const footerYear = document.getElementById('footer-year');
    if (footerYear) footerYear.textContent = String(new Date().getFullYear());

    console.log('%c Bottom Line Apparel %c v3.1 Cart + Express Pay + Search ',
                'background: #ff0055; color: #fff; font-weight: bold;',
                'background: #333; color: #fff;');
});
