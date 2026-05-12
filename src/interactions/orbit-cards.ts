/**
 * Tap-to-flip orbit cards on touch / no-hover devices.
 *
 * Desktop relies on `.orbit-card:not(.flipped):hover` CSS to show the back —
 * touch devices never get a true hover, so the back side was unreachable
 * before this hook. Now: on (hover: none), tapping the card body toggles a
 * `.flipped` class (which the CSS already styles at styles.css:1236).
 *
 * The CTA button keeps its own click handler (opens the size modal), so tap
 * targets on the back face still work.
 */
export function initOrbitCardTapFlip() {
    if (typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(hover: hover)').matches) return; // desktop — CSS hover handles it

    const flipOn = (card: Element, e: Event) => {
        const target = e.target as HTMLElement;
        // Let CTAs and links handle their own clicks (add-to-cart, etc.)
        if (target.closest('.orbit-card__cta, a, button')) return;
        card.classList.toggle('flipped');
    };

    document.querySelectorAll('.orbit-card').forEach(card => {
        card.addEventListener('click', (e) => flipOn(card, e));
    });

    // Re-bind for orbit cards added after initial render (product grids hydrate
    // from /api/products). Observe the orbit grids for inserted nodes.
    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            m.addedNodes.forEach(node => {
                if (!(node instanceof HTMLElement)) return;
                const cards = node.matches?.('.orbit-card')
                    ? [node]
                    : Array.from(node.querySelectorAll?.('.orbit-card') || []);
                cards.forEach(card => {
                    card.addEventListener('click', (e) => flipOn(card, e));
                });
            });
        }
    });
    document.querySelectorAll('.orbit-grid').forEach(grid => {
        observer.observe(grid, { childList: true, subtree: true });
    });
}
