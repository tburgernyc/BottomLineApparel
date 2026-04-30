/**
 * Lazy-loads videos that opt-in via `data-src` and starts autoplay.
 *
 * Why deferred: the global background video is ~3.5MB and was previously
 * eagerly loaded, blocking LCP. We now hydrate `src` on `requestIdleCallback`
 * (or a timeout fallback) so the visible above-the-fold content paints first.
 *
 * Existing inline campaign videos that already have a `src` attribute keep
 * their original behavior — they autoplay on `canplay` like before.
 */
export function initVideoAutoplay() {
    const hydrateDeferred = () => {
        document.querySelectorAll<HTMLVideoElement>('video[data-src]').forEach(v => {
            const src = v.dataset.src;
            if (!src || v.src) return;
            v.src = src;
            v.autoplay = true;
            v.muted = true;
            v.load();
        });
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

    // Defer the heavy bg video until the browser is idle.
    if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(hydrateDeferred, { timeout: 2500 });
    } else {
        setTimeout(hydrateDeferred, 1500);
    }

    playAll();
    document.querySelectorAll('video').forEach(v => v.addEventListener('canplay', () => v.play()));
}
