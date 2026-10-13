import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('app/api');
const publicRoutePatterns = [
  /\/health\/route\.ts$/,
  /\/shops\/route\.ts$/,
  /\/shops\/\[id\]\/.*route\.ts$/,
  /\/bookings\/route\.ts$/,
  /\/customer-portal\//,
  /\/auth\//,
  /\/reviews\//,
  /\/address\/search\/route\.ts$/,
  /\/marketplace\/products\/route\.ts$/,
  /\/cron\//,
  /\/stripe\/webhook\/route\.ts$/,
  /\/stripe\/prices\/route\.ts$/,
  /\/silentra-admin\//,
];

const aliasRoutes = [
  {
    pattern: /\/onboarding\/join\/route\.ts$/,
    requiredMarkers: [
      "export { POST } from '@/app/api/onboarding/join-v2/route'",
    ],
  },
];

const requiredGuards = [
  'requireModuleContext',
  'requireTenantAuthorization',
  'getCurrentUser',
  'requirePlatformAdmin',
  'createClient',
];

const specializedGuards = [
  {
    pattern: /\/bookings\/customer-profile\/route\.ts$/,
    markers: ['findPublicBookingCustomer', 'UUID_PATTERN', 'EMAIL_PATTERN'],
  },
  {
    pattern: /\/calendar\/appointments\/\[appointmentId\]\/route\.ts$/,
    markers: ['verifyCalendarToken'],
  },
  {
    pattern: /\/loyalty\/redemption\/qr\/route\.ts$/,
    markers: ['hashLoyaltyToken'],
  },
  {
    pattern: /\/webhooks\/brevo(?:\/email|\/sms)?\/route\.ts$/,
    markers: ['handleBrevoWebhook'],
  },
];

const routeSecurityChecks = [
  {
    pattern: /\/marketplace\/orders\/track\/route\.ts$/,
    markers: [
      'consumePublicRateLimit',
      "'marketplace-order-track'",
      'createHash',
      'tracking_token_hash',
      'Cache-Control',
    ],
  },
  {
    pattern: /\/marketplace\/products\/route\.ts$/,
    markers: [
      'MAX_QUERY_LENGTH = 80',
      'consumePublicRateLimit',
      "'marketplace-products'",
      'CATALOG_RATE_LIMIT = 120',
      'status: 429',
      'UUID_PATTERN.test(shopId)',
      'normalizeSearchQuery(rawQuery)',
      'if (!SORT_MODES.includes(rawSort as SortMode))',
      'barbershops!inner',
      ".eq('barbershops.is_public_in_directory', true)",
      ".eq('barbershops.marketplace_sales_mode', 'physical_and_online')",
    ],
  },
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name === 'route.ts' || entry.name === 'route.tsx')
      files.push(full);
  }
  return files;
}

const routes = walk(root);
const failures = [];

for (const file of routes) {
  const relative = path.relative(process.cwd(), file).replaceAll(path.sep, '/');
  const source = fs.readFileSync(file, 'utf8');

  const routeSecurityCheck = routeSecurityChecks.find(({ pattern }) =>
    pattern.test(relative),
  );
  if (routeSecurityCheck) {
    const missingMarkers = routeSecurityCheck.markers.filter(
      (marker) => !source.includes(marker),
    );
    if (missingMarkers.length) {
      failures.push(
        `${relative}: missing public-route hardening markers: ${missingMarkers.join(', ')}`,
      );
    }
    continue;
  }

  if (publicRoutePatterns.some((pattern) => pattern.test(relative))) continue;

  const aliasRoute = aliasRoutes.find(({ pattern }) => pattern.test(relative));
  if (aliasRoute) {
    if (aliasRoute.requiredMarkers.every((marker) => source.includes(marker))) {
      continue;
    }
    failures.push(
      `${relative}: legacy alias is not linked to the canonical guarded implementation`,
    );
    continue;
  }

  if (requiredGuards.some((guard) => source.includes(guard))) continue;

  const specializedGuard = specializedGuards.find(({ pattern }) =>
    pattern.test(relative),
  );
  if (
    specializedGuard &&
    specializedGuard.markers.every((marker) => source.includes(marker))
  ) {
    continue;
  }

  failures.push(
    `${relative}: missing a recognizable server-side auth/tenant guard`,
  );
}

if (failures.length) {
  console.error('API audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`API audit passed: ${routes.length} route handlers reviewed.`);
