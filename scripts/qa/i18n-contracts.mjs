import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const localeFiles = {
  pt: ['app/locales/pt.ts', 'app/locales/pt-copy.ts'],
  en: ['app/locales/en.ts', 'app/locales/en-copy.ts'],
};
const localizedSources = [
  'app/marketplace/page.tsx',
  'app/dashboard/page.tsx',
  'app/dashboard/agenda/page.tsx',
  'app/dashboard/pos/pedidos/page.tsx',
  'app/onboarding/page.tsx',
  'app/marketplace/[productId]/page.tsx',
  'app/marketplace/track/tracking-client.tsx',
  'app/barbershops/page.tsx',
  'app/barbershops/components/search-filter-bar.tsx',
  'app/barbershops/components/mobile-search-filter-bar.tsx',
  'app/barbershops/components/shop-card.tsx',
  'app/confirm-email/page.tsx',
  'app/forgot-password/page.tsx',
  'app/reset-password/page.tsx',
  'app/email-confirmed/page.tsx',
  'app/email-confirmation-error/page.tsx',
];

const read = (path) => readFileSync(join(root, path), 'utf8');
const localeSources = Object.fromEntries(
  Object.entries(localeFiles).map(([locale, paths]) => [
    locale,
    paths.map(read).join('\n'),
  ]),
);

function hasKey(source, path) {
  const key = path.split('.').at(-1);
  return (
    typeof key === 'string' &&
    new RegExp('^\\s{2,}' + key + ':\\s*(?:[\'"`]|\\{)', 'm').test(source)
  );
}

const failures = [];
for (const path of localizedSources) {
  const source = read(path);
  const keys = [...source.matchAll(/\bt\(\s*['"]([A-Za-z0-9_.]+)['"]/g)].map(
    (match) => match[1],
  );
  for (const key of keys) {
    for (const locale of ['pt', 'en']) {
      if (!hasKey(localeSources[locale], key)) {
        failures.push(
          path + ': missing ' + locale + ' translation for "' + key + '"',
        );
      }
    }
  }
}

for (const section of [
  'storefront',
  'orderTracking',
  'directory',
  'auth',
  'dashboard',
  'agenda',
  'orderManagement',
  'onboarding',
]) {
  for (const locale of ['pt', 'en']) {
    if (!hasKey(localeSources[locale], section)) {
      failures.push(locale + ': missing translation section "' + section + '"');
    }
  }
}

if (failures.length) {
  console.error('Internationalization contract failed:');
  for (const failure of [...new Set(failures)]) console.error('- ' + failure);
  process.exitCode = 1;
} else {
  console.log(
    'Internationalization contract passed for ' +
      localizedSources.length +
      ' UI modules in pt-PT and en.',
  );
}
