/**
 * Get a UTM param for current session:
 * 1. URL has param → save to sessionStorage and use
 * 2. Already saved in sessionStorage (same tab) → use
 * 3. For utm_source only: Flutter bridge → 'in_app', else 'direct'
 */
const getUtmParam = (key: string, fallback: string = ''): string => {
  const params = new URLSearchParams(window.location.search);
  const urlVal = params.get(key);
  if (urlVal) {
    sessionStorage.setItem(key, urlVal);
    return urlVal;
  }

  const stored = sessionStorage.getItem(key);
  if (stored) return stored;

  return fallback;
};

export const getUtmSource = (): string => {
  const val = getUtmParam('utm_source');
  if (val) return val;
  if (localStorage.getItem('app_user_id')) return 'in_app';
  return 'direct';
};

export const getUtmMedium = (): string => getUtmParam('utm_medium');

export const getUtmCampaign = (): string => getUtmParam('utm_campaign');

export const getUtmParams = () => ({
  utm_source: getUtmSource(),
  utm_medium: getUtmMedium(),
  utm_campaign: getUtmCampaign(),
});
