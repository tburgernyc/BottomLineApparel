import { escapeHtml } from '../utils/helpers';

const toastStack = document.getElementById('toast-stack');

/**
 * Institutional Grade Toast Notification System.
 */
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', durationMs = 3500) {
  if (!toastStack) return;

  const icons = { success: '✓', error: '✕', info: '✦' };
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span class="toast__icon" aria-hidden="true">${icons[type]}</span>
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
