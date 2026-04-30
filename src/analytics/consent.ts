/**
 * Cookie consent state. Persisted to localStorage; reads/writes both the legacy
 * `bla.consent` shape used by the cookie-prefs modal and a normalized internal
 * shape so the analytics module can subscribe to changes.
 *
 * Two categories: 'analytics' (GA4) and 'marketing' (Meta + TikTok).
 */

export type ConsentCategory = 'analytics' | 'marketing';

export interface ConsentState {
    analytics: boolean;
    marketing: boolean;
    decided: boolean;   // true once the user has clicked save / accept / reject
}

const STORAGE_KEY = 'bla.consent';

const DEFAULT_STATE: ConsentState = {
    analytics: false,
    marketing: false,
    decided: false,
};

type ConsentListener = (state: ConsentState) => void;
const listeners: ConsentListener[] = [];

function readStored(): ConsentState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_STATE;
        const parsed = JSON.parse(raw);
        return {
            analytics: !!parsed.analytics,
            marketing: !!parsed.marketing,
            decided: !!parsed.decided,
        };
    } catch {
        return DEFAULT_STATE;
    }
}

let current: ConsentState = readStored();

export function getConsent(): ConsentState {
    return { ...current };
}

export function hasConsent(category: ConsentCategory): boolean {
    return !!current[category];
}

export function setConsent(next: Partial<ConsentState>) {
    current = { ...current, ...next, decided: true };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch {}
    listeners.forEach(fn => { try { fn(current); } catch {} });
}

export function onConsentChange(fn: ConsentListener): () => void {
    listeners.push(fn);
    // Fire immediately with current state so subscribers can act on prior decisions.
    try { fn(current); } catch {}
    return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
    };
}
