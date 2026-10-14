import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function createMarketplaceTrackingToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

export function hashMarketplaceTrackingToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isMarketplaceTrackingToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/**
 * Creates links from an explicitly configured canonical origin, never from
 * request Host/Forwarded headers. The token stays in the URL fragment, so the
 * browser does not send it with the initial document request or Referer.
 */
export function buildMarketplaceTrackingUrl(token: string): string | null {
  if (!isMarketplaceTrackingToken(token)) return null;

  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configured) return null;

  try {
    const appUrl = new URL(configured);
    const isLocalDevelopment =
      process.env.NODE_ENV !== 'production' &&
      appUrl.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname);

    if (
      (appUrl.protocol !== 'https:' && !isLocalDevelopment) ||
      appUrl.username ||
      appUrl.password
    ) {
      return null;
    }

    const trackingUrl = new URL('/marketplace/track', appUrl.origin);
    trackingUrl.hash = new URLSearchParams({ token }).toString();
    return trackingUrl.toString();
  } catch {
    return null;
  }
}
