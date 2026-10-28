import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const localeFiles = {
  pt: ['app/locales/pt.ts', 'app/locales/pt-copy.ts'],
  en: ['app/locales/en.ts', 'app/locales/en-copy.ts'],
};
const explicitlyLocalizedSources = [
  'components/site-navbar.tsx',
  'app/marketplace/page.tsx',
  'app/dashboard/page.tsx',
  'app/dashboard/agenda/page.tsx',
  'app/dashboard/pos/pedidos/page.tsx',
  'app/dashboard/settings/settings-page.tsx',
  'app/dashboard/crm/page.tsx',
  'app/dashboard/crm/[clientId]/page.tsx',
  'app/dashboard/billing/page.tsx',
  'components/billing/BillingHub.tsx',
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

function discoverTsxFiles(directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
      return discoverTsxFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.tsx') ? [path] : [];
  });
}

// Discover all application and shared component TSX files so no route or
// reusable UI can silently fall outside the translation contract.
const localizedSources = [...new Set([
  ...explicitlyLocalizedSources,
  ...discoverTsxFiles('app'),
  ...discoverTsxFiles('components'),
])].sort();

const read = (path) => readFileSync(join(root, path), 'utf8');

function objectTreeFromFile(path, exportName) {
  const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true);
  let result;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === exportName &&
      node.initializer
    ) {
      let initializer = node.initializer;
      while (
        ts.isAsExpression(initializer) ||
        ts.isTypeAssertionExpression(initializer) ||
        ts.isSatisfiesExpression(initializer)
      ) {
        initializer = initializer.expression;
      }
      if (ts.isObjectLiteralExpression(initializer)) {
        result = objectTree(initializer);
        return;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  if (!result) throw new Error('Could not read locale export "' + exportName + '" from ' + path);
  return result;
}

function objectTree(node) {
  const tree = {};
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = property.name;
    const key = ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)
      ? name.text
      : undefined;
    if (!key) continue;

    if (ts.isObjectLiteralExpression(property.initializer)) {
      tree[key] = objectTree(property.initializer);
    } else {
      tree[key] = true;
    }
  }
  return tree;
}

function mergeTrees(base, overrides) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (
      value && typeof value === 'object' &&
      merged[key] && typeof merged[key] === 'object'
    ) {
      merged[key] = mergeTrees(merged[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function hasPath(tree, path) {
  return path.split('.').every((segment, index, parts) => {
    if (!tree || typeof tree !== 'object' || !Object.prototype.hasOwnProperty.call(tree, segment)) {
      return false;
    }
    tree = tree[segment];
    return index === parts.length - 1 || (tree && typeof tree === 'object');
  });
}

const localeTrees = Object.fromEntries(
  Object.entries(localeFiles).map(([locale, paths]) => {
    const [basePath, copyPath] = paths;
    const base = objectTreeFromFile(basePath, locale);
    const copyExport = locale === 'pt' ? 'ptCopy' : 'enCopy';
    const copy = objectTreeFromFile(copyPath, copyExport);
    return [locale, mergeTrees(base, copy)];
  }),
);

const failures = [];
for (const path of localizedSources) {
  const source = read(path);
  const keys = [...source.matchAll(/\bt\(\s*['"]([A-Za-z0-9_.]+)['"]/g)]
    .map((match) => match[1])
    .filter((key) => !key.endsWith('.'));
  for (const key of keys) {
    for (const locale of ['pt', 'en']) {
      if (!hasPath(localeTrees[locale], key)) {
        failures.push(path + ': missing ' + locale + ' translation for "' + key + '"');
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
  'settingsPage',
  'settingsLanguage',
  'crm',
  'crmDetail',
  'billingPage',
  'billingHub',
  'orderManagement',
  'onboarding',
]) {
  for (const locale of ['pt', 'en']) {
    if (!hasPath(localeTrees[locale], section)) {
      failures.push(locale + ': missing translation section "' + section + '"');
    }
  }
}


for (const status of [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
]) {
  for (const locale of ['pt', 'en']) {
    const key = 'orderManagement.status.' + status;
    if (!hasPath(localeTrees[locale], key)) {
      failures.push(locale + ': missing translation for dynamic status "' + key + '"');
    }
  }
}

const localeAwareSources = {
  'app/dashboard/mensagens/page.tsx': ["useLanguage()", 'Appointment reminder', 'copy.loadClientsFailed', 'copy.emailSent'],
  'app/documentation/page.tsx': ["cookieStore.get('locale')?.value === 'en'", 'localizedSections', 'localizedResponseStatuses'],
  'app/plans/page.tsx': ["cookieStore.get('locale')?.value === 'en'", 'localizedFaqs'],
  'app/checkout/page.tsx': ["cookieStore.get('locale')?.value === 'en'", 'Checkout unavailable'],
  'app/checkout/manual/page.tsx': ["cookieStore.get('locale')?.value === 'en'", 'Checkout unavailable'],
  'app/checkout/success/page.tsx': ["useLanguage()", "locale === 'en'", 'Confirming your subscription…', 'formatMoney(payload.promotion.discountAmount, payload.promotion.currency, locale)'],
  'app/checkout/error/page.tsx': ["useLanguage()", "Checkout not completed"],
  'app/api/stripe/embedded-checkout/route.ts': ["cookies()", 'locale: checkoutLocale'],
  'components/hero/pricing-section.tsx': ["useLanguage()", 'HERO_FEATURES_EN', 'const descriptions ='],
  'components/billing/PricingCard.tsx': ["useLanguage()", "english ? 'Current plan'"],
  'components/billing/plan-comparison.tsx': ["useLanguage()", 'FEATURE_LABELS_EN', 'GROUP_LABELS_EN'],
  'components/billing/manual-checkout.tsx': ["useLanguage()", 'COPY_EN', 'english ? \'Annual billing\''],
  'components/billing/custom-checkout.tsx': ["useLanguage()", 'PLAN_COPY_EN', 'englishRef.current'],
};

for (const [path, expectedFragments] of Object.entries(localeAwareSources)) {
  const source = read(path);
  for (const fragment of expectedFragments) {
    if (!source.includes(fragment)) {
      failures.push(path + ': missing locale-aware UI marker "' + fragment + '"');
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
