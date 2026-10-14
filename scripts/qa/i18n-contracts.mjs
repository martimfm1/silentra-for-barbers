import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const localeFiles = {
  pt: [
    'app/locales/pt.ts',
    'app/locales/pt-copy.ts',
  ],
  en: [
    'app/locales/en.ts',
    'app/locales/en-copy.ts',
  ],
};
const localizedSources = [
  'app/marketplace/page.tsx',
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

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function hasKey(source, path) {
  const parts = path.split('.');
  let current = source;
  for (const part of parts) {
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `(?:^|\\n)\\s{2,}\\s*${escaped}:\\s*(?:['"`]|\\{)`,
      'm',
    );
    const match = pattern.exec(current);
    if (!match) return false;
    const start = match.index + match[0].length;
    if (parts.indexOf(part) === parts.length - 1) return true;
    const remaining = current.slice(start);
    const nextObject = remaining.indexOf('{');
    if (nextObject < 0) return false;
    current = remaining.slice(nextObject + 1);
  }
  return false;
}

const localeSources = Object.fromEntries(
  Object.entries(localeFiles).map(([locale, paths]) => [
    locale,
    paths.map(read).join('\\n'),
  ]),
);
const failures = [];
for (const path of localizedSources) {
  const source = read(path);
  const keys = [
    ...source.matchAll(/\\bt\\(\\s*['"]([A-Za-z0-9_.]+)['"]/g),
  ].map((match) => match[1]);
  for (const key of keys) {
    for (const locale of ['pt', 'en']) {
      if (!hasKey(localeSources[locale], key)) {
        failures.push(`${path}: missing ${locale} translation for "${key}"`);
      }
    }
  }
}

for (const section of ['storefront', 'orderTracking', 'directory', 'auth']) {
  for (const locale of ['pt', 'en']) {
    if (!hasKey(localeSources[locale], section)) {
      failures.push(`${locale}: missing translation section "${section}"`);
    }
  }
}

if (failures.length) {
  console.error('Internationalization contract failed:');
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Internationalization contract passed for ${localizedSources.length} UI modules in pt-PT and en.`,
  );
}
