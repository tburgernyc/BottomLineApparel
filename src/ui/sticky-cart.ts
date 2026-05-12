/**
 * Sticky Cart Bar — wires the #sticky-cart element to the product catalog.
 *
 * Shows a fixed bottom bar when the user scrolls past the hero section,
 * populated with the first t-shirt from the catalog. The size <select>
 * is dynamically filled from the product's actual variants.
 *
 * Public API:
 *   - initStickyCart(): call once after loadProducts() resolves on the home route.
 */

import { allProducts, type Product, type Variant } from '../api/products';
import { addItem } from '../cart/state';
import { openCartDrawer } from './cart-drawer';
import { showToast } from './toast';
import { escapeAttr } from '../utils/helpers';

let stickyProduct: Product | null = null;

export function initStickyCart() {
    const bar = document.getElementById('sticky-cart');
    const img = document.getElementById('sticky-cart-img') as HTMLImageElement | null;
    const nameEl = document.getElementById('sticky-cart-name');
    const priceEl = document.getElementById('sticky-cart-price');
    const sizeSelect = document.getElementById('sticky-cart-size') as HTMLSelectElement | null;
    const addBtn = document.getElementById('sticky-cart-btn');

    if (!bar || !sizeSelect || !addBtn) return;

    // Pick the first tshirt as the hero product for the sticky bar.
    const tshirts = allProducts.tshirts || [];
    if (!tshirts.length) return;
    stickyProduct = tshirts[0];

    // Populate product info
    if (img) {
        img.src = stickyProduct.image;
        img.alt = stickyProduct.title;
    }
    if (nameEl) nameEl.textContent = stickyProduct.title;
    if (priceEl) {
        priceEl.textContent = stickyProduct.min_price === stickyProduct.max_price
            ? `$${stickyProduct.min_price.toFixed(2)}`
            : `From $${stickyProduct.min_price.toFixed(2)}`;
    }

    // Populate size select from actual variants
    const sizes = uniqueSizes(stickyProduct.variants);
    sizeSelect.innerHTML = '<option value="">Size</option>' +
        sizes.map(s => `<option value="${escapeAttr(s)}">${s}</option>`).join('');

    // Add to cart handler
    addBtn.addEventListener('click', () => {
        if (!stickyProduct || !sizeSelect.value) {
            showToast('Please select a size first.', 'error');
            return;
        }

        const variant = stickyProduct.variants.find(v => v.size === sizeSelect.value);
        if (!variant) {
            showToast('That size is unavailable.', 'error');
            return;
        }

        const variantLabel = [variant.color, variant.size].filter(Boolean).join(' / ');

        addItem({
            sync_variant_id: variant.id,
            product_id: stickyProduct.id,
            title: stickyProduct.title,
            variant_label: variantLabel,
            image: variant.image || stickyProduct.image,
            price: variant.price,
            quantity: 1,
        });

        showToast(`Added to bag: ${stickyProduct.title} (${variant.size})`, 'success');
        openCartDrawer();
    });

    // IntersectionObserver: show bar when hero scrolls out of view
    const hero = document.getElementById('tshirts');
    if (!hero) return;

    const observer = new IntersectionObserver(
        ([entry]) => {
            if (entry.isIntersecting) {
                bar.classList.remove('visible');
            } else {
                bar.classList.add('visible');
            }
        },
        { threshold: 0 },
    );
    observer.observe(hero);
}

function uniqueSizes(variants: Variant[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of variants) {
        if (v.size && !seen.has(v.size)) {
            seen.add(v.size);
            out.push(v.size);
        }
    }
    return out;
}
