/**
 * Announcement / free-shipping bar.
 *
 * Renders a static reassurance message until the cart has items, then switches
 * to a live "$X away from free shipping" / "You've unlocked free shipping"
 * message that updates with every cart change.
 */

import { onCartChange, subtotal, freeShippingRemaining, FREE_SHIPPING_THRESHOLD } from '../cart/state';

const STATIC_MSG = `Free shipping on orders over $${FREE_SHIPPING_THRESHOLD} · 30-day returns`;

function fmt(n: number): string {
    return `$${n.toFixed(2)}`;
}

export function initAnnouncementBar() {
    const bar = document.getElementById('announcement-bar');
    if (!bar) return;

    onCartChange(() => {
        const sub = subtotal();
        if (sub <= 0) {
            bar.textContent = STATIC_MSG;
            return;
        }
        const remaining = freeShippingRemaining();
        if (remaining <= 0) {
            bar.textContent = `You've unlocked free shipping. Checkout when you're ready.`;
        } else {
            bar.textContent = `${fmt(remaining)} away from free shipping`;
        }
    });
}
