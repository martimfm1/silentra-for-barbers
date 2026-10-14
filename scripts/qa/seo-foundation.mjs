import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFile(join(root, path), 'utf8');

const [metadata, homepage, landingPage, sitemap, robots, trackedLink, analytics, authHandlers, checkoutSuccess] =
  await Promise.all([
    read('lib/site-metadata.ts'),
    read('app/page.tsx'),
    read('app/software-gestao-barbearia/page.tsx'),
    read('app/sitemap.ts'),
    read('app/robots.ts'),
    read('components/marketing/tracked-marketing-link.tsx'),
    read('lib/analytics/marketing.ts'),
    read('app/login/services/auth-handles.ts'),
    read('app/checkout/success/page.tsx'),
  ]);

assert.match(metadata, /GOOGLE_SITE_VERIFICATION/);
assert.doesNotMatch(metadata, /canonical: SITE_URL/);
assert.match(homepage, /SoftwareApplication/);
assert.match(homepage, /#organization/);
assert.match(landingPage, /Software de Gestão para Barbearias/);
assert.match(landingPage, /alternates:\s*\{\s*canonical: PAGE_URL\s*\}/);
assert.match(landingPage, /FAQPage/);
assert.match(landingPage, /href="\/registo"/);
assert.match(sitemap, /software-gestao-barbearia/);
assert.match(sitemap, /barbershop_landing_pages/);
assert.match(sitemap, /status', 'active'/);
assert.match(robots, /sitemap\.xml/);
assert.match(robots, /disallow:\s*\['\/api\/'\]/);
assert.match(trackedLink, /silentra_cta_click/);
assert.match(analytics, /window\.dataLayer\.push/);

assert.match(authHandlers, /trackMarketingEvent\('sign_up'/);
assert.match(checkoutSuccess, /trackMarketingEvent\('silentra_subscription_activated'/);

console.log('[SEO_FOUNDATION_QA] metadata, structured data, canonical, sitemap, robots and CTA tracking passed');
