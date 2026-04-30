/**
 * Newsletter signup form handler.
 *
 * Wires #signup-form to /api/subscribe (Klaviyo / Mailchimp on the server side),
 * provides inline success/error feedback via #signup-msg, and fires the
 * `sign_up` analytics event so GA4/Meta can attribute leads.
 */

import { submitSubscribe } from '../api/subscribe';
import { track } from '../analytics/analytics';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function initNewsletter() {
    const form = document.getElementById('signup-form') as HTMLFormElement | null;
    if (!form) return;
    const input = document.getElementById('email-input') as HTMLInputElement | null;
    const msg = document.getElementById('signup-msg');
    const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (!input || !msg || !btn) return;

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const email = input.value.trim();
        msg.textContent = '';
        msg.className = 'signup-form__msg';

        if (!EMAIL_RE.test(email)) {
            msg.textContent = 'Enter a valid email address.';
            msg.classList.add('signup-form__msg--error');
            input.focus();
            return;
        }

        const originalLabel = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Adding…';

        try {
            await submitSubscribe({ email, source: 'footer-signup' });
            track.signup('newsletter');
            msg.textContent = 'You\'re in. Check your inbox for the welcome.';
            msg.classList.add('signup-form__msg--success');
            input.value = '';
        } catch (err) {
            console.error('[newsletter]', err);
            msg.textContent = 'Could not sign you up right now. Try again in a moment.';
            msg.classList.add('signup-form__msg--error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalLabel;
        }
    });
}
