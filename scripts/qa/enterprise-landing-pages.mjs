import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const migration = read(
  'supabase/migrations/20261017103425_enterprise_landing_pages_public_api.sql',
);
const features = read('lib/billing/plan-features.ts');
const landingPage = read('app/site/[slug]/page.tsx');
const landingConfig = read('lib/barbershops/enterprise-landing-page-config.ts');
const landingSettings = read('app/dashboard/settings/enterprise-landing-page-settings-card.tsx');
const settingsPage = read('app/dashboard/settings/settings-page.tsx');
const publicProfileResolver = read('lib/barbershops/public-profile.ts');
const publicApi = read('app/api/v1/public/barbershops/[slug]/route.ts');
const publicProfileApi = read('app/api/public/barbershops/[slug]/route.ts');
const publicProfileSettingsApi = read('app/api/barbershops/public-profile/route.ts');
const pricing = read('components/hero/pricing-section.tsx');
const comparison = read('components/billing/plan-comparison.tsx');
const apiAudit = read('scripts/qa/api-audit.mjs');
const documentationPage = read('app/documentation/page.tsx');
const apiDocumentation = read('docs/API_PUBLICA.md');
const navbar = read('components/site-navbar.tsx');
const dashboardSidebar = read('app/dashboard/_components/DashboardSidebar.tsx');
const sitemap = read('app/sitemap.ts');

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
assert.match(
  pricing,
  /Landing page profissional e endereço no domínio Silentra incluídos/,
);
assert.match(pricing, /Site próprio com ativação única de 50 €/);
assert.match(
  comparison,
  /title: 'Presença online e diretório',\s*features: \['directory_visibility', 'landing_page', 'custom_website'\]/,
);
assert.match(landingPage, /profile\.plan !== 'enterprise'/);
assert.match(landingPage, /entitlement\.status !== 'active'/);
assert.match(landingPage, /\?booking=1/);
assert.match(landingPage, /profile\.plan !== 'enterprise'/);
assert.match(publicProfileApi, /landing_page_url/);
assert.match(landingPage, /from\('barbershop_landing_pages'\)/);
assert.match(landingPage, /notFound\(\)/);
assert.match(publicApi, /const PUBLIC_API_ENABLED = false/);
assert.match(publicApi, /if \(!PUBLIC_API_ENABLED\)/);
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

assert.match(documentationPage, /notFound\(\)/);
assert.match(apiDocumentation, /temporariamente desativada/);
assert.doesNotMatch(navbar, /\/documentation/);
assert.doesNotMatch(dashboardSidebar, /\/documentation/);
assert.doesNotMatch(sitemap, /\/documentation/);


assert.match(landingConfig, /'midnight'[\s\S]*?'forest'[\s\S]*?'sand'[\s\S]*?'espresso'/);
assert.match(landingConfig, /validateEnterpriseLandingPageConfig/);
assert.match(landingConfig, /instagram\.com/);
assert.match(landingConfig, /facebook\.com/);
assert.match(landingConfig, /tiktok\.com/);
assert.match(landingConfig, /parsed\.protocol !== 'https:'/);
assert.match(landingConfig, /#\[0-9a-f\]\{6\}/);
assert.match(publicProfileSettingsApi, /validateEnterpriseLandingPageConfig/);
assert.match(publicProfileSettingsApi, /A personalização avançada do site está disponível no plano Enterprise/);
assert.match(publicProfileSettingsApi, /updates\.theme_config = validation\.config/);
assert.match(publicProfileResolver, /normalizeEnterpriseLandingPageConfig\(shop\?\.theme_config\)/);

for (const source of [landingPage]) {
  assert.match(source, /\.from\('services'\)/);
  assert.match(source, /\.from\('professionals'\)/);
  assert.match(source, /\.from\('reviews'\)/);
  assert.match(source, /\.from\('barbershops'\)/);
  assert.match(source, /\.from\('shops'\)/);
  assert.match(source, /normalizeWeeklySchedule/);
  assert.match(source, /normalizeBarbershopAmenities/);
  assert.match(source, /showTeam/);
  assert.match(source, /showReviews/);
  assert.match(source, /showAmenities/);
  assert.match(source, /instagramUrl/);
  assert.match(source, /facebookUrl/);
  assert.match(source, /tiktokUrl/);
  assert.match(source, /heroAlignment/);
  assert.match(source, /aggregateRating/);
  assert.match(source, /OpeningHoursSpecification/);
  assert.match(source, /google\.com\/maps\/search/);
  assert.match(source, /\?booking=1/);
}

assert.match(landingSettings, /ENTERPRISE_LANDING_PAGE_THEMES\.map/);
assert.match(landingSettings, /type="color"/);
assert.match(landingSettings, /Description \/ About us|Descrição \/ Sobre nós/);
assert.match(landingSettings, /Instagram/);
assert.match(landingSettings, /Facebook/);
assert.match(landingSettings, /TikTok/);
assert.match(landingSettings, /showTeam/);
assert.match(landingSettings, /showReviews/);
assert.match(landingSettings, /showAmenities/);
assert.match(landingSettings, /heroAlignment/);
assert.match(landingSettings, /mailto:contact\.silentra@gmail\.com/);
assert.match(settingsPage, /EnterpriseLandingPageSettingsCard/);
assert.match(settingsPage, /plan === 'enterprise' \?/);
assert.match(settingsPage, /enterpriseLandingDirty/);
assert.match(settingsPage, /themeConfig: enterpriseLandingDraft/);

console.log('Enterprise landing-page and public API contracts passed.');
