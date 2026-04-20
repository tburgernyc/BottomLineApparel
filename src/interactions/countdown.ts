/**
 * 72-hour persistence countdown timer.
 */
export function initCountdown() {
    const COUNTDOWN_KEY = 'bla_drop_end';
    const COUNTDOWN_HOURS = 72;

    let endTime = parseInt(localStorage.getItem(COUNTDOWN_KEY) || '0', 10);
    if (!endTime || isNaN(endTime) || endTime < Date.now()) {
        endTime = Date.now() + COUNTDOWN_HOURS * 60 * 60 * 1000;
        localStorage.setItem(COUNTDOWN_KEY, String(endTime));
    }

    const elH = document.getElementById('clock-hours');
    const elM = document.getElementById('clock-minutes');
    const elS = document.getElementById('clock-seconds');

    const setFlip = (el: HTMLElement | null, val: number) => {
        if (!el) return;
        const str = String(val).padStart(2, '0');
        if (el.textContent !== str) {
            el.textContent = str;
            el.classList.remove('flipping');
            void el.offsetWidth; // force reflow
            el.classList.add('flipping');
        }
    };

    const tick = () => {
        const diff = endTime - Date.now();
        if (diff <= 0) {
            endTime = Date.now() + COUNTDOWN_HOURS * 60 * 60 * 1000;
            localStorage.setItem(COUNTDOWN_KEY, String(endTime));
            return;
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setFlip(elH, h);
        setFlip(elM, m);
        setFlip(elS, s);
    };

    tick();
    setInterval(tick, 1000);
}
