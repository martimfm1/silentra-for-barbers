export const COOKIE_CONSENT_COOKIE = 'silentra_cookie_consent';
export const COOKIE_CONSENT_VERSION = 2;
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export type CookieConsent = {
  version: typeof COOKIE_CONSENT_VERSION;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

/**
 * Parse the URL-encoded consent cookie on both the server and client.
 * An unknown version or malformed value must fail closed: optional tracking
 * remains disabled until the visitor makes a fresh choice.
 */
export function parseCookieConsent(
  rawValue: string | null | undefined,
): CookieConsent | null {
  if (!rawValue) return null;

  try {
    const value = JSON.parse(
      decodeURIComponent(rawValue),
    ) as Partial<CookieConsent>;
    if (
      value.version !== COOKIE_CONSENT_VERSION ||
      value.necessary !== true ||
      typeof value.analytics !== 'boolean' ||
      typeof value.marketing !== 'boolean' ||
      typeof value.updatedAt !== 'string' ||
      Number.isNaN(Date.parse(value.updatedAt))
    ) {
      return null;
    }

    return {
      version: COOKIE_CONSENT_VERSION,
      necessary: true,
      analytics: value.analytics,
      marketing: value.marketing,
      updatedAt: value.updatedAt,
    };
  } catch {
    return null;
  }
}
