import { timingSafeEqual } from 'node:crypto';

/**
 * Compare application secrets without leaking the matching prefix through
 * early-exit string comparison. Missing configuration always fails closed.
 */
export function constantTimeSecretMatch(
  supplied: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!supplied || !expected) return false;

  const suppliedBytes = Buffer.from(supplied, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');

  return (
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
}

/**
 * Accept the documented cron authentication headers while comparing each
 * candidate in constant time. Never trust a secret supplied in query params.
 */
export function hasValidCronSecret(
  request: Request,
  expected: string | null | undefined,
): boolean {
  const secret = expected?.trim();
  if (!secret) return false;

  const authorization = request.headers.get('authorization');
  const bearer = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;
  const headerSecret = request.headers.get('x-cron-secret');

  const bearerMatches = constantTimeSecretMatch(bearer, secret);
  const headerMatches = constantTimeSecretMatch(headerSecret, secret);

  return bearerMatches || headerMatches;
}
