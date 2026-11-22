import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFile(resolve(root, path), 'utf8');

const [robots, llms, nextConfig, sitemap, publicApi] = await Promise.all([
  read('app/robots.ts'),
  read('public/llms.txt'),
  read('next.config.ts'),
  read('app/sitemap.ts'),
  read('app/api/v1/public/barbershops/[slug]/route.ts'),
]);

const searchAgents = [
  'Claude-SearchBot',
  'OAI-SearchBot',
  'PerplexityBot',
  'Claude-User',
  'ChatGPT-User',
];

const trainingAgents = ['ClaudeBot', 'GPTBot', 'Google-Extended'];
const privatePaths = [
  "'/api'",
  "'/dashboard'",
  "'/silentra-admin'",
  "'/_silentra-admin'",
  "'/login'",
  "'/registo'",
  "'/forgot-password'",
  "'/reset-password'",
  "'/confirm-email'",
  "'/email-confirmed'",
  "'/email-confirmation-error'",
  "'/onboarding'",
  "'/checkout'",
  "'/my-bookings'",
  "'/mensagens'",
  "'/marketplace/track'",
  "'/barbershops/*/review/claim'",
];

assert.match(robots, /userAgent: AI_SEARCH_AGENTS/);
assert.match(robots, /userAgent: AI_TRAINING_AGENTS/);
for (const agent of searchAgents) {
  assert.ok(robots.includes(agent), `AI search agent ${agent} must be allowed explicitly.`);
}
for (const agent of trainingAgents) {
  assert.ok(robots.includes(agent), `Training agent ${agent} must have an explicit policy.`);
}
for (const path of privatePaths) {
  assert.ok(robots.includes(path), `Private path ${path} must remain excluded from crawling.`);
}
assert.match(robots, /sitemap:\s*`\$\{SITE_URL\}\/sitemap\.xml`/);

assert.match(llms, /^# Silentra for Barbers/m);
assert.match(llms, /\/software-gestao-barbearia/);
assert.match(llms, /\/plans/);
assert.match(llms, /\/barbershops/);
assert.match(llms, /\/status/);
assert.match(llms, /\/sitemap\.xml/);
assert.match(llms, /public API v1 is currently disabled/i);
assert.match(llms, /Private dashboards, platform administration, authentication/i);
assert.doesNotMatch(llms, /https:\/\/barbers\.silentra\.me\/(?:api|dashboard|login|checkout)(?:\/|\b)/i);

assert.match(
  nextConfig,
  /source: '\/api\/:path\*'[\s\S]{0,500}X-Robots-Tag[\s\S]{0,250}noindex, nofollow, noarchive, nosnippet/,
  'API responses must carry noindex even if a crawler discovers an endpoint.',
);
assert.match(
  nextConfig,
  /source: '\/mensagens\/:path\*'[\s\S]{0,300}X-Robots-Tag[\s\S]{0,150}noindex, nofollow, noarchive, nosnippet/,
  'The messages area must remain non-indexable.',
);
assert.match(
  nextConfig,
  /source: '\/barbershops\/:slug\/review\/claim'[\s\S]{0,350}X-Robots-Tag[\s\S]{0,150}noindex, nofollow, noarchive, nosnippet/,
  'Token-assisted review claims must remain non-indexable.',
);
assert.match(sitemap, /\.eq\('status', 'active'\)/);
assert.match(sitemap, /public_profile_enabled === false/);
assert.match(sitemap, /custom_website_requests/);
assert.match(publicApi, /const PUBLIC_API_ENABLED = false;/);

console.log(
  '[AI_SEARCH_VISIBILITY_QA] AI search agents can discover public SaaS content; private routes and training crawlers remain excluded.',
);
