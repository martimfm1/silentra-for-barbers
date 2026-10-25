import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = 'silentra_customer_portal';

function getSecret(): string {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'RATE_LIMIT_SECRET is not configured with sufficient entropy.',
    );
  }
  return secret;
}

export function normalizePortalEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email))
    return null;
  return email;
}

export function hashPortalValue(value: string): string {
  return createHmac('sha256', getSecret()).update(value).digest('hex');
}

export function hashPortalToken(token: string): string {
  return createHash('sha256').update(`${getSecret()}:${token}`).digest('hex');
}

export function generateVerificationCode(): string {
  return String(randomInt(100000, 1000000));
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function getVerificationExpiry(): string {
  return new Date(Date.now() + CODE_TTL_MS).toISOString();
}

export function getSessionExpiry(): string {
  return new Date(Date.now() + SESSION_TTL_MS).toISOString();
}

export async function setPortalCookie(
  token: string,
  expiresAt: string,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  });
}

export async function clearPortalCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function getPortalSession(request?: Request) {
  const authorization = request?.headers.get('authorization');
  let token: string | undefined;

  if (authorization !== null && authorization !== undefined) {
    const match = /^Bearer\s+([a-f0-9]{64})$/.exec(authorization.trim());
    if (!match) return null;
    token = match[1];
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get(COOKIE_NAME)?.value;
  }
  if (!token) return null;

  const tokenHash = hashPortalToken(token);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('booking_portal_sessions')
    .select('id, email, expires_at')
    .eq('token_hash', tokenHash)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;

  await admin
    .from('booking_portal_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id);

  return {
    id: data.id,
    email: data.email as string,
    expiresAt: data.expires_at as string,
  };
}

export { COOKIE_NAME, CODE_TTL_MS };
