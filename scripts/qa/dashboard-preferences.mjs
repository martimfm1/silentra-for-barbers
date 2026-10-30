import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [page, pt, en] = await Promise.all([
  readFile('app/dashboard/page.tsx', 'utf8'),
  readFile('app/locales/pt.ts', 'utf8'),
  readFile('app/locales/en.ts', 'utf8'),
]);

for (const marker of [
  'preferencesStorageKey',
  'silentra:dashboard-preferences:',
  'visibleWidgets.includes(\'metrics\')',
  'visibleWidgets.includes(\'chart\')',
  'visibleWidgets.includes(\'upcoming\')',
  'visibleWidgets.includes(\'next\')',
  'setPreferencesOpen(true)',
  '/dashboard/loyalty/validate',
  '/dashboard/qr-code',
  'setVisibleShortcuts',
]) assert.ok(page.includes(marker), `Missing dashboard preference contract: ${marker}`);

for (const key of ['customizeDashboard', 'scanLoyalty', 'barbershopQr', 'resetDashboard']) {
  assert.ok(pt.includes(`${key}:`), `Missing PT dashboard copy: ${key}`);
  assert.ok(en.includes(`${key}:`), `Missing EN dashboard copy: ${key}`);
}

console.log('Dashboard personalization contracts passed.');
