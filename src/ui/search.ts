/**
 * Lightweight client-side product search.
 *
 * Indexes the loaded `allProducts` catalog over title + short_description +
 * category and renders fuzzy-matched results in the search overlay. Selecting
 * a result opens the product modal.
 *
 * Uses Fuse.js for forgiving matching (tolerates typos, partial words). Index
 * is built lazily on first open, after products have loaded.
 */

import Fuse from 'fuse.js';
import { allProducts, findProductById, loadProducts, type Product } from '../api/products';
import { openCheckoutModal } from './modals';
import { escapeHtml, escapeAttr } from '../utils/helpers';
import { track } from '../analytics/analytics';

let fuse: Fuse<Product> | null = null;
let activeIndex = -1;
let lastResults: Product[] = [];
let hydratePromise: Promise<void> | null = null;

const FUSE_OPTS = {
    keys: [
        { name: 'title', weight: 0.6 },
        { name: 'short_description', weight: 0.3 },
        { name: 'category', weight: 0.1 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: true,
};

function buildIndex() {
    const flat: Product[] = [];
    for (const cat of Object.values(allProducts)) {
        for (const p of cat) flat.push(p);
    }
    fuse = new Fuse(flat, FUSE_OPTS);
}

// On non-home routes loadProducts() is gated out of the boot sequence, so the
// search index would build over an empty allProducts object. Trigger a fetch
// the first time the overlay opens, but only once — concurrent opens reuse
// the in-flight promise.
function ensureHydrated(): Promise<void> {
    if (hydratePromise) return hydratePromise;
    const populated = Object.values(allProducts).some(cat => cat.length > 0);
    if (populated) {
        hydratePromise = Promise.resolve();
        return hydratePromise;
    }
    hydratePromise = loadProducts().then(() => {
        fuse = null;
    });
    return hydratePromise;
}

function renderResults(results: Product[]) {
    const wrap = document.getElementById('search-results');
    if (!wrap) return;
    if (!results.length) {
        wrap.innerHTML = `<p class="search-overlay__empty">No matches. Try "tee", "hoodie", or "phone case".</p>`;
        return;
    }
    wrap.innerHTML = results.map((p, i) => `
      <button type="button" class="search-result${i === activeIndex ? ' is-active' : ''}" role="option" data-product-id="${p.id}">
        <img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.title)}" loading="lazy" width="56" height="56" />
        <span>
          <p class="search-result__title">${escapeHtml(p.title)}</p>
          <p class="search-result__price">$${p.min_price.toFixed(2)}</p>
        </span>
      </button>
    `).join('');

    wrap.querySelectorAll<HTMLElement>('.search-result').forEach(el => {
        el.addEventListener('click', () => selectResult(el.dataset.productId));
    });
}

function selectResult(id: string | null | undefined) {
    if (!id) return;
    const p = findProductById(id);
    if (!p) return;
    closeSearch();
    const slug = window.slugIndex?.[p.id]?.slug ?? p.slug;
    if (slug) {
        window.location.href = `/products/${slug}/`;
    } else {
        openCheckoutModal(p); // Fallback if no slug
    }
}

async function performSearch(query: string) {
    if (!query.trim()) {
        lastResults = [];
        renderResults([]);
        return;
    }
    await ensureHydrated();
    if (!fuse) buildIndex();
    if (!fuse) return;
    const hits = fuse.search(query, { limit: 8 }).map(r => r.item);
    lastResults = hits;
    activeIndex = -1;
    renderResults(hits);
    track.search(query);
}

export function openSearch() {
    const overlay = document.getElementById('search-overlay');
    const input = document.getElementById('search-input') as HTMLInputElement | null;
    if (!overlay || !input) return;
    overlay.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    activeIndex = -1;
    input.value = '';
    renderResults([]);
    setTimeout(() => input.focus(), 50);
    void ensureHydrated().then(() => {
        if (!fuse) buildIndex();
    });
}

export function closeSearch() {
    const overlay = document.getElementById('search-overlay');
    if (!overlay) return;
    overlay.setAttribute('hidden', '');
    document.body.style.overflow = '';
}

let debounceTimer: number | null = null;

export function initSearch() {
    const toggle = document.getElementById('search-toggle');
    const closeBtn = document.getElementById('search-overlay-close');
    const input = document.getElementById('search-input') as HTMLInputElement | null;
    const overlay = document.getElementById('search-overlay');

    toggle?.addEventListener('click', openSearch);
    closeBtn?.addEventListener('click', closeSearch);
    overlay?.addEventListener('click', e => {
        if (e.target === overlay) closeSearch();
    });

    input?.addEventListener('input', () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(() => performSearch(input.value), 140);
    });

    input?.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeSearch();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = Math.min(lastResults.length - 1, activeIndex + 1);
            renderResults(lastResults);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = Math.max(-1, activeIndex - 1);
            renderResults(lastResults);
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            const p = lastResults[activeIndex];
            if (p) selectResult(String(p.id));
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('search-overlay');
            if (overlay && !overlay.hasAttribute('hidden')) closeSearch();
        }
    });
}
