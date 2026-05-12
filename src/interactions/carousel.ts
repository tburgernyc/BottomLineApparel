/**
 * Institutional Grade 3D Community Carousel (Coverflow).
 */
export function initCarousel() {
    const carouselTrack = document.getElementById('carousel-track');
    const slides = document.querySelectorAll('.carousel-slide');
    const btnPrev = document.getElementById('carousel-prev');
    const btnNext = document.getElementById('carousel-next');

    if (!carouselTrack || !slides.length) return;

    let currentIndex = 0;
    let autoPlayInterval: any;

    const updateCarousel = () => {
        const isMobile = window.innerWidth <= 480;
        const offsetMultiplier = isMobile ? 90 : 140;

        slides.forEach((slide: any, index) => {
            slide.classList.remove('active');
            const offset = index - currentIndex;
            const translateX = offset * offsetMultiplier;
            const scale = 1 - Math.abs(offset) * 0.15;
            const rotateY = offset === 0 ? 0 : (offset > 0 ? -30 : 30);
            const translateZ = -Math.abs(offset) * 100;
            const zIndex = slides.length - Math.abs(offset);

            slide.style.transform = `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
            slide.style.zIndex = zIndex;
            if (offset === 0) slide.classList.add('active');
        });
    };

    const startAutoPlay = () => {
        if (autoPlayInterval) clearInterval(autoPlayInterval);
        autoPlayInterval = setInterval(() => {
            currentIndex = (currentIndex + 1) % slides.length;
            updateCarousel();
        }, 3500);
    };

    const stopAutoPlay = () => clearInterval(autoPlayInterval);
    const resetAutoPlay = () => { stopAutoPlay(); startAutoPlay(); };

    carouselTrack.addEventListener('mouseenter', stopAutoPlay);
    carouselTrack.addEventListener('mouseleave', startAutoPlay);

    btnNext?.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % slides.length;
        updateCarousel(); resetAutoPlay();
    });
    btnPrev?.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + slides.length) % slides.length;
        updateCarousel(); resetAutoPlay();
    });

    // Touch/pointer swipe — needed for mobile, where mouseenter/leave never
    // fire and the prev/next buttons are small targets. Threshold guards
    // against accidental nudges; horizontal-only check lets vertical scroll pass.
    let pointerStartX = 0;
    let pointerStartY = 0;
    let pointerActive = false;
    const SWIPE_THRESHOLD = 50;

    carouselTrack.addEventListener('pointerdown', (e: PointerEvent) => {
        pointerStartX = e.clientX;
        pointerStartY = e.clientY;
        pointerActive = true;
        stopAutoPlay();
    });
    const endSwipe = (e: PointerEvent) => {
        if (!pointerActive) return;
        pointerActive = false;
        const dx = e.clientX - pointerStartX;
        const dy = e.clientY - pointerStartY;
        // Treat as swipe only if horizontal motion dominates — otherwise the
        // user is scrolling the page and we shouldn't hijack.
        if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
            currentIndex = dx < 0
                ? (currentIndex + 1) % slides.length
                : (currentIndex - 1 + slides.length) % slides.length;
            updateCarousel();
        }
        resetAutoPlay();
    };
    carouselTrack.addEventListener('pointerup', endSwipe);
    carouselTrack.addEventListener('pointercancel', endSwipe);

    slides.forEach((slide, index) => {
        slide.addEventListener('click', (e) => {
            // Suppress the click that fires at the end of a horizontal swipe
            // (pointerup → click sequence) so we don't both swipe and snap-to-slide.
            const me = e as MouseEvent;
            if (Math.abs(me.clientX - pointerStartX) > 10) return;
            if (currentIndex !== index) { currentIndex = index; updateCarousel(); resetAutoPlay(); }
        });
    });

    updateCarousel();
    startAutoPlay();

    window.addEventListener('resize', updateCarousel);
}
