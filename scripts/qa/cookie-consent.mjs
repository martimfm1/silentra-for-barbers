import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const layout = read('app/layout.tsx');
const clientShell = read('components/client-shell.tsx');
const consentManager = read('components/privacy/cookie-consent-manager.tsx');
const consentSchema = read('lib/privacy/cookie-consent.ts');
const cookiePolicyPage = read('app/cookies/page.tsx');
const cookiePolicy = read('lib/legal/cookie-policy.ts');
const termsPage = read('app/terms/page.tsx');
const privacyPage = read('app/privacy/page.tsx');
const legalAddendum = read('lib/legal/current-legal-addendum.ts');
const sitemap = read('app/sitemap.ts');
const legalPage = read('components/legal/legal-document-page.tsx');

assert.match(consentSchema, /COOKIE_CONSENT_COOKIE = 'silentra_cookie_consent'/);
assert.match(consentSchema, /COOKIE_CONSENT_MAX_AGE_SECONDS = 60 \* 60 \* 24 \* 180/);
assert.match(consentSchema, /value\.version !== COOKIE_CONSENT_VERSION/);
assert.match(consentSchema, /typeof value\.analytics !== 'boolean'/);
assert.match(consentSchema, /typeof value\.marketing !== 'boolean'/);

assert.match(consentManager, /Reject optional|Rejeitar opcionais/);
assert.match(consentManager, /Accept all|Aceitar todas/);
assert.match(consentManager, /analytics: false, marketing: false/);
assert.match(consentManager, /analytics: true, marketing: true/);
assert.match(consentManager, /role="dialog"/);
assert.match(consentManager, /aria-modal="true"/);
assert.match(consentManager, /href="\/cookies"/);
assert.match(consentManager, /window\.location\.reload\(\)/);
assert.match(consentManager, /Preferências de cookies/);
assert.match(clientShell, /CookieConsentManager/);
assert.match(clientShell, /usePathname/);
assert.match(clientShell, /const dashboardRoutePrefixes = \[/);
for (const prefix of ['/dashboard', '/silentra-admin', '/_silentra-admin', '/silentra_admin']) {
  assert.ok(
    clientShell.includes(`'${prefix}'`),
    `Cookie consent must stay hidden throughout dashboard route ${prefix}.`,
  );
}
assert.match(clientShell, /showCookieConsent \? <CookieConsentManager \/> : null/);
assert.match(
  clientShell,
  /pathname === prefix \|\| pathname\.startsWith\(\`\$\{prefix\}\/\`\)/,
  'Dashboard route matching must cover nested dashboard pages.',
);

assert.match(layout, /parseCookieConsent/);
assert.match(layout, /allowMarketing \? \(/);
assert.match(layout, /allowAnalytics && allowMarketing \? \(/);
assert.match(layout, /enableVercelTelemetry && allowAnalytics/);
assert.match(
  layout,
  /allowAnalytics && allowMarketing \?\s*\(\s*<GoogleTagManager gtmId="GTM-PBCWTRT5"/,
  'Google Tag Manager must be gated by both analytics and marketing consent.',
);
assert.match(
  layout,
  /allowMarketing \? \(\s*<Script id="whop-pixel"/,
  'Whop pixel must be gated by marketing consent.',
);
assert.doesNotMatch(
  layout,
  /<GoogleTagManager gtmId="GTM-PBCWTRT5"\s*\/>\s*<LanguageProvider/,
  'Google Tag Manager must not be mounted unconditionally.',
);

assert.match(cookiePolicyPage, /cookiePolicy/);
assert.match(cookiePolicy, /silentra_cookie_consent/);
assert.match(cookiePolicy, /Vercel Analytics/);
assert.match(cookiePolicy, /Google Tag Manager/);
assert.match(cookiePolicy, /Whop/);
assert.match(cookiePolicy, /withdraw|retirar o consentimento/i);
assert.match(termsPage, /currentTermsFeatureSections/);
assert.match(privacyPage, /currentPrivacyFeatureSections/);
assert.match(legalAddendum, /25 de outubro de 2026/);
assert.match(legalAddendum, /automatically confirmed|confirmadas automaticamente/i);
assert.match(legalAddendum, /birthday messages|mensagens de aniversário/i);
assert.match(legalAddendum, /API pública v1/);
assert.match(legalAddendum, /silentra_cookie_consent/);
assert.match(legalPage, /href="\/cookies"/);
assert.match(sitemap, /\$\{SITE_URL\}\/cookies/);

console.log('Cookie consent and legal-document contracts passed.');
