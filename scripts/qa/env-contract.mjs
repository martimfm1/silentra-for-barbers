import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [envCheck, packageJson, workflow] = await Promise.all([
  readFile('scripts/qa/env-check.mjs', 'utf8'),
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('.github/workflows/ci.yml', 'utf8'),
]);

const requiredVariables = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_PRICE_PRO_MONTHLY',
  'STRIPE_PRICE_PRO_YEARLY',
  'STRIPE_PRICE_ENTERPRISE_MONTHLY',
  'STRIPE_PRICE_ENTERPRISE_YEARLY',
  'BREVO_API_KEY',
  'RATE_LIMIT_SECRET',
  'LOYALTY_REDEMPTION_SECRET',
];

for (const name of requiredVariables) {
  assert.ok(
    envCheck.includes(`'${name}'`),
    `Production env validation must keep requiring ${name}.`,
  );
}
assert.match(envCheck, /configuredAppUrl[\s\S]*NEXT_PUBLIC_SITE_URL/);
assert.match(envCheck, /configuredEmailSender[\s\S]*BREVO_FROM_EMAIL/);
assert.match(envCheck, /placeholderPatterns[\s\S]*placeholders\.push/);
assert.match(envCheck, /weakSecrets\.push/);
assert.match(envCheck, /unsafePublicSecrets\.push/);
assert.match(envCheck, /appUrl\.protocol !== 'https:'/);
assert.equal(
  packageJson.scripts['qa:env'],
  'node scripts/qa/env-check.mjs',
  'The production environment validator must remain directly executable.',
);
assert.equal(
  packageJson.scripts['qa:env-contract'],
  'node scripts/qa/env-contract.mjs',
);
assert.match(packageJson.scripts.qa, /pnpm qa:env-contract/);
assert.match(workflow, /node-version: 24/);
assert.match(
  workflow,
  /name: Environment validation contracts\s+run: pnpm qa:env-contract/,
);
assert.doesNotMatch(
  workflow,
  /run: pnpm qa:env\s*$/,
  'Pull-request CI must not pretend fake placeholders are production secrets.',
);

console.log('[ENV_CONTRACT_QA] production environment validation rules remain enforced.');
