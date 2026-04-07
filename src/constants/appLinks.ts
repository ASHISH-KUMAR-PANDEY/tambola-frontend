/**
 * App store / OneLink constants for the install wall.
 *
 * The Stage OneLink is owned by Stage's AppsFlyer account and is the same one
 * stage-webapp uses for app redirection (see stage-webapp's
 * src/screens/paymentStatus/PaymentStatus.tsx).
 *
 * On click, AppsFlyer's OneLink page detects the device OS and routes to:
 *   - iOS:     App Store
 *   - Android: Play Store
 *   - Other:   The OneLink landing page
 */
export const STAGE_ONELINK = 'https://tnpl-test.onelink.me/rkZ9/pntftzmd';

/**
 * Build the install URL with attribution params for the install wall.
 * Append `source` and `campaign` so we can attribute installs back to the
 * specific moment in the funnel that drove them.
 */
export function buildInstallWallUrl(): string {
  const params = new URLSearchParams({
    source: 'tambola_web',
    campaign: 'solo_first_win',
  });
  return `${STAGE_ONELINK}?${params.toString()}`;
}

/**
 * Lightweight device-OS detection without pulling in `ua-parser-js`.
 * Used only for analytics enrichment on `solo_install_wall_clicked`.
 */
export function detectDeviceOs(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}
