import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { CheckoutInterval, CheckoutPlan } from '@/lib/stripe/constants';

const CHECKOUT_INTENT_TTL_SECONDS = 10 * 60;

export interface CheckoutIntentPayload {
  v: 1;
  sub: string;
  barbershopId: string;
  plan: CheckoutPlan;
  interval: CheckoutInterval;
  exp: number;
  jti: string;
}

function getSecret(): string {
  const secret =
    process.env.BILLING_CHECKOUT_INTENT_SECRET?.trim() ||
    process.env.STRIPE_SECRET_KEY?.trim();

  if (!secret || secret.length < 32) {
    throw new Error('Checkout intent secret is not configured securely.');
  }

  return secret;
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(payloadPart: string): string {
  return createHmac('sha256', getSecret())
    .update(payloadPart)
    .digest('base64url');
}

function isValidSignature(payloadPart: string, signature: string): boolean {
  const expected = Buffer.from(sign(payloadPart), 'utf8');
  const actual = Buffer.from(signature, 'utf8');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createCheckoutIntent(
  userId: string,
  barbershopId: string,
  plan: CheckoutPlan,
  interval: CheckoutInterval,
): string {
  const payload: CheckoutIntentPayload = {
    v: 1,
    sub: userId,
    barbershopId,
    plan,
    interval,
    exp: Math.floor(Date.now() / 1000) + CHECKOUT_INTENT_TTL_SECONDS,
    jti: randomUUID(),
  };
  const payloadPart = encode(JSON.stringify(payload));
  return payloadPart + '.' + sign(payloadPart);
}

export function verifyCheckoutIntent(
  token: string,
): CheckoutIntentPayload | null {
  const [payloadPart, signature, extra] = token.split('.');
  if (!payloadPart || !signature || extra) return null;
  if (!isValidSignature(payloadPart, signature)) return null;

  try {
    const payload = JSON.parse(
      decode(payloadPart),
    ) as Partial<CheckoutIntentPayload>;
    if (
      payload.v !== 1 ||
      typeof payload.sub !== 'string' ||
      typeof payload.barbershopId !== 'string' ||
      (payload.plan !== 'pro' && payload.plan !== 'enterprise') ||
      (payload.interval !== 'month' && payload.interval !== 'year') ||
      typeof payload.exp !== 'number' ||
      typeof payload.jti !== 'string'
    ) {
      return null;
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

    return payload as CheckoutIntentPayload;
  } catch {
    return null;
  }
}
