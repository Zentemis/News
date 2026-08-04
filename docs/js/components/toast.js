/* ============================================================
   TOAST — Subtle transient notifications
   Phase C: "bookmarked", "copied link", "data refreshed", etc.
   ============================================================ */

const TOAST_TTL = 2600; // ms before auto-dismiss

let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.className = 'toast-container';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'false');
  document.body.appendChild(container);
  return container;
}

/**
 * Show a transient toast notification.
 * @param {string} message — the text to display
 * @param {string} [type] — 'info' (default), 'success', 'error'
 */
export function toast(message, type = 'info') {
  const host = ensureContainer();

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  host.appendChild(el);

  // Entrance
  requestAnimationFrame(() => el.classList.add('show'));

  // Auto-dismiss
  const ttl = setTimeout(() => dismiss(el), TOAST_TTL);

  // Manual dismiss on click
  el.addEventListener('click', () => {
    clearTimeout(ttl);
    dismiss(el);
  });

  // Cap concurrent toasts (avoid stacking overflow)
  while (host.children.length > 4) host.firstElementChild?.remove();
}

function dismiss(el) {
  if (!el || el.dataset.dismissing) return;
  el.dataset.dismissing = '1';
  el.classList.remove('show');
  el.addEventListener('transitionend', () => el.remove(), { once: true });
  // Fallback if transitionend never fires
  setTimeout(() => el.remove(), 400);
}
