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
        const offsetMultiplier = isMobile ? 110 : 140;

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

    slides.forEach((slide, index) => {
        slide.addEventListener('click', () => {
            if (currentIndex !== index) { currentIndex = index; updateCarousel(); resetAutoPlay(); }
        });
    });

    updateCarousel();
    startAutoPlay();
    
    window.addEventListener('resize', updateCarousel);
}
