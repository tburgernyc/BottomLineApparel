/**
 * Robust video autoplay policy handling.
 */
export function initVideoAutoplay() {
    const forceAutoplay = () => {
        document.querySelectorAll('video').forEach(v => {
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
    forceAutoplay();
    document.querySelectorAll('video').forEach(v => v.addEventListener('canplay', () => v.play()));
}
