import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const migration = read(
  'supabase/migrations/20261014230000_enterprise_landing_pages_public_api.sql',
);
const features = read('lib/billing/plan-features.ts');
const landingPage = read('app/site/[slug]/page.tsx');
const publicApi = read('app/api/v1/public/barbershops/[slug]/route.ts');
const publicProfileApi = read('app/api/public/barbershops/[slug]/route.ts');
const pricing = read('components/hero/pricing-section.tsx');
const comparison = read('components/billing/plan-comparison.tsx');
const apiAudit = read('scripts/qa/api-audit.mjs');

assert.match(
  migration,
  /create table if not exists public\.barbershop_landing_pages/i,
);
assert.match(migration, /create schema if not exists private/i);
assert.match(
  migration,
  /create or replace function private\.sync_barbershop_landing_page_entitlement/i,
);
assert.match(
  migration,
  /revoke all on schema private from public, anon, authenticated/i,
);
assert.match(
  migration,
  /after insert or update or delete on public\.subscriptions/i,
);
assert.match(
  migration,
  /after insert or update or delete on public\.barbershop_plan_assignments/i,
);
assert.match(migration, /from public, anon, authenticated/i);
assert.match(
  migration,
  /Existing Enterprise tenants receive the same benefit/i,
);
assert.match(features, /'landing_page'/);
assert.match(features, /landing_page: 'Landing page profissional incluída'/);
assert.match(pricing, /Landing page profissional incluída/);
assert.match(comparison, /features: \['landing_page'\]/);
assert.match(landingPage, /profile\.plan !== 'enterprise'/);
assert.match(landingPage, /entitlement\.status !== 'active'/);
assert.match(landingPage, /from\('barbershop_landing_pages'\)/);
assert.match(landingPage, /notFound\(\)/);
assert.match(publicApi, /consumePublicRateLimit/);
assert.match(publicApi, /isValidPublicProfileSlug/);
assert.match(publicApi, /Access-Control-Allow-Origin/);
assert.match(publicApi, /if-none-match/);
assert.match(publicApi, /barbershop_landing_pages/);
assert.match(publicApi, /profile\.plan === 'enterprise'/);
assert.doesNotMatch(publicApi, /owner_user_id/);
assert.match(apiAudit, /v1.*public.*barbershops/);
assert.match(publicProfileApi, /landing_page_url/);
assert.match(publicProfileApi, /owner_user_id: ownerUserId/);

console.log('Enterprise landing-page and public API contracts passed.');
