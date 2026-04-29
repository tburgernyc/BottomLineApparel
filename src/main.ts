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

document.addEventListener('DOMContentLoaded', () => {

    // Core Infrastructure
    initNavigation();
    initModalListeners();
    initScrollInteractions();
    initVideoAutoplay();

    // Features
    initCarousel();
    initCountdown();
    initUGCTicker();

    // Data Hydration
    loadProducts();

    // Footer Year
    const footerYear = document.getElementById('footer-year');
    if (footerYear) footerYear.textContent = String(new Date().getFullYear());

    console.log('%c Bottom Line Apparel %c v3.0 Stripe + Printful ',
                'background: #ff0055; color: #fff; font-weight: bold;',
                'background: #333; color: #fff;');
});
