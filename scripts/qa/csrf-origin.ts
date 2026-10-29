import assert from 'node:assert/strict';
import { assertSameOrigin } from '@/services/billing/http';
import { BillingError } from '@/types/stripe';

// This also covers a local production build behind a scheme-rewriting proxy.
Object.defineProperty(process.env, 'NODE_ENV', {
  value: 'production',
  configurable: true,
  writable: true,
});

const loopbackSchemeMismatch = new Request(
  'https://localhost:3000/api/dashboard/custom-website',
  {
    method: 'POST',
    headers: { origin: 'http://localhost:3000' },
  },
);
assert.doesNotThrow(() => assertSameOrigin(loopbackSchemeMismatch));

const sameProductionOrigin = new Request(
  'https://barbers.silentra.me/api/dashboard/custom-website',
  {
    method: 'POST',
    headers: { origin: 'https://barbers.silentra.me' },
  },
);
assert.doesNotThrow(() => assertSameOrigin(sameProductionOrigin));

const remoteHostWithLoopbackOrigin = new Request(
  'https://barbers.silentra.me/api/dashboard/custom-website',
  {
    method: 'POST',
    headers: { origin: 'http://localhost:3000' },
  },
);
assert.throws(
  () => assertSameOrigin(remoteHostWithLoopbackOrigin),
  (error: unknown) =>
    error instanceof BillingError && error.code === 'CSRF_VALIDATION_FAILED',
);

const loopbackPortMismatch = new Request(
  'https://localhost:3000/api/dashboard/custom-website',
  {
    method: 'POST',
    headers: { origin: 'http://localhost:3001' },
  },
);
assert.throws(
  () => assertSameOrigin(loopbackPortMismatch),
  (error: unknown) =>
    error instanceof BillingError && error.code === 'CSRF_VALIDATION_FAILED',
);

const externalOrigin = new Request(
  'https://barbers.silentra.me/api/dashboard/custom-website',
  {
    method: 'POST',
    headers: { origin: 'https://attacker.example' },
  },
);
assert.throws(
  () => assertSameOrigin(externalOrigin),
  (error: unknown) =>
    error instanceof BillingError && error.code === 'CSRF_VALIDATION_FAILED',
);

console.log('[CSRF_ORIGIN_QA] loopback scheme mismatch accepted; remote and mismatched origins rejected');
