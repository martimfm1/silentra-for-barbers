import { createHmac, randomInt } from 'node:crypto';

function getSecret() {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('RATE_LIMIT_SECRET is not configured correctly.');
  }
  return secret;
}

export function generateBarbershopDeletionCode() {
  return String(randomInt(100000, 1000000));
}

export function hashBarbershopDeletionCode(code: string) {
  return createHmac('sha256', getSecret()).update(code).digest('hex');
}
