const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_PRICE_PRO_MONTHLY',
  'STRIPE_PRICE_PRO_YEARLY',
  'STRIPE_PRICE_ENTERPRISE_MONTHLY',
  'STRIPE_PRICE_ENTERPRISE_YEARLY',
  'BREVO_API_KEY',
  'RATE_LIMIT_SECRET',
  'LOYALTY_REDEMPTION_SECRET',
];

const configuredAppUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim();
const configuredEmailSender =
  process.env.SENDER_EMAIL?.trim() || process.env.BREVO_FROM_EMAIL?.trim();

const publicOnly = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]);
const placeholderPatterns = [
  /^changeme$/i,
  /^replace[-_ ]?me$/i,
  /^your[-_ ].+$/i,
  /^xxx+$/i,
  /^<.+>$/,
];

const missing = [];
const placeholders = [];
const unsafePublicSecrets = [];
const weakSecrets = [];
const invalidAppUrls = [];

if (!configuredAppUrl) {
  missing.push('NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL');
}
if (!configuredEmailSender) {
  missing.push('SENDER_EMAIL or BREVO_FROM_EMAIL');
}
if (configuredAppUrl) {
  try {
    const appUrl = new URL(configuredAppUrl);
    if (appUrl.protocol !== 'https:' || appUrl.username || appUrl.password) {
      invalidAppUrls.push('NEXT_PUBLIC_APP_URL/NEXT_PUBLIC_SITE_URL');
    }
  } catch {
    invalidAppUrls.push('NEXT_PUBLIC_APP_URL/NEXT_PUBLIC_SITE_URL');
  }
}

for (const name of required) {
  const value = process.env[name]?.trim();
  if (!value) {
    missing.push(name);
    continue;
  }
  if (placeholderPatterns.some((pattern) => pattern.test(value)))
    placeholders.push(name);
  if (
    (name === 'RATE_LIMIT_SECRET' || name === 'LOYALTY_REDEMPTION_SECRET') &&
    value.length < 32
  ) weakSecrets.push(name);
}

for (const [name, value] of Object.entries(process.env)) {
  if (!name.startsWith('NEXT_PUBLIC_') || !value) continue;
  if (
    /SECRET|SERVICE_ROLE|WEBHOOK|TOKEN|PRIVATE|PASSWORD/i.test(name) &&
    !publicOnly.has(name)
  ) {
    unsafePublicSecrets.push(name);
  }
}

if (
  missing.length ||
  placeholders.length ||
  unsafePublicSecrets.length ||
  weakSecrets.length ||
  invalidAppUrls.length
) {
  console.error('Production environment validation failed.');
  if (missing.length) console.error(`Missing: ${missing.join(', ')}`);
  if (placeholders.length)
    console.error(`Placeholder values: ${placeholders.join(', ')}`);
  if (weakSecrets.length) {
    console.error(
      `Secrets with insufficient length (minimum 32 characters): ${weakSecrets.join(', ')}`,
    );
  }
  if (unsafePublicSecrets.length)
    console.error(
      `Potential public secrets: ${unsafePublicSecrets.join(', ')}`,
    );
  if (invalidAppUrls.length)
    console.error(
      `Invalid canonical application URL (HTTPS required): ${invalidAppUrls.join(', ')}`,
    );
  process.exit(1);
}

console.log(
  `Environment validation passed (${required.length} required variables checked).`,
);
