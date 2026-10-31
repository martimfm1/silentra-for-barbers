import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [consoleSource, pageSource] = await Promise.all([
  readFile('app/_silentra-admin/platform-admin-console.tsx', 'utf8'),
  readFile('app/silentra-admin/page.tsx', 'utf8'),
]);

// The internal console must be organized by meaningful SaaS operating areas.
for (const category of [
  "label: 'Visão geral'",
  "label: 'Negócio'",
  "label: 'Financeiro'",
  "label: 'Acompanhamento'",
  "label: 'Sistema'",
]) {
  assert.ok(consoleSource.includes(category), `Missing navigation category: ${category}`);
}

for (const route of [
  "'overview'",
  "'shops'",
  "'plans'",
  "'subscriptions'",
  "'payments'",
  "'payment_requests'",
  "'support'",
  "'api_health'",
  "'diagnostics'",
]) {
  assert.ok(consoleSource.includes(route), `Missing admin section: ${route}`);
}

for (const destination of [
  '/silentra-admin/reports',
  '/silentra-admin/websites',
  '/silentra-admin/loyalty',
]) {
  assert.ok(consoleSource.includes(destination), `Missing admin tool: ${destination}`);
}

// Responsive navigation, clear active state and section-specific guidance.
assert.match(consoleSource, /lg:grid-cols-\[248px_minmax\(0,1fr\)\]/);
assert.match(consoleSource, /aria-label="Navegação de administração"/);
assert.match(consoleSource, /aria-current=\{selected \? 'page' : undefined\}/);
assert.match(consoleSource, /tabDescriptions\[tab\]/);
assert.match(consoleSource, /Atualizar dados/);

// Core business and system signals remain visible in the overview.
for (const metric of [
  'manualRevenue30d',
  'manualConversion30d',
  'openPaymentRequests',
  'activePaidSubscriptions',
  'newShops7d',
  'newUsers7d',
  'appointmentsNext7d',
  'canceledSubscriptions30d',
  'emailFailures',
  'adminIdentityConfigured',
  'stripeConfigured',
]) {
  assert.ok(consoleSource.includes(metric), `Missing SaaS overview signal: ${metric}`);
}

// Keep the admin authorization gate server-side and use one unified navigation.
assert.match(pageSource, /getPlatformAdminContext/);
assert.match(pageSource, /if \(!context\)/);
assert.match(pageSource, /return <PlatformAdminConsole \/>/);
assert.doesNotMatch(pageSource, /className="fixed bottom-/);

console.log('Silentra admin navigation and overview contract passed.');
