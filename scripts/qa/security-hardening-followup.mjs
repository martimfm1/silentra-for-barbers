import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const secretHelper = read('lib/security/secret-comparison.ts');
assert.match(secretHelper, /timingSafeEqual\(/);
assert.match(secretHelper, /if \(!supplied \|\| !expected\) return false/);
assert.match(secretHelper, /hasValidCronSecret/);

for (const path of [
  'app/api/cron/manual-subscriptions/route.ts',
  'app/api/cron/moneyflow-sync/route.ts',
  'app/api/cron/booking-lifecycle/route.ts',
  'app/api/cron/booking-completion/route.ts',
]) {
  assert.match(read(path), /hasValidCronSecret\(request, process\.env\.CRON_SECRET\)/, path);
}

const marketingCron = read('app/api/cron/marketing/route.ts');
assert.match(marketingCron, /hasValidCronSecret\(request, cronSecret\)/);
assert.match(marketingCron, /timingSafeEqual\(supplied, expected\)/);

const brevoWebhook = read('lib/marketing/brevo-webhook.ts');
assert.match(brevoWebhook, /constantTimeSecretMatch\(authorization/);
assert.match(brevoWebhook, /constantTimeSecretMatch\(headerSecret/);

assert.match(read('next.config.ts'), /object-src 'none'; base-uri 'self'/);

const rateLimitMigration = read(
  'supabase/migrations/20261128150000_harden_public_rate_limit_rls.sql',
);
assert.match(rateLimitMigration, /enable row level security/i);
assert.match(rateLimitMigration, /set search_path = ''/i);
assert.match(rateLimitMigration, /revoke all on table/i);

for (const path of [
  '.github/workflows/ci.yml',
  '.github/workflows/isolated-e2e.yml',
]) {
  const workflow = read(path);
  assert.doesNotMatch(workflow, /uses: actions\/checkout@v\d+/);
  assert.doesNotMatch(workflow, /uses: actions\/setup-node@v\d+/);
  assert.doesNotMatch(workflow, /uses: pnpm\/action-setup@v\d+/);
  assert.match(workflow, /persist-credentials: false/);
}

console.log('[SECURITY_HARDENING_FOLLOWUP_QA] all contracts passed');
