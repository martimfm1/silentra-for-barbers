import { createHmac, timingSafeEqual } from 'node:crypto';
import { UUID_PATTERN } from '@/lib/validation';

export type BarbershopCalendarFeedPayload = {
  barbershopId: string;
  version: number;
};

function getSecret(): string {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('RATE_LIMIT_SECRET is not configured correctly.');
  }
  return secret;
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', getSecret())
    .update(`silentra:barbershop-calendar-feed:${encodedPayload}`)
    .digest('base64url');
}

export function createBarbershopCalendarFeedToken(
  barbershopId: string,
  version: number,
): string {
  if (
    !UUID_PATTERN.test(barbershopId) ||
    !Number.isSafeInteger(version) ||
    version < 1
  ) {
    throw new Error('Invalid calendar feed token payload.');
  }

  const payload = `${barbershopId}:${version}`;
  const encodedPayload = Buffer.from(payload, 'utf8').toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyBarbershopCalendarFeedToken(
  token: string,
): BarbershopCalendarFeedPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, providedSignature] = parts;
  if (!encodedPayload || !providedSignature) return null;

  try {
    const expected = Buffer.from(sign(encodedPayload), 'utf8');
    const provided = Buffer.from(providedSignature, 'utf8');
    if (
      expected.length !== provided.length ||
      !timingSafeEqual(expected, provided)
    ) {
      return null;
    }

    const payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const separator = payload.lastIndexOf(':');
    if (separator <= 0) return null;

    const barbershopId = payload.slice(0, separator);
    const version = Number(payload.slice(separator + 1));
    if (
      !UUID_PATTERN.test(barbershopId) ||
      !Number.isSafeInteger(version) ||
      version < 1
    ) {
      return null;
    }

    return { barbershopId, version };
  } catch {
    return null;
  }
}
