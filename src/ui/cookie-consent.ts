/**
 * Cookie consent UX. Wires the existing #cookie-banner / #cookie-prefs DOM to
 * the consent module so analytics SDKs only load after explicit acceptance.
 *
 * Behavior:
 *  - On first visit (no prior decision), the banner is shown immediately so we
 *    don't fire any analytics until the user decides.
 *  - "Accept All" enables analytics + marketing.
 *  - "Essential Only" records a decision with both off — banner stays hidden
 *    on subsequent visits.
 *  - "Manage Preferences" opens the toggle modal.
 *  - The banner is bottom-anchored on desktop, full-width on mobile.
 */

import { getConsent, setConsent } from '../analytics/consent';

const $ = (id: string) => document.getElementById(id);

export function initCookieConsent() {
    const banner = $('cookie-banner');
    const prefs = $('cookie-prefs');
    if (!banner) return;

    const acceptBtn = $('cookie-accept');
    const declineBtn = $('cookie-decline');
    const manageBtn = $('cookie-manage');

    const prefsClose = $('cookie-prefs-close');
    const prefsBackdrop = $('cookie-prefs-backdrop');
    const prefsSave = $('cookie-prefs-save');
    const prefAnalytics = $('pref-analytics') as HTMLInputElement | null;
    const prefMarketing = $('pref-marketing') as HTMLInputElement | null;

    const state = getConsent();

    // Reflect any prior choice into the prefs modal toggles.
    if (prefAnalytics) prefAnalytics.checked = state.analytics;
    if (prefMarketing) prefMarketing.checked = state.marketing;

    // Show banner only if the user has never decided.
    if (!state.decided) {
        banner.removeAttribute('hidden');
    }

    const closePrefs = () => prefs?.setAttribute('hidden', '');
    const openPrefs = () => prefs?.removeAttribute('hidden');
    const closeBanner = () => banner.setAttribute('hidden', '');

    acceptBtn?.addEventListener('click', () => {
        setConsent({ analytics: true, marketing: true });
        if (prefAnalytics) prefAnalytics.checked = true;
        if (prefMarketing) prefMarketing.checked = true;
        closeBanner();
    });

    declineBtn?.addEventListener('click', () => {
        setConsent({ analytics: false, marketing: false });
        if (prefAnalytics) prefAnalytics.checked = false;
        if (prefMarketing) prefMarketing.checked = false;
        closeBanner();
    });

    manageBtn?.addEventListener('click', openPrefs);
    prefsClose?.addEventListener('click', closePrefs);
    prefsBackdrop?.addEventListener('click', closePrefs);

    prefsSave?.addEventListener('click', () => {
        setConsent({
            analytics: !!prefAnalytics?.checked,
            marketing: !!prefMarketing?.checked,
        });
        closePrefs();
        closeBanner();
    });
}
