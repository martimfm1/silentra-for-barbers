import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { createAdminClient } from '@/lib/supabase/admin';

export function getClientIp(request: Request): string {
  // On Vercel and other trusted ingress platforms, x-real-ip is populated by
  // the edge with the observed client address. Validate it rather than taking
  // arbitrary header text as a rate-limit key.
  const real = request.headers.get('x-real-ip')?.trim();
  if (real && isIP(real)) return real;

  // Proxies append the observed address to X-Forwarded-For. Never use the
  // leftmost value: it can be supplied by the caller and would let a client
  // rotate rate-limit buckets by forging the header.
  const forwarded = request.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((value) => value.trim())
    .filter((value) => isIP(value));

  return forwarded?.at(-1) ?? 'unknown';
}

function getRateLimitSecret(): string {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'RATE_LIMIT_SECRET is not configured with sufficient entropy.',
    );
  }
  return secret;
}

export async function consumePublicRateLimit(
  request: Request,
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const ip = getClientIp(request);
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const key = createHmac('sha256', getRateLimitSecret())
    .update(`${scope}:${normalizedIdentifier}:${ip}`)
    .digest('hex');

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('consume_public_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    throw new Error('Public rate limiter unavailable.');
  }

  return data === true;
}
