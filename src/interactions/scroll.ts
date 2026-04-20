/**
 * Scroll-based interactions: Sticky cart, reveal observers, and smooth scroll.
 */
export function initScrollInteractions() {
  // Smooth Scroll
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      try {
        const target = document.querySelector(targetId!);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      } catch (err) { console.error('[smooth scroll]', err); }
    });
  });

  // Reveal Observers
  try {
    const revealObs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('.reveal, .reveal-wipe').forEach(el => revealObs.observe(el));

    const depthImgObs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('depth-visible');
          depthImgObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    document.querySelectorAll('.material-depth-img').forEach(img => depthImgObs.observe(img));
  } catch (e) { console.error('[reveal observer]', e); }

  // Sticky Cart
  const stickyCart = document.getElementById('sticky-cart');
  const materialSec = document.getElementById('material');
  if (stickyCart && materialSec) {
    const cartObs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const show = !entry.isIntersecting;
        stickyCart.classList.toggle('visible', show);
        document.body.classList.toggle('cart-active', show);
      });
    }, { threshold: 0, rootMargin: '0px 0px -20px 0px' });
    cartObs.observe(materialSec);
  }

  // Header Scroll State
  const header = document.getElementById('site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 80);
    }, { passive: true });
  }
  // Active Nav Highlight
  try {
    const sections = document.querySelectorAll('section[id]');
    const navAs = document.querySelectorAll('.nav-links a');
    const sectionObs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navAs.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
        }
      });
    }, { rootMargin: '-40% 0px -60% 0px', threshold: 0 });
    sections.forEach(s => sectionObs.observe(s));
  } catch (e) { console.error('[nav observer]', e); }

  // Magnetic Nav CTA
  const magCTA = document.getElementById('header-cta');
  if (magCTA) {
    magCTA.addEventListener('mousemove', (e: any) => {
      const rect = magCTA.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) * 0.22;
      const dy = (e.clientY - cy) * 0.22;
      magCTA.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    magCTA.addEventListener('mouseleave', () => {
      magCTA.style.transform = '';
    });
  }
}
