/**
 * Anonymous user helpers for the 3-stage funnel.
 *
 * A fresh web visitor (no Flutter bridge, no JWT, no URL userId) is given a
 * generated anonymous user ID so they can play solo tambola immediately
 * without logging in. When they win their first category, the Login Wall
 * fires and they convert to a real tambola user. The anon ID is then
 * swapped for the real one on the backend via the merge endpoint.
 *
 * Plan: /Users/stageadmin/.claude/plans/merry-hatching-prism.md
 */

const ANON_PREFIX = 'anon_';

/**
 * Read the existing anon ID from localStorage, or generate a fresh one.
 * The generated ID is `anon_<crypto.randomUUID()>`.
 *
 * Length: `anon_` (5) + UUID (36) = 41 chars → comfortably passes the
 * 10-char minimum enforced by isValidUserId in authStore.ts:24-46 and
 * api.service.ts:4-26.
 */
export function getOrCreateAnonymousUserId(): string {
  const existing = localStorage.getItem('app_user_id');
  if (existing && isAnonymousUser(existing)) {
    return existing;
  }

  // Prefer crypto.randomUUID when available (modern browsers). Fallback to
  // crypto.getRandomValues for Safari <15.4 or older WebViews. Final fallback
  // is a timestamp+random combo that will never collide in practice.
  let uuid: string;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    uuid = crypto.randomUUID();
  } else if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version 4 and variant bits per RFC 4122
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  } else {
    uuid = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-fallback`;
  }

  return `${ANON_PREFIX}${uuid}`;
}

/**
 * Returns true if the given user ID is an anonymous one (prefixed with
 * `anon_`). Real tambola user IDs are UUIDs without the prefix.
 *
 * Safe to call with undefined / null / empty string.
 */
export function isAnonymousUser(userId: string | null | undefined): boolean {
  return typeof userId === 'string' && userId.startsWith(ANON_PREFIX);
}

/**
 * Clear the anon ID from localStorage. Used when a user has successfully
 * logged in and we've merged their anon games into their real account.
 * Only clears if the current value is actually an anon ID — never touches
 * a real user ID.
 */
export function clearAnonymousUser(): void {
  const current = localStorage.getItem('app_user_id');
  if (isAnonymousUser(current)) {
    localStorage.removeItem('app_user_id');
  }
}

/**
 * localStorage key that holds the anon ID while the user is mid-login.
 * LoginWall writes this before navigating to /login. MobileOTPLogin reads
 * it after verifyOTP success, calls the merge endpoint, then clears it.
 */
export const PENDING_MERGE_ANON_ID_KEY = 'pending_merge_anon_id';
