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

assert.match(page, /canonical: 'https:\/\/barbers\.silentra\.me\/status'/);
assert.match(page, /robots:[\s\S]*index: true/);
assert.match(client, /setInterval\([\s\S]*60_000/);
assert.match(client, /aria-live="polite"/);
assert.match(client, /Atualizar estado/);
assert.match(endpoint, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(endpoint, /AbortSignal\.timeout\(4500\)/);
assert.match(endpoint, /status\.stripe\.com\/api\/v2\/summary\.json/);
assert.match(endpoint, /status\.brevo\.com\/api\/v2\/summary\.json/);
assert.match(endpoint, /status\.supabase\.com\/api\/v2\/summary\.json/);
assert.match(endpoint, /www\.vercel-status\.com\/api\/v2\/summary\.json/);
assert.match(endpoint, /Cache-Control/);
assert.match(footer, /href="\/status"/);
assert.match(sitemap, /\$\{SITE_URL\}\/status/);
assert.match(smoke, /'\/api\/public\/status'/);
assert.match(smoke, /'\/status'/);

console.log('Status page contracts passed.');
