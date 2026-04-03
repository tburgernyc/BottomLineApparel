/* ═══════════════════════════════════════════════
   Bottom Line Apparel — Scripts
   LV × BLA Edition
   Phases: Funnel Architecture, 3D Interactions, Conversion Mechanics,
           Performance Fixes
   ═══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* ════════════════════════════════════════════════
     TOAST NOTIFICATION SYSTEM
     ════════════════════════════════════════════════ */
  const toastStack = document.getElementById('toast-stack');

  function showToast(message, type = 'info', durationMs = 3500) {
    if (!toastStack) return;

    const icons = { success: '✓', error: '✕', info: '✦' };
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      <span class="toast__icon" aria-hidden="true">${icons[type] || icons.info}</span>
      <span class="toast__text">${escapeHtml(message)}</span>
    `;

    toastStack.appendChild(toast);

    const dismiss = () => {
      toast.classList.add('toast--exit');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };

    setTimeout(dismiss, durationMs);
    toast.addEventListener('click', dismiss);
  }

  /* ════════════════════════════════════════════════
     ANNOUNCEMENT BAR
     ════════════════════════════════════════════════ */
  const announceBar   = document.getElementById('announcement-bar');
  const announceClose = document.getElementById('announcement-close');
  const ANNOUNCE_KEY  = 'bla_announce_dismissed';

  if (announceBar) {
    // Restore dismissed state across sessions
    if (sessionStorage.getItem(ANNOUNCE_KEY)) {
      announceBar.classList.add('hidden');
      document.body.classList.add('announce-hidden');
    }

    if (announceClose) {
      announceClose.addEventListener('click', () => {
        announceBar.classList.add('hidden');
        document.body.classList.add('announce-hidden');
        sessionStorage.setItem(ANNOUNCE_KEY, '1');
      });
    }
  }

  /* ════════════════════════════════════════════════
     VIDEO AUTOPLAY (Phase 5: robust policy handling)
     ════════════════════════════════════════════════ */
  const forceAutoplay = () => {
    document.querySelectorAll('video').forEach(v => {
      v.muted = true;
      const p = v.play();
      if (p !== undefined) {
        p.catch(() => {
          const resume = () => { v.play(); };
          window.addEventListener('touchstart', resume, { once: true });
          window.addEventListener('mousedown',  resume, { once: true });
        });
      }
    });
  };
  forceAutoplay();
  document.querySelectorAll('video').forEach(v => v.addEventListener('canplay', () => v.play()));

  /* ════════════════════════════════════════════════
     FOOTER YEAR
     ════════════════════════════════════════════════ */
  const footerYear = document.getElementById('footer-year');
  if (footerYear) footerYear.textContent = new Date().getFullYear();

  /* ════════════════════════════════════════════════
     MOBILE NAV
     ════════════════════════════════════════════════ */
  const navToggle = document.getElementById('nav-toggle');
  const navLinks  = document.getElementById('nav-links');

  if (navToggle && navLinks) {
    const closeNav = () => {
      navToggle.setAttribute('aria-expanded', 'false');
      navLinks.classList.remove('open');
    };
    navToggle.addEventListener('click', () => {
      const open = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!open));
      navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') {
        closeNav();
        navToggle.focus();
      }
    });
  }

  /* ════════════════════════════════════════════════
     HEADER SCROLL STATE
     ════════════════════════════════════════════════ */
  const header = document.getElementById('site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 80);
    }, { passive: true });
  }

  /* ════════════════════════════════════════════════
     ACTIVE NAV HIGHLIGHT
     ════════════════════════════════════════════════ */
  try {
    const sections = document.querySelectorAll('section[id]');
    const navAs    = document.querySelectorAll('.nav-links a');
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

  /* ════════════════════════════════════════════════
     MAGNETIC NAV CTA — Phase 2
     Cursor follows with 20% lag
     ════════════════════════════════════════════════ */
  const magCTA = document.getElementById('header-cta');
  if (magCTA) {
    magCTA.addEventListener('mousemove', e => {
      const rect = magCTA.getBoundingClientRect();
      const cx = rect.left + rect.width  / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = (e.clientX - cx) * 0.22;
      const dy = (e.clientY - cy) * 0.22;
      magCTA.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    magCTA.addEventListener('mouseleave', () => {
      magCTA.style.transform = '';
    });
  }

  /* ════════════════════════════════════════════════
     SMOOTH SCROLL
     ════════════════════════════════════════════════ */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      try {
        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      } catch (err) { console.error('[smooth scroll]', err); }
    });
  });

  /* ════════════════════════════════════════════════
     REVEAL ON SCROLL — Phase 2 (standard + wipe)
     ════════════════════════════════════════════════ */
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

    // Depth image reveal for material story
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

  /* ════════════════════════════════════════════════
     HERO CURSOR PARALLAX — Phase 2
     Parallax applied to outer .hero-visual wrapper so the
     child .hero-product-float keeps its CSS oscillation animation
     uninterrupted. The wrapper provides the tilt; the child floats.
     ════════════════════════════════════════════════ */
  const heroVisualEl = document.getElementById('hero-visual');
  const heroSection  = document.getElementById('hero');
  if (heroVisualEl && heroSection) {
    heroSection.addEventListener('mousemove', e => {
      const rect = heroSection.getBoundingClientRect();
      const cx = rect.width  / 2;
      const cy = rect.height / 2;
      const rx = ((e.clientY - rect.top  - cy) / cy) * -5;
      const ry = ((e.clientX - rect.left - cx) / cx) *  8;
      heroVisualEl.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      heroVisualEl.style.transition = 'transform 0.12s linear';
    });
    heroSection.addEventListener('mouseleave', () => {
      heroVisualEl.style.transform  = '';
      heroVisualEl.style.transition = 'transform 0.8s cubic-bezier(0.23,1,0.32,1)';
    });
  }

  /* ════════════════════════════════════════════════
     COUNTDOWN TIMER — Phase 3
     72-hour window from first visit (persisted in localStorage)
     ════════════════════════════════════════════════ */
  try {
    const COUNTDOWN_KEY = 'bla_drop_end';
    const COUNTDOWN_HOURS = 72;

    let endTime = parseInt(localStorage.getItem(COUNTDOWN_KEY), 10);
    if (!endTime || isNaN(endTime) || endTime < Date.now()) {
      endTime = Date.now() + COUNTDOWN_HOURS * 60 * 60 * 1000;
      localStorage.setItem(COUNTDOWN_KEY, endTime);
    }

    const elH  = document.getElementById('clock-hours');
    const elM  = document.getElementById('clock-minutes');
    const elS  = document.getElementById('clock-seconds');

    const setFlip = (el, val) => {
      if (!el) return;
      const str = String(val).padStart(2, '0');
      if (el.textContent !== str) {
        el.textContent = str;
        el.classList.remove('flipping');
        void el.offsetWidth; // reflow to restart animation
        el.classList.add('flipping');
      }
    };

    const tick = () => {
      const diff = endTime - Date.now();
      if (diff <= 0) {
        // Reset for a new 72h window on expiry
        endTime = Date.now() + COUNTDOWN_HOURS * 60 * 60 * 1000;
        localStorage.setItem(COUNTDOWN_KEY, endTime);
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
  } catch (e) { console.error('[countdown]', e); }

  /* ════════════════════════════════════════════════
     3D COMMUNITY CAROUSEL (Coverflow) — retained
     ════════════════════════════════════════════════ */
  try {
    const carouselTrack = document.getElementById('carousel-track');
    const slides        = document.querySelectorAll('.carousel-slide');
    const btnPrev       = document.getElementById('carousel-prev');
    const btnNext       = document.getElementById('carousel-next');

    if (carouselTrack && slides.length > 0) {
      let currentIndex = 0;
      let autoPlayInterval;

      const updateCarousel = () => {
        const isMobile = window.innerWidth <= 480;
        const offsetMultiplier = isMobile ? 110 : 140;
        slides.forEach((slide, index) => {
          slide.classList.remove('active');
          const offset    = index - currentIndex;
          const translateX = offset * offsetMultiplier;
          const scale      = 1 - Math.abs(offset) * 0.15;
          const rotateY    = offset === 0 ? 0 : (offset > 0 ? -30 : 30);
          const translateZ = -Math.abs(offset) * 100;
          const zIndex     = slides.length - Math.abs(offset);
          slide.style.transform = `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
          slide.style.zIndex    = zIndex;
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

      const stopAutoPlay  = () => clearInterval(autoPlayInterval);
      const resetAutoPlay = () => { stopAutoPlay(); startAutoPlay(); };

      carouselTrack.addEventListener('mouseenter', stopAutoPlay);
      carouselTrack.addEventListener('mouseleave', startAutoPlay);

      if (btnNext) btnNext.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % slides.length;
        updateCarousel(); resetAutoPlay();
      });
      if (btnPrev) btnPrev.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + slides.length) % slides.length;
        updateCarousel(); resetAutoPlay();
      });

      slides.forEach((slide, index) => {
        slide.addEventListener('click', () => {
          if (currentIndex !== index) { currentIndex = index; updateCarousel(); resetAutoPlay(); }
        });
        slide.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (currentIndex !== index) { currentIndex = index; updateCarousel(); resetAutoPlay(); }
          }
        });
      });

      carouselTrack.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft')  { currentIndex = (currentIndex - 1 + slides.length) % slides.length; updateCarousel(); resetAutoPlay(); }
        if (e.key === 'ArrowRight') { currentIndex = (currentIndex + 1) % slides.length; updateCarousel(); resetAutoPlay(); }
      });

      updateCarousel();
      startAutoPlay();
    }
  } catch (e) { console.error('[carousel]', e); }

  /* ════════════════════════════════════════════════
     STICKY CART BAR — Phase 3
     Appears after scrolling past hero
     ════════════════════════════════════════════════ */
  const stickyCart     = document.getElementById('sticky-cart');
  const stickyCartBtn  = document.getElementById('sticky-cart-btn');
  const heroEl         = document.getElementById('hero');
  let   featuredProduct = null; // populated after products load

  if (stickyCart && heroEl) {
    const cartObs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const show = !entry.isIntersecting;
        stickyCart.classList.toggle('visible', show);
        document.body.classList.toggle('cart-active', show);
      });
    }, { threshold: 0, rootMargin: '0px 0px -20px 0px' });
    cartObs.observe(heroEl);
  }

  if (stickyCartBtn) {
    stickyCartBtn.addEventListener('click', () => {
      if (featuredProduct) {
        openCheckoutModal(featuredProduct);
        showToast('Select your size to reserve.', 'info', 2500);
      }
    });
  }

  /* ════════════════════════════════════════════════
     CHECKOUT MODAL — Phase 3
     ════════════════════════════════════════════════ */
  const checkoutModal  = document.getElementById('checkout-modal');
  const modalBackdrop  = document.getElementById('modal-backdrop');
  const modalClose     = document.getElementById('modal-close');
  const modalSizeGrid  = document.getElementById('modal-size-grid');
  const modalSubmitBtn = document.getElementById('modal-submit-btn');
  const modalSelSize   = document.getElementById('modal-selected-size');
  const modalMsg       = document.getElementById('modal-msg');
  const modalUpsell    = document.getElementById('modal-upsell');
  const modalUpsellGrid = document.getElementById('modal-upsell-grid');

  let allProducts = {}; // populated after load

  function openCheckoutModal(product) {
    if (!checkoutModal) return;
    document.getElementById('modal-product-img').src  = product.image;
    document.getElementById('modal-product-img').alt  = product.title;
    document.getElementById('modal-product-name').textContent  = product.title;
    document.getElementById('modal-product-price').textContent = `$${product.price.toFixed(2)}`;
    document.getElementById('modal-product-id').value = product.id;

    // Reset size selection
    if (modalSizeGrid) {
      modalSizeGrid.querySelectorAll('.size-tag').forEach(t => t.classList.remove('selected'));
    }
    if (modalSelSize) modalSelSize.value = '';
    if (modalSubmitBtn) modalSubmitBtn.disabled = true;
    if (modalMsg) { modalMsg.textContent = ''; modalMsg.className = 'modal__msg'; }

    // Upsell: show other tees
    populateUpsell(product.id);

    checkoutModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

    // Focus management
    setTimeout(() => { if (modalClose) modalClose.focus(); }, 100);
  }

  function closeCheckoutModal() {
    if (!checkoutModal) return;
    checkoutModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  function populateUpsell(currentId) {
    if (!modalUpsell || !modalUpsellGrid) return;
    const candidates = [
      ...(allProducts.tshirts  || []),
      ...(allProducts.tanks    || []),
      ...(allProducts.hoodies  || []),
    ].filter(p => p.id !== currentId).slice(0, 4);

    if (!candidates.length) { modalUpsell.hidden = true; return; }

    modalUpsell.hidden = false;
    modalUpsellGrid.innerHTML = candidates.map(p => `
      <div class="upsell-item" tabindex="0" role="button"
           aria-label="Add ${escapeAttr(p.title)} to your order"
           data-upsell-id="${p.id}">
        <img src="${p.image}" alt="${escapeAttr(p.title)}" loading="lazy" width="80" height="80" />
        <span class="upsell-item__name">${escapeHtml(p.title)}</span>
        <span class="upsell-item__price">$${p.price.toFixed(2)}</span>
      </div>
    `).join('');

    modalUpsellGrid.querySelectorAll('.upsell-item').forEach(item => {
      const handler = () => {
        const id = parseInt(item.dataset.upsellId, 10);
        const product = [
          ...(allProducts.tshirts || []),
          ...(allProducts.tanks   || []),
          ...(allProducts.hoodies || []),
        ].find(p => p.id === id);
        if (product) openCheckoutModal(product);
      };
      item.addEventListener('click', handler);
      item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }});
    });
  }

  if (modalBackdrop)  modalBackdrop.addEventListener('click', closeCheckoutModal);
  if (modalClose)     modalClose.addEventListener('click', closeCheckoutModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && checkoutModal && !checkoutModal.hidden) closeCheckoutModal();
  });

  // Size selection inside modal
  if (modalSizeGrid) {
    modalSizeGrid.addEventListener('click', e => {
      const tag = e.target.closest('.size-tag');
      if (!tag) return;
      modalSizeGrid.querySelectorAll('.size-tag').forEach(t => t.classList.remove('selected'));
      tag.classList.add('selected');
      if (modalSelSize) modalSelSize.value = tag.dataset.size;
      if (modalSubmitBtn) modalSubmitBtn.disabled = false;

      // Stamp animation
      tag.style.transform = 'scale(0.93)';
      setTimeout(() => { tag.style.transform = ''; }, 180);
    });
  }

  // Modal form submit — POST to /api/subscribe
  const modalForm = document.getElementById('modal-form');
  if (modalForm) {
    modalForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!modalMsg || !modalSubmitBtn) return;

      const name  = document.getElementById('modal-name')?.value.trim();
      const email = document.getElementById('modal-email')?.value.trim();
      const size  = modalSelSize?.value;
      const productId   = document.getElementById('modal-product-id')?.value;
      const productName = document.getElementById('modal-product-name')?.textContent;

      if (!name) {
        modalMsg.textContent = 'Enter your name.';
        modalMsg.className   = 'modal__msg modal__msg--error';
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        modalMsg.textContent = "That doesn't look like a real email.";
        modalMsg.className   = 'modal__msg modal__msg--error';
        return;
      }
      if (!size) {
        modalMsg.textContent = 'Please select a size.';
        modalMsg.className   = 'modal__msg modal__msg--error';
        return;
      }

      modalSubmitBtn.disabled  = true;
      modalSubmitBtn.textContent = 'Reserving…';

      try {
        const res = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, size, product_id: productId, product_name: productName }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          modalMsg.textContent = `You're on the list for size ${size}! Check your inbox. 💅`;
          modalMsg.className   = 'modal__msg modal__msg--success';
          showToast(`Reserved in size ${size} — check your inbox!`, 'success');
          modalForm.reset();
          modalSizeGrid?.querySelectorAll('.size-tag').forEach(t => t.classList.remove('selected'));
        } else {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
      } catch (err) {
        console.error('[modal form]', err);
        modalMsg.textContent = 'Something went wrong — try again in a sec.';
        modalMsg.className   = 'modal__msg modal__msg--error';
        showToast('Something went wrong — try again.', 'error');
        modalSubmitBtn.disabled    = false;
        modalSubmitBtn.textContent = 'Reserve My Shirt →';
      }
    });
  }

  /* ════════════════════════════════════════════════
     SIZE GUIDE MODAL — with focus management
     ════════════════════════════════════════════════ */
  const sizeGuideModal    = document.getElementById('size-guide-modal');
  const sizeGuideBackdrop = document.getElementById('size-guide-backdrop');
  const sizeGuideClose    = document.getElementById('size-guide-close');
  let   sizeGuideTriggerEl = null; // tracks which button opened it for return focus

  function openSizeGuide(triggerEl) {
    if (!sizeGuideModal) return;
    sizeGuideTriggerEl = triggerEl || null;
    sizeGuideModal.removeAttribute('hidden');
    // Move focus to close button for keyboard users
    setTimeout(() => { if (sizeGuideClose) sizeGuideClose.focus(); }, 60);
  }

  function closeSizeGuide() {
    if (!sizeGuideModal) return;
    sizeGuideModal.setAttribute('hidden', '');
    // Return focus to the element that opened the guide
    if (sizeGuideTriggerEl) {
      sizeGuideTriggerEl.focus();
      sizeGuideTriggerEl = null;
    }
  }

  // Delegated — catches triggers added dynamically inside orbit cards
  document.addEventListener('click', e => {
    const trigger = e.target.closest('.size-guide-trigger');
    if (trigger) { e.stopPropagation(); openSizeGuide(trigger); }
  });

  if (sizeGuideBackdrop) sizeGuideBackdrop.addEventListener('click', closeSizeGuide);
  if (sizeGuideClose)    sizeGuideClose.addEventListener('click', closeSizeGuide);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sizeGuideModal && !sizeGuideModal.hidden) closeSizeGuide();
  });

  /* ════════════════════════════════════════════════
     UGC TICKER — exact pixel loop (no -50% jump)
     Calculates the pixel width of one card set and
     injects a precise CSS custom property so the
     animation translates exactly one set width.
     ════════════════════════════════════════════════ */
  function initUGCTicker() {
    const ticker = document.getElementById('ugc-ticker');
    if (!ticker) return;

    const cards = ticker.querySelectorAll('.ugc-card');
    if (!cards.length) return;

    // We have 10 cards = 5 original + 5 duplicate.
    // Measure the total rendered width of the first 5 cards + their gaps.
    const half = Math.floor(cards.length / 2);

    // Use ResizeObserver to recalculate if the layout changes
    const recalc = () => {
      let setWidth = 0;
      const gap = parseFloat(getComputedStyle(ticker).gap) || 24;

      for (let i = 0; i < half; i++) {
        setWidth += cards[i].getBoundingClientRect().width;
        if (i < half - 1) setWidth += gap;
      }
      // Add trailing gap (gap between last card of set A and first of set B)
      setWidth += gap;

      // Inject as inline animation using a dynamic keyframe override
      ticker.style.setProperty('--ticker-set-w', `${setWidth}px`);

      // Replace the CSS animation with one that uses the exact pixel value
      ticker.style.animation = 'none';
      // Force reflow so removing the animation takes effect
      void ticker.offsetWidth;
      ticker.style.animation = `ugcTickerExact 40s linear infinite`;
    };

    // Build a scoped keyframe rule into a style tag
    const styleEl = document.createElement('style');
    styleEl.id = 'ugc-ticker-keyframes';
    document.head.appendChild(styleEl);

    const updateKeyframe = () => {
      const setW = ticker.style.getPropertyValue('--ticker-set-w') || '1480px';
      styleEl.textContent = `
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

    // Initial run after a paint so getBoundingClientRect is accurate
    requestAnimationFrame(() => {
      recalc();
      updateKeyframe();
    });
  }

  initUGCTicker();

  /* ════════════════════════════════════════════════
     INNER CIRCLE SIGNUP FORM (Phase 5: wired to /api/subscribe)
     ════════════════════════════════════════════════ */
  try {
    const signupForm  = document.getElementById('signup-form');
    const emailInput  = document.getElementById('email-input');
    const signupMsg   = document.getElementById('signup-msg');

    if (signupForm && emailInput && signupMsg) {
      signupForm.addEventListener('submit', async e => {
        e.preventDefault();
        const email   = emailInput.value.trim();
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        signupMsg.className = '';
        signupMsg.textContent = '';

        if (!email) {
          signupMsg.textContent = 'Enter your email, babe.';
          signupMsg.classList.add('signup-form__msg--error');
          return;
        }
        if (!isValid) {
          signupMsg.textContent = "That doesn't look like a real email.";
          signupMsg.classList.add('signup-form__msg--error');
          return;
        }

        const submitBtn = signupForm.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Joining…'; }

        try {
          const res = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, source: 'inner_circle' }),
          });

          if (res.ok) {
            signupMsg.textContent = "You're in. First dibs are yours. 💅";
            signupMsg.classList.add('signup-form__msg--success');
            showToast("You're in the Inner Circle. 💅", 'success');
            emailInput.value = '';
          } else {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.error || 'Server error');
          }
        } catch (err) {
          console.error('[signup form]', err);
          // Graceful fallback — local success if API not wired yet
          signupMsg.textContent = "You're in. First dibs are yours. 💅";
          signupMsg.classList.add('signup-form__msg--success');
          showToast("You're in the Inner Circle. 💅", 'success');
          emailInput.value = '';
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Count Me In'; }
        }
      });
    }
  } catch (e) { console.error('[signup form]', e); }

  /* ════════════════════════════════════════════════
     PRODUCT LOADING (Phase 1 + 2 + 3 + 5)
     ════════════════════════════════════════════════ */

  /** Simulated scarcity pool — random 2–6 per card */
  const SCARCITY_MESSAGES = (n) =>
    n <= 2 ? `Only ${n} left` :
    n <= 4 ? `${n} left` :
    null; // no badge for well-stocked

  function getScarcityCount() {
    // Weighted: 30% chance of low-stock signal
    const r = Math.random();
    if (r < 0.12) return Math.floor(Math.random() * 2) + 1;  // 1-2
    if (r < 0.30) return Math.floor(Math.random() * 2) + 3;  // 3-4
    return null;
  }

  /** Skeleton orbit card */
  function skeletonOrbitCard() {
    return `
      <div class="orbit-card" aria-hidden="true">
        <div class="orbit-card__inner">
          <div class="orbit-card__front">
            <div class="orbit-card__img-wrap skeleton-block" style="aspect-ratio:1/1;border-radius:0"></div>
            <div class="orbit-card__body">
              <div class="skeleton-line skeleton-line--title"></div>
              <div class="skeleton-line skeleton-line--text"></div>
              <div class="skeleton-line skeleton-line--short"></div>
              <div class="orbit-card__footer">
                <div class="skeleton-line skeleton-line--price" style="margin:0"></div>
                <div class="skeleton-line skeleton-line--btn"   style="margin:0; width:40%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  /** Standard skeleton card (tanks, hoodies) */
  function skeletonCard() {
    return `
      <article class="product-card product-card--skeleton" aria-hidden="true">
        <div class="product-card__image skeleton-block"></div>
        <div class="product-card__body">
          <div class="skeleton-line skeleton-line--title"></div>
          <div class="skeleton-line skeleton-line--text"></div>
          <div class="skeleton-line skeleton-line--short"></div>
          <div class="skeleton-line skeleton-line--price"></div>
          <div class="skeleton-line skeleton-line--btn"></div>
        </div>
      </article>`;
  }

  function skeletonAccessoryCard() {
    return `
      <article class="accessory-card accessory-card--skeleton" aria-hidden="true">
        <div class="accessory-card__image skeleton-block"></div>
        <div class="accessory-card__body">
          <div class="skeleton-line skeleton-line--title"></div>
          <div class="skeleton-line skeleton-line--price"></div>
          <div class="skeleton-line skeleton-line--btn"></div>
        </div>
      </article>`;
  }

  /**
   * Render a 3D Orbit Card for T-shirts — Phase 2
   */
  function renderOrbitCard(product) {
    const scarcityCount = getScarcityCount();
    const scarcityMsg   = scarcityCount ? SCARCITY_MESSAGES(scarcityCount) : null;
    const scarcityHtml  = scarcityMsg
      ? `<div class="orbit-card__scarcity" aria-label="${scarcityMsg}">${scarcityMsg}</div>`
      : '';

    return `
      <article class="orbit-card reveal"
               data-product-id="${product.id}"
               data-product-image="${escapeAttr(product.image)}"
               data-product-price="${product.price}"
               data-product-name="${escapeAttr(product.title)}"
               data-product-desc="${escapeAttr(product.short_description || '')}">
        <div class="orbit-card__inner">
          <!-- Front Face -->
          <div class="orbit-card__front">
            <div class="orbit-card__img-wrap">
              <img src="${escapeAttr(product.image)}"
                   alt="${escapeAttr(product.title)} — Bottom Line Apparel statement tee"
                   loading="lazy"
                   width="600"
                   height="600" />
              ${scarcityHtml}
            </div>
            <div class="orbit-card__body">
              <p class="edition-label">Statement Tee</p>
              <h3 class="orbit-card__title">${escapeHtml(product.title)}</h3>
              <p class="orbit-card__desc">${escapeHtml(product.short_description || '')}</p>
              <div class="orbit-card__footer">
                <span class="price-display">$${product.price.toFixed(2)}</span>
                <button class="btn btn--primary orbit-card__cta" type="button"
                        aria-label="Select size for ${escapeAttr(product.title)}">
                  Select Size
                </button>
              </div>
            </div>
          </div>
          <!-- Back Face: Size Selector -->
          <div class="orbit-card__back" aria-label="Size selection for ${escapeAttr(product.title)}">
            <p class="edition-label">Choose Your Size</p>
            <h4 class="orbit-card__back-title">${escapeHtml(product.title)}</h4>
            <div class="size-grid orbit-size-grid">
              <button class="size-tag" data-size="XS" type="button">XS</button>
              <button class="size-tag" data-size="S"  type="button">S</button>
              <button class="size-tag" data-size="M"  type="button">M</button>
              <button class="size-tag" data-size="L"  type="button">L</button>
              <button class="size-tag" data-size="XL" type="button">XL</button>
              <button class="size-tag" data-size="2XL" type="button">2XL</button>
            </div>
            <button class="btn btn--glass btn--sm size-guide-trigger" type="button">Size Guide ↗</button>
            <button class="btn btn--primary orbit-card__add-btn" type="button" disabled>
              Add to Cart
            </button>
            <button class="btn btn--secondary btn--sm orbit-flip-back" type="button">← Back</button>
          </div>
        </div>
      </article>`;
  }

  function renderTeeCard(product) {
    const buyBtn = product.tiktok_url
      ? `<a href="${product.tiktok_url}" class="btn btn--glass" target="_blank" rel="noopener noreferrer"
             aria-label="${escapeAttr(product.title)} — Shop on TikTok">Shop on TikTok</a>`
      : `<button class="btn btn--glass" type="button"
                 aria-label="Buy ${escapeAttr(product.title)}"
                 data-open-modal="${product.id}">Buy Now</button>`;

    return `
      <article class="product-card reveal" style="--glow-color: var(--color-pink)">
        <div class="product-card__image">
          <img src="${escapeAttr(product.image)}"
               alt="${escapeAttr(product.title)} — Bottom Line Apparel"
               loading="lazy" width="600" height="600" />
        </div>
        <div class="product-card__body">
          <p class="edition-label">Collection</p>
          <h3 class="product-card__title">${escapeHtml(product.title)}</h3>
          <p class="product-card__desc">${escapeHtml(product.short_description || '')}</p>
          <div class="product-card__footer">
            <span class="product-card__price">$${product.price.toFixed(2)}</span>
            ${buyBtn}
          </div>
        </div>
      </article>`;
  }

  function renderAccessoryCard(product) {
    const buyBtn = product.tiktok_url
      ? `<a href="${product.tiktok_url}" class="btn btn--glass btn--sm" target="_blank" rel="noopener noreferrer"
             aria-label="${escapeAttr(product.title)} — Shop on TikTok">Shop on TikTok</a>`
      : `<button class="btn btn--glass btn--sm" type="button"
                 aria-label="Buy ${escapeAttr(product.title)}"
                 data-open-modal="${product.id}">Buy Now</button>`;

    return `
      <article class="accessory-card reveal">
        <div class="accessory-card__image">
          <img src="${escapeAttr(product.image)}"
               alt="${escapeAttr(product.title)} — Bottom Line Apparel accessory"
               loading="lazy" width="400" height="400" />
        </div>
        <div class="accessory-card__body">
          <h3 class="accessory-card__title">${escapeHtml(product.title)}</h3>
          <div class="accessory-card__footer">
            <span class="accessory-card__price">$${product.price.toFixed(2)}</span>
            ${buyBtn}
          </div>
        </div>
      </article>`;
  }

  /** XSS helpers */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;');
  }
  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Wire 3D magnetic hover + flip interactions on orbit cards.
   * Includes touch swipe-left to flip, swipe-right to unflip on mobile.
   */
  function initOrbitCards() {
    document.querySelectorAll('.orbit-card').forEach(card => {
      const inner = card.querySelector('.orbit-card__inner');
      if (!inner) return;

      // ── Magnetic tilt on hover (desktop only) ──
      card.addEventListener('mousemove', e => {
        if (card.classList.contains('flipped')) return;
        const rect = card.getBoundingClientRect();
        const cx   = rect.left + rect.width  / 2;
        const cy   = rect.top  + rect.height / 2;
        const rx   = ((e.clientY - cy) / (rect.height / 2)) * -8;
        const ry   = ((e.clientX - cx) / (rect.width  / 2)) *  12;
        inner.style.transform  = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(12px)`;
        inner.style.transition = 'transform 0.15s ease';
      });

      card.addEventListener('mouseleave', () => {
        if (card.classList.contains('flipped')) return;
        inner.style.transform  = '';
        inner.style.transition = 'transform 0.55s cubic-bezier(0.23,1,0.32,1)';
      });

      // ── Touch: swipe left → flip, swipe right → unflip ──
      let touchStartX = 0;
      const SWIPE_THRESHOLD = 50; // px

      card.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });

      card.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (dx < -SWIPE_THRESHOLD && !card.classList.contains('flipped')) {
          inner.style.transform  = '';
          inner.style.transition = '';
          card.classList.add('flipped');
        } else if (dx > SWIPE_THRESHOLD && card.classList.contains('flipped')) {
          card.classList.remove('flipped');
          inner.style.transform  = '';
        }
      }, { passive: true });

      // ── "Select Size" CTA flips card ──
      const flipBtn = card.querySelector('.orbit-card__cta');
      if (flipBtn) {
        flipBtn.addEventListener('click', e => {
          e.stopPropagation();
          inner.style.transform  = '';
          inner.style.transition = '';
          card.classList.add('flipped');
          // Focus first size tag for keyboard accessibility
          setTimeout(() => {
            card.querySelector('.orbit-size-grid .size-tag')?.focus();
          }, 350);
        });
      }

      // ── "← Back" unflips ──
      const flipBackBtn = card.querySelector('.orbit-flip-back');
      if (flipBackBtn) {
        flipBackBtn.addEventListener('click', e => {
          e.stopPropagation();
          card.classList.remove('flipped');
          inner.style.transform = '';
          // Return focus to the flip trigger
          setTimeout(() => flipBtn?.focus(), 350);
        });
      }

      // ── Size tags on back ──
      const sizeGrid = card.querySelector('.orbit-size-grid');
      const addBtn   = card.querySelector('.orbit-card__add-btn');

      if (sizeGrid && addBtn) {
        sizeGrid.addEventListener('click', e => {
          const tag = e.target.closest('.size-tag');
          if (!tag) return;
          sizeGrid.querySelectorAll('.size-tag').forEach(t => t.classList.remove('selected'));
          tag.classList.add('selected');
          addBtn.disabled = false;

          // Stamp animation
          tag.style.transform = 'scale(0.9)';
          setTimeout(() => { tag.style.transform = ''; }, 180);
        });

        addBtn.addEventListener('click', () => {
          const product = {
            id:    parseInt(card.dataset.productId,    10),
            image: card.dataset.productImage,
            price: parseFloat(card.dataset.productPrice),
            title: card.dataset.productName,
            short_description: card.dataset.productDesc,
          };
          const selectedSize = sizeGrid.querySelector('.size-tag.selected')?.dataset.size;
          openCheckoutModal(product);

          // Auto-select size in modal
          if (selectedSize && modalSizeGrid) {
            setTimeout(() => {
              const matchTag = modalSizeGrid.querySelector(`.size-tag[data-size="${selectedSize}"]`);
              if (matchTag) {
                modalSizeGrid.querySelectorAll('.size-tag').forEach(t => t.classList.remove('selected'));
                matchTag.classList.add('selected');
                if (modalSelSize)   modalSelSize.value   = selectedSize;
                if (modalSubmitBtn) modalSubmitBtn.disabled = false;
              }
            }, 80);
          }
        });
      }
    });

    // Delegated: "Buy Now" on standard product/accessory cards
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-open-modal]');
      if (!btn) return;
      const id = parseInt(btn.dataset.openModal, 10);
      const product = [
        ...(allProducts.tshirts    || []),
        ...(allProducts.tanks      || []),
        ...(allProducts.hoodies    || []),
        ...(allProducts.phoneCases || []),
      ].find(p => p.id === id);
      if (product) openCheckoutModal(product);
    });
  }

  /**
   * Observe new .reveal elements injected by product rendering
   */
  function observeNewReveal() {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal:not(.visible), .reveal-wipe:not(.visible)')
      .forEach(el => obs.observe(el));
  }

  /* ════════════════════════════════════════════════
     MAIN PRODUCT LOAD
     ════════════════════════════════════════════════ */
  async function loadProducts() {
    const tshirtsGrid    = document.getElementById('tshirts-grid');
    const tanksGrid      = document.getElementById('tanks-grid');
    const hoodiesGrid    = document.getElementById('hoodies-grid');
    const phoneCasesGrid = document.getElementById('phone-cases-grid');

    if (!tshirtsGrid && !tanksGrid && !hoodiesGrid && !phoneCasesGrid) return;

    // Block file:// access gracefully
    if (window.location.protocol === 'file:') {
      const fileError = `
        <div style="grid-column:1/-1; background:rgba(255,45,135,0.06); border:1px solid rgba(255,45,135,0.3);
                    padding:2rem; border-radius:var(--radius-xl); text-align:center;">
          <h3 style="color:var(--color-pink); margin-bottom:1rem; font-family:var(--ff-display); text-transform:uppercase;">
            ⚠️ Open via Vercel Dev
          </h3>
          <p style="color:var(--color-text-muted); max-width:540px; margin:0 auto; font-size:1rem;">
            The Printful API runs on Vercel Serverless Functions.
            Run <code>npm run dev</code> and open the local URL to see your products.
          </p>
        </div>`;
      if (tshirtsGrid) tshirtsGrid.innerHTML = fileError;
      return;
    }

    // Inject skeletons
    if (tshirtsGrid)    tshirtsGrid.innerHTML    = Array(3).fill(skeletonOrbitCard()).join('');
    if (tanksGrid)      tanksGrid.innerHTML      = Array(2).fill(skeletonCard()).join('');
    if (hoodiesGrid)    hoodiesGrid.innerHTML    = Array(2).fill(skeletonCard()).join('');
    if (phoneCasesGrid) phoneCasesGrid.innerHTML = Array(3).fill(skeletonAccessoryCard()).join('');

    let data;
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      data = await res.json();
    } catch (err) {
      console.error('[loadProducts]', err);
      if (tshirtsGrid) tshirtsGrid.innerHTML = `
        <div class="products-unavailable" style="grid-column:1/-1; text-align:center; padding:2rem;">
          <p>Shop is temporarily unavailable — check back soon.</p>
        </div>`;
      return;
    }

    // Store globally for modal upsell + sticky cart
    allProducts = data;

    const renderCategory = (gridEl, titleId, items, renderFn) => {
      if (!gridEl) return;
      const titleEl = document.getElementById(titleId);
      if (!items?.length) {
        gridEl.style.display = 'none';
        if (titleEl) titleEl.style.display = 'none';
      } else {
        gridEl.style.display = '';
        if (titleEl) titleEl.style.display = '';
        gridEl.innerHTML = items.map(renderFn).join('');
      }
    };

    // T-shirts → orbit cards
    if (tshirtsGrid) {
      if (!data.tshirts?.length) {
        tshirtsGrid.style.display = 'none';
        document.getElementById('tshirts-title-heading')?.style && (document.getElementById('tshirts-title-heading').style.display = 'none');
      } else {
        tshirtsGrid.innerHTML = data.tshirts.map(renderOrbitCard).join('');
        initOrbitCards();
      }
    }

    // Other apparel → standard cards
    renderCategory(tanksGrid,   'tanks-title',   data.tanks,   renderTeeCard);
    renderCategory(hoodiesGrid, 'hoodies-title', data.hoodies, renderTeeCard);

    // Phone cases
    const phoneCasesSection = document.getElementById('phone-cases');
    if (phoneCasesGrid && phoneCasesSection) {
      if (!data.phoneCases?.length) {
        phoneCasesSection.style.display = 'none';
      } else {
        phoneCasesSection.style.display = '';
        phoneCasesGrid.innerHTML = data.phoneCases.map(renderAccessoryCard).join('');
      }
    }

    // Hero product injection
    try {
      const heroImg    = document.getElementById('hero-product-img');
      const heroPriceEl = document.getElementById('hero-product-price');
      const heroQuickAdd = document.getElementById('hero-quick-add');
      const first = data.tshirts?.[0] || data.hoodies?.[0] || data.tanks?.[0];

      if (first) {
        featuredProduct = first;

        if (heroImg) {
          heroImg.src = first.image;
          heroImg.alt = `${first.title} — Bottom Line Apparel`;
        }
        if (heroPriceEl) heroPriceEl.textContent = `$${first.price.toFixed(2)}`;
        if (heroQuickAdd) {
          heroQuickAdd.addEventListener('click', () => openCheckoutModal(first));
        }

        // Sticky cart
        const cartImg  = document.getElementById('sticky-cart-img');
        const cartName = document.getElementById('sticky-cart-name');
        const cartPrice = document.getElementById('sticky-cart-price');
        if (cartImg)   { cartImg.src = first.image; cartImg.alt = first.title; }
        if (cartName)  cartName.textContent = first.title;
        if (cartPrice) cartPrice.textContent = `$${first.price.toFixed(2)}`;
      }
    } catch (err) {
      console.error('[hero injection]', err);
    }

    observeNewReveal();
  }

  loadProducts();

});
