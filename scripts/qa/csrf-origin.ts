import assert from 'node:assert/strict';
import { assertSameOrigin } from '@/services/billing/http';
import { BillingError } from '@/types/stripe';

process.env.NODE_ENV = 'production';

const loopbackSchemeMismatch = new Request('https://localhost:3000/api/dashboard/custom-website', {
  method: 'POST',
  headers: { origin: 'http://localhost:3000' },
});
assert.doesNotThrow(() => assertSameOrigin(loopbackSchemeMismatch));

const sameProductionOrigin = new Request('https://barbers.silentra.me/api/dashboard/custom-website', {
  method: 'POST',
  headers: { origin: 'https://barbers.silentra.me' },
});
assert.doesNotThrow(() => assertSameOrigin(sameProductionOrigin));

for (const request of [
  new Request('https://barbers.silentra.me/api/dashboard/custom-website', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000' },
  }),
  new Request('https://localhost:3000/api/dashboard/custom-website', {
    method: 'POST',
    headers: { origin: 'http://localhost:3001' },
  }),
  new Request('https://barbers.silentra.me/api/dashboard/custom-website', {
    method: 'POST',
    headers: { origin: 'https://attacker.example' },
  }),
]) {
  assert.throws(
    () => assertSameOrigin(request),
    (error: unknown) => error instanceof BillingError && error.code === 'CSRF_VALIDATION_FAILED',
  );
}

console.log('[CSRF_ORIGIN_QA] loopback scheme mismatch accepted; remote and mismatched origins rejected');
