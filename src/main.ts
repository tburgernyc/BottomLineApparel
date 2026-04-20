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
import { showToast } from './ui/toast';

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

    // Lemon Squeezy Bridge
    (window as any).createLSCheckout = (url: string) => {
        if ((window as any).LemonSqueezy) {
            (window as any).LemonSqueezy.Url.Open(url);
        } else {
            window.open(url, '_blank');
        }
    };

    if ((window as any).LemonSqueezy) {
        (window as any).LemonSqueezy.Setup({
            eventHandler: (data: any) => {
                if (data.event === 'Checkout.Success') {
                    showToast('Success! Your order is being drafted.', 'success');
                }
            }
        });
    }

    console.log('%c Bottom Line Apparel %c Institutional Grade v2.1 ', 
                'background: #ff0055; color: #fff; font-weight: bold;', 
                'background: #333; color: #fff;');
});
