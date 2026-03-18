/**
 * Get utm_source for current session:
 * 1. URL has utm_source → save to sessionStorage and use
 * 2. Already saved in sessionStorage (same tab) → use
 * 3. Flutter bridge (app_user_id exists) → 'in_app'
 * 4. None → 'direct'
 *
 * Uses sessionStorage instead of localStorage so utm_source
 * only persists for the current tab/session, not forever.
 */
export const getUtmSource = (): string => {
  const params = new URLSearchParams(window.location.search);
  const urlUtm = params.get('utm_source');
  if (urlUtm) {
    sessionStorage.setItem('utm_source', urlUtm);
    return urlUtm;
  }

  const stored = sessionStorage.getItem('utm_source');
  if (stored) return stored;

  if (localStorage.getItem('app_user_id')) return 'in_app';

  return 'direct';
};
