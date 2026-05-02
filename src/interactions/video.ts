/**
 * Lazy-loads videos that opt-in via `data-src` and starts autoplay.
 *
 * Two hydration paths:
 *  - `data-src` only (e.g. global background, hero) — hydrates on
 *    `requestIdleCallback` so the visible above-the-fold content paints
 *    first without paying the multi-MB byte cost.
 *  - `data-src` + `data-lazy="visible"` (e.g. campaign clips below the
 *    fold) — hydrates only when scrolled near the viewport via
 *    IntersectionObserver. Saves the fetch entirely for users who never
 *    scroll past the hero.
 *
 * Existing inline videos that already have a `src` attribute keep their
 * original behavior — they autoplay on `canplay` like before.
 */
export function initVideoAutoplay() {
    const hydrate = (v: HTMLVideoElement) => {
        const src = v.dataset.src;
        if (!src || v.src) return;
        v.src = src;
        v.autoplay = true;
        v.muted = true;
        v.load();
    };

    const hydrateIdle = () => {
        document
            .querySelectorAll<HTMLVideoElement>('video[data-src]:not([data-lazy="visible"])')
            .forEach(hydrate);
    };

    const observeVisible = () => {
        const lazies = document.querySelectorAll<HTMLVideoElement>(
            'video[data-src][data-lazy="visible"]',
        );
        if (lazies.length === 0) return;
        // Fallback: no IntersectionObserver → hydrate immediately so the
        // section isn't visually broken on legacy browsers.
        if (typeof IntersectionObserver === 'undefined') {
            lazies.forEach(hydrate);
            return;
        }
        const io = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const v = entry.target as HTMLVideoElement;
                    hydrate(v);
                    io.unobserve(v);
                });
            },
            { rootMargin: '200px', threshold: 0.01 },
        );
        lazies.forEach(v => io.observe(v));
    };

    const playAll = () => {
        document.querySelectorAll<HTMLVideoElement>('video').forEach(v => {
            v.muted = true;
            const p = v.play();
            if (p !== undefined) {
                p.catch(() => {
                    const resume = () => { v.play(); };
                    window.addEventListener('touchstart', resume, { once: true });
                    window.addEventListener('mousedown', resume, { once: true });
                });
            }
        });
    };

    // Hero + global bg: defer until the browser is idle so they don't compete
    // with LCP-critical assets but still hydrate without a scroll trigger.
    if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(hydrateIdle, { timeout: 2500 });
    } else {
        setTimeout(hydrateIdle, 1500);
    }

    // Below-the-fold clips: only hydrate when the user scrolls near them.
    observeVisible();

    playAll();
    document.querySelectorAll('video').forEach(v => v.addEventListener('canplay', () => v.play()));
}
