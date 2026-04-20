/**
 * Mobile navigation logic.
 */
export function initNavigation() {
    const navToggle = document.getElementById('nav-toggle');
    const navLinks = document.getElementById('nav-links');

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
                (navToggle as HTMLElement).focus();
            }
        });
    }
}
