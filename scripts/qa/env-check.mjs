const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'BREVO_API_KEY',
  'RATE_LIMIT_SECRET',
];

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

for (const name of required) {
  const value = process.env[name]?.trim();
  if (!value) {
    missing.push(name);
    continue;
  }
  if (placeholderPatterns.some((pattern) => pattern.test(value)))
    placeholders.push(name);
  if (name === 'RATE_LIMIT_SECRET' && value.length < 32)
    weakSecrets.push(name);
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
  weakSecrets.length
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
  process.exit(1);
}

console.log(
  `Environment validation passed (${required.length} required variables checked).`,
);
