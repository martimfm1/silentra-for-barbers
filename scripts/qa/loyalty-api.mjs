import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationDirectory = path.join(root, 'supabase/migrations');
const migrationName = fs
  .readdirSync(migrationDirectory)
  .filter((name) => /^\d+_fix_loyalty_redemption_api\.sql$/.test(name))
  .sort()
  .at(-1);

const checks = [
  {
    file: 'app/api/loyalty/redeem/route.ts',
    markers: [
      "allowedKeys: ['slug', 'rewardId']",
      'getLoyaltySession(tenant.barbershopId)',
      'encryptRedemptionSecret(token)',
      'p_token_encrypted: tokenEncrypted',
      'p_code_encrypted: codeEncrypted',
      'LOYALTY_ACTIVE_REDEMPTION_EXISTS',
      'Cache-Control',
    ],
  },
  {
    file: 'app/api/loyalty/me/route.ts',
    markers: [
      "admin.rpc('expire_loyalty_redemptions')",
      'if (expiryError)',
      'barbershopError',
      'Cache-Control',
    ],
  },
  {
    file: 'app/api/loyalty/redemption/recover/route.ts',
    markers: [
      "admin.rpc('expire_loyalty_redemptions')",
      'if (expiryError)',
      'rewardError',
      'settingsError',
      'decryptRedemptionSecret',
    ],
  },
  {
    file: 'app/api/loyalty/verify-code/route.ts',
    markers: [
      "allowedKeys: ['slug', 'email', 'code', 'name']",
      'verificationError',
      "'consume_loyalty_verification'",
      "'join_loyalty_program'",
    ],
  },
  {
    file: '.env.example',
    markers: ['LOYALTY_REDEMPTION_SECRET='],
  },
  {
    file: 'scripts/qa/env-check.mjs',
    markers: [
      "'LOYALTY_REDEMPTION_SECRET'",
      "name === 'LOYALTY_REDEMPTION_SECRET'",
    ],
  },
];

const failures = [];
for (const check of checks) {
  const source = fs.readFileSync(path.join(root, check.file), 'utf8');
  for (const marker of check.markers) {
    if (!source.includes(marker)) {
      failures.push(`${check.file}: missing ${marker}`);
    }
  }
}

if (!migrationName) {
  failures.push('Missing fix_loyalty_redemption_api migration');
} else {
  const migration = fs.readFileSync(
    path.join(migrationDirectory, migrationName),
    'utf8',
  );
  const migrationMarkers = [
    'drop function if exists public.redeem_loyalty_reward',
    'p_token_encrypted text',
    'p_code_encrypted text',
    'for update',
    'LOYALTY_ACTIVE_REDEMPTION_EXISTS',
    "set search_path = ''",
    'revoke all on function public.redeem_loyalty_reward',
    'to service_role;',
    "notify pgrst, 'reload schema'",
  ];
  for (const marker of migrationMarkers) {
    if (!migration.includes(marker)) {
      failures.push(`${migrationName}: missing ${marker}`);
    }
  }
}

if (failures.length) {
  console.error('Loyalty API contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Loyalty API contract passed.');
