import { createHmac } from 'node:crypto';

function getSecret(): string {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('RATE_LIMIT_SECRET is not configured correctly.');
  }
  return secret;
}

/**
 * The token is opaque and can only be derived by the server. Its hash is stored
 * in the database, so the iCalendar endpoint can resolve the customer without
 * exposing their email address in the subscription URL.
 */
export function createCustomerCalendarFeedToken(email: string, version: number): string {
  return createHmac('sha256', getSecret())
    .update('silentra-customer-calendar:' + email.toLowerCase().trim() + ':' + version)
    .digest('base64url');
}
