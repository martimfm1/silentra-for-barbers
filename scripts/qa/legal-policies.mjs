import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const mustExist = (file) => assert.ok(fs.existsSync(path.join(process.cwd(), file)), `Missing legal document: ${file}`);

const requiredPages = [
  'app/legal/page.tsx',
  'app/terms/page.tsx',
  'app/privacy/page.tsx',
  'app/cookies/page.tsx',
  'app/booking-terms/page.tsx',
  'app/billing-policy/page.tsx',
  'app/acceptable-use/page.tsx',
  'app/dpa/page.tsx',
  'app/subprocessors/page.tsx',
];
for (const file of requiredPages) mustExist(file);

const terms = read('lib/legal/terms-and-conditions.ts');
const privacy = read('lib/legal/privacy-policy.ts');
const cookies = read('lib/legal/cookie-policy.ts');
const currentTerms = read('lib/legal/current-terms.ts');
const addendum = read('lib/legal/current-legal-addendum.ts');
const extraPolicies = read('lib/legal/additional-policies.ts');
const acceptableUse = read('lib/legal/acceptable-use.ts');
const documentPage = read('components/legal/legal-document-page.tsx');
const legalCentre = read('components/legal/legal-centre-page.tsx');
const drawer = read('components/legal/terms-drawer.tsx');
const consent = read('lib/privacy/cookie-consent.ts');
const bookingPage = read('app/barbershops/[slug]/pro-booking-page.tsx');
const footer = read('components/hero/footer-section.tsx');
const sitemap = read('app/sitemap.ts');
const env = read('.env.example');

assert.match(terms, /TERMS_LAST_UPDATED = '1 de novembro de 2026'/);
assert.match(terms, /lastUpdated: 'November 1, 2026'/);
assert.match(currentTerms, /currentTermsFeatureSections/);
assert.match(drawer, /currentTerms/);
assert.doesNotMatch(drawer, /August 16, 2026/);

for (const locale of ['pt', 'en']) {
  assert.match(privacy, new RegExp(`\b${locale}: \\\{`));
  assert.match(cookies, new RegExp(`\b${locale}: \\\{`));
  assert.match(extraPolicies, new RegExp(`\b${locale}: \\\{`));
  assert.match(acceptableUse, new RegExp(`\b${locale}: \\\{`));
}
assert.match(privacy, /pedidos de direitos|data-subject requests/i);
assert.match(privacy, /um mês|one-month period/i);
assert.match(privacy, /CNPD/);
assert.match(privacy, /decisões exclusivamente automatizadas|solely on automated processing/i);
assert.match(privacy, /Não existe um único prazo de eliminação|There is no single deletion period/i);

assert.match(extraPolicies, /bookingPolicy/);
assert.match(extraPolicies, /billingPolicy/);
assert.match(extraPolicies, /dataProcessingAddendum/);
assert.match(extraPolicies, /subprocessorsPolicy/);
assert.match(extraPolicies, /pré-pagamento MB WAY|MB WAY prepayment/i);
assert.match(extraPolicies, /DPA/);
assert.match(extraPolicies, /sem demora injustificada|without undue delay/i);
assert.match(extraPolicies, /Google Tag Manager/);
assert.match(extraPolicies, /Brevo/);
assert.match(extraPolicies, /Supabase/);
assert.match(extraPolicies, /Vercel/);
assert.match(acceptableUse, /scraping abusivo|abusive scraping/i);

assert.match(consent, /COOKIE_CONSENT_VERSION = 2/);
assert.match(documentPage, /window\.print\(\)/);
assert.match(documentPage, /type="search"/);
assert.match(documentPage, /NEXT_PUBLIC_LEGAL_ENTITY_NAME/);
assert.match(documentPage, /NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS/);
assert.match(documentPage, /NEXT_PUBLIC_LEGAL_ENTITY_TAX_ID/);
assert.match(documentPage, /supportValue/);
assert.doesNotMatch(documentPage, /silentra\.contact@gmail\.com/);
assert.match(legalCentre, /\/booking-terms/);
assert.match(legalCentre, /\/billing-policy/);
assert.match(legalCentre, /\/acceptable-use/);
assert.match(legalCentre, /\/dpa/);
assert.match(legalCentre, /\/subprocessors/);
assert.match(bookingPage, /href="\/booking-terms"/);
assert.match(footer, /href="\/legal"/);
assert.match(sitemap, /\/booking-terms/);
assert.match(sitemap, /\/billing-policy/);
assert.match(sitemap, /\/acceptable-use/);
assert.match(sitemap, /\/dpa/);
assert.match(sitemap, /\/subprocessors/);
for (const variable of [
  'NEXT_PUBLIC_LEGAL_ENTITY_NAME',
  'NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS',
  'NEXT_PUBLIC_LEGAL_ENTITY_TAX_ID',
]) {
  assert.match(env, new RegExp(variable));
}

const publicLegalSources = [
  terms,
  privacy,
  cookies,
  addendum,
  extraPolicies,
  acceptableUse,
  documentPage,
  read('app/terms/page.tsx'),
  read('app/privacy/page.tsx'),
  read('app/cookies/page.tsx'),
];
for (const source of publicLegalSources) {
  assert.doesNotMatch(source, /silentra\.contact@gmail\.com/);
}

console.log('Legal policies, data protection, navigation, and revision contracts passed.');
