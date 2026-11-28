import { createHash, createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { createAdminClient } from '@/lib/supabase/admin';

type LocalRateLimitBucket = {
  resetAt: number;
  hitCount: number;
};

const localRateLimitBuckets = new Map<string, LocalRateLimitBucket>();
const MAX_LOCAL_RATE_LIMIT_BUCKETS = 10_000;

export function getClientIp(request: Request): string {
  const real = request.headers.get('x-real-ip')?.trim();
  if (real && isIP(real)) return real;

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

function consumeInMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): boolean {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('Invalid local rate limit.');
  }
  if (!Number.isInteger(windowSeconds) || windowSeconds <= 0) {
    throw new Error('Invalid local rate limit window.');
  }

  const now = Date.now();
  let bucket = localRateLimitBuckets.get(key);

  if (bucket && now >= bucket.resetAt) {
    localRateLimitBuckets.delete(key);
    bucket = undefined;
  }

  if (!bucket) {
    if (localRateLimitBuckets.size >= MAX_LOCAL_RATE_LIMIT_BUCKETS) {
      for (const [bucketKey, existing] of localRateLimitBuckets) {
        if (now >= existing.resetAt) localRateLimitBuckets.delete(bucketKey);
      }
      if (localRateLimitBuckets.size >= MAX_LOCAL_RATE_LIMIT_BUCKETS) {
        const oldestKey = localRateLimitBuckets.keys().next().value;
        if (oldestKey !== undefined) localRateLimitBuckets.delete(oldestKey);
      }
    }

    localRateLimitBuckets.set(key, {
      resetAt: now + windowSeconds * 1000,
      hitCount: 1,
    });
    return true;
  }

  if (bucket.hitCount >= limit) return false;
  bucket.hitCount += 1;
  return true;
}

/**
 * Shared persistent rate limiter. By default the bucket is bound to both the
 * normalized identifier and the validated client IP. Set includeIp=false for
 * an identifier-wide bucket (for example, one email across changing IPs).
 */
export async function consumePublicRateLimit(
  request: Request,
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
  includeIp = true,
): Promise<boolean> {
  const ip = getClientIp(request);
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const rateLimitInput = includeIp
    ? `${scope}:${normalizedIdentifier}:${ip}`
    : `${scope}:${normalizedIdentifier}`;

  if (process.env.NODE_ENV === 'development') {
    const localKey = createHash('sha256').update(rateLimitInput).digest('hex');
    return consumeInMemoryRateLimit(localKey, limit, windowSeconds);
  }

  const key = createHmac('sha256', getRateLimitSecret())
    .update(rateLimitInput)
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
