import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = 'silentra_loyalty_session';

function getSecret(): string {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('RATE_LIMIT_SECRET is not configured correctly.');
  return secret;
}

export function normalizeLoyaltyEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email && email.length <= 254 && /^\S+@\S+\.\S+$/.test(email)
    ? email
    : null;
}

export function hashLoyaltyValue(value: string): string {
  return createHmac('sha256', getSecret()).update(value).digest('hex');
}

export function hashLoyaltyToken(value: string): string {
  return createHash('sha256').update(`${getSecret()}:${value}`).digest('hex');
}

export function generateLoyaltyCode(): string {
  return String(randomInt(100000, 1000000));
}

export function generateLoyaltyToken(): string {
  return randomBytes(32).toString('hex');
}

export function loyaltyCodeExpiry(): string {
  return new Date(Date.now() + CODE_TTL_MS).toISOString();
}

export function loyaltySessionExpiry(): string {
  return new Date(Date.now() + SESSION_TTL_MS).toISOString();
}

export async function setLoyaltyCookie(
  token: string,
  expiresAt: string,
): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  });
}

export async function clearLoyaltyCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function getLoyaltySession(barbershopId: string) {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('loyalty_sessions')
    .select('id, email, expires_at')
    .eq('barbershop_id', barbershopId)
    .eq('token_hash', hashLoyaltyToken(token))
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { error: touchError } = await admin
    .from('loyalty_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id);
  if (touchError) {
    console.warn('[LOYALTY_SESSION_TOUCH_FAILED]', {
      code: touchError.code ?? 'UNKNOWN',
    });
  }
  return {
    id: data.id,
    email: data.email as string,
    expiresAt: data.expires_at as string,
  };
}
