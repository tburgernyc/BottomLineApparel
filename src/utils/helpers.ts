/**
 * Basic HTML escaping for dynamic content injection.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escapes string for use in HTML attributes.
 */
export function escapeAttr(str: string): string {
  if (!str) return '';
  return str.replace(/"/g, '&quot;');
}
