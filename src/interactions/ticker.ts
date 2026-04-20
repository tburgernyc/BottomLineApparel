/**
 * Precise pixel-perfect infinite ticker for UGC lookbook.
 */
export function initUGCTicker() {
    const ticker = document.getElementById('ugc-ticker');
    if (!ticker) return;

    const cards = ticker.querySelectorAll('.ugc-card') as NodeListOf<HTMLElement>;
    if (!cards.length) return;

    const half = Math.floor(cards.length / 2);

    const recalc = () => {
        let setWidth = 0;
        const gap = parseFloat(getComputedStyle(ticker).gap) || 24;

        for (let i = 0; i < half; i++) {
            setWidth += cards[i].getBoundingClientRect().width;
            if (i < half - 1) setWidth += gap;
        }
        setWidth += gap;

        ticker.style.setProperty('--ticker-set-w', `${setWidth}px`);
        ticker.style.animation = 'none';
        void ticker.offsetWidth;
        ticker.style.animation = `ugcTickerExact 40s linear infinite`;
    };

    const styleId = 'ugc-ticker-keyframes';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
    }

    const updateKeyframe = () => {
        const setW = ticker.style.getPropertyValue('--ticker-set-w') || '1480px';
        styleEl!.textContent = `
            @keyframes ugcTickerExact {
                from { transform: translateX(0); }
                to   { transform: translateX(calc(-1 * ${setW})); }
            }
        `;
    };

    const ro = new ResizeObserver(() => {
        recalc();
        updateKeyframe();
    });
    ro.observe(ticker);

    requestAnimationFrame(() => {
        recalc();
        updateKeyframe();
    });
}
