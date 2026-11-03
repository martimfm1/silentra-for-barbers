import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('app/status/page.tsx', 'utf8');
const client = fs.readFileSync(
  'components/status/status-page-client.tsx',
  'utf8',
);
const endpoint = fs.readFileSync('app/api/public/status/route.ts', 'utf8');
const footer = fs.readFileSync('components/hero/footer-section.tsx', 'utf8');
const sitemap = fs.readFileSync('app/sitemap.ts', 'utf8');
const smoke = fs.readFileSync('scripts/qa/smoke.mjs', 'utf8');
const types = fs.readFileSync('lib/status/types.ts', 'utf8');

assert.match(page, /canonical: 'https:\/\/barbers\.silentra\.me\/status'/);
assert.match(page, /robots:[\s\S]*index: true/);
assert.match(client, /setInterval\([\s\S]*60_000/);
assert.match(client, /aria-live="polite"/);
assert.match(client, /Atualizar estado/);
assert.match(client, /APIs da Silentra/);
assert.match(client, /Base de dados/);
assert.match(endpoint, /new URL\('\/api\/health', request\.url\)/);
assert.match(endpoint, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(endpoint, /rest\/v1\/barbershops/);
assert.match(endpoint, /AbortSignal\.timeout\(4500\)/);
assert.match(endpoint, /id: 'api'/);
assert.match(endpoint, /id: 'database'/);
assert.doesNotMatch(endpoint, /status\.(stripe|brevo|supabase)\.com|vercel-status\.com/);
assert.doesNotMatch(client, /Stripe|Brevo|Supabase|Vercel|incidentes ativos|scheduled maintenance/i);
assert.match(types, /id: 'api' \| 'database'/);
assert.doesNotMatch(types, /StatusIncident|StatusMaintenance|incidents|maintenances/);
assert.match(endpoint, /Cache-Control/);
assert.match(footer, /href="\/status"/);
assert.match(sitemap, /\$\{SITE_URL\}\/status/);
assert.match(smoke, /'\/api\/public\/status'/);
assert.match(smoke, /'\/status'/);
assert.match(smoke, /item\.id === 'api'/);

console.log('Core infrastructure status page contracts passed.');
