import { execFileSync } from 'node:child_process';

const sourceFiles = execFileSync(
  'git',
  ['ls-files', '*.ts', '*.tsx', '*.js', '*.mjs', '*.sql'],
  { encoding: 'utf8' },
)
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => !file.startsWith('scripts/qa/'));

const patterns = [
  {
    label: 'service role exposta ao cliente',
    pattern: /NEXT_PUBLIC_[A-Z0-9_]*(SERVICE_ROLE|SECRET)/i,
  },
  {
    label: 'segredo hardcoded',
    pattern:
      /(?:sk_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|xkeysib-[A-Za-z0-9-]+|service_role\s*:\s*["'`][^"'`\n]+["'`]|service_role\s*=\s*[^\s#]+)/i,
  },
  {
    label: 'stack trace enviado para resposta HTTP',
    pattern: /NextResponse\.json\([\s\S]{0,220}?(?:stack|error\.stack)/i,
  },
];

const sensitiveIdentifierPattern =
  /(?:userId|barbershopId|customerId|stripeCustomerId|subscriptionId|stripeSubscriptionId|sessionId|email|phone|address)\s*[:=]/i;
const secretIdentifierPattern =
  /(?:secret|service_role|password|token|apiKey|authorization)\s*[:=]/i;

function extractConsoleArguments(source) {
  const results = [];
  const consoleCallPattern = /console\.(?:log|info|warn|error)\s*\(/g;
  let match;

  while ((match = consoleCallPattern.exec(source))) {
    let index = match.index + match[0].length;
    let depth = 1;
    let quote = null;
    let escaped = false;

    for (; index < source.length && depth > 0; index += 1) {
      const char = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') quote = char;
      else if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
    }
    results.push(source.slice(match.index, index));
  }

  return results;
}

const findings = [];

for (const file of sourceFiles) {
  const source = execFileSync('git', ['show', `HEAD:${file}`], {
    encoding: 'utf8',
  });

  for (const item of patterns) {
    if (item.pattern.test(source)) findings.push(`${item.label}: ${file}`);
  }

  for (const consoleCall of extractConsoleArguments(source)) {
    if (secretIdentifierPattern.test(consoleCall)) {
      findings.push(`console com segredo: ${file}`);
      break;
    }
    if (sensitiveIdentifierPattern.test(consoleCall)) {
      findings.push(`console com identificadores sensíveis: ${file}`);
      break;
    }
  }
}

const requestValidationChecks = [
  {
    file: 'lib/security/request-validation.ts',
    markers: [
      "contentType !== 'application/json'",
      'DEFAULT_MAX_BODY_BYTES',
      'body_too_large',
      'JSON.parse(raw)',
      'Array.isArray(parsed)',
      'unexpected_fields',
      'options.allowedKeys',
    ],
    label: 'Strict server-side JSON envelope validation',
  },
  {
    file: 'app/api/bookings/route.ts',
    markers: [
      'readJsonObject(request',
      'maxBytes: 16 * 1024',
      "'shopId'",
      "'professionalId'",
      'payloadResult.value',
      "create_booking_atomic",
      ".eq('barbershop_id', barbershopId)",
    ],
    label: 'Booking request validation and server-side source-of-truth checks',
  },
  {
    file: 'app/api/billing/subscribe/route.ts',
    markers: [
      'readJsonObject(request',
      "allowedKeys: ['plan', 'interval']",
      "body.interval !== 'month' && body.interval !== 'year'",
      'StripePriceService.resolveVerifiedPrice(plan, interval)',
      'BillingService.assertBillingOwner(user.id)',
      "from('subscriptions')",
    ],
    label: 'Subscription request validation and server-side plan/price checks',
  },
  {
    file: 'app/api/appointments/route.ts',
    markers: [
      'readJsonObject(request',
      "'shopId'",
      "'professionalId'",
      ".eq('barbershop_id', barbershopId)",
      'create_booking_atomic',
    ],
    label: 'Authenticated appointment request validation and tenant binding',
  },
  {
    file: 'app/api/auth/register/route.ts',
    markers: [
      'readJsonObject(request',
      "allowedKeys: ['email', 'name_complete', 'num_phone', 'password']",
      'password.length < 12',
      'password.length > 128',
      'supabase.auth.signUp',
    ],
    label: 'Registration request validation',
  },
  {
    file: 'app/api/marketplace/orders/track/route.ts',
    markers: [
      "contentType !== 'application/json'",
      'MAX_BODY_BYTES = 512',
      'Object.keys(body).length !== 1',
      "Object.hasOwn(body, 'token')",
      'isMarketplaceTrackingToken(token)',
      'hashMarketplaceTrackingToken(token)',
    ],
    label: 'Private order tracking request envelope and token validation',
  },
  {
    file: 'app/api/auth/login/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['email', 'password']", 'signInWithPassword'],
    label: 'Login request validation',
  },
  {
    file: 'app/api/auth/reset-password/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['password']", 'supabase.auth.getUser()', 'supabase.auth.updateUser({ password })'],
    label: 'Password reset request validation and authenticated session',
  },
  {
    file: 'app/api/crm/tags/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['name', 'color']", ".eq('barbershop_id', barbershopId)"],
    label: 'CRM tag request validation and tenant binding',
  },
  {
    file: 'app/api/enterprise/reports/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['name', 'reportType', 'filters']", ".eq('barbershop_id', barbershopId)", 'REPORT_TYPES.includes'],
    label: 'Enterprise report request validation and tenant binding',
  },
  {
    file: 'app/api/marketplace/orders/[orderId]/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['status']", "STATUSES.includes", "requireModuleContext('pos', 'pos')"],
    label: 'Marketplace order status request validation and tenant binding',
  },
  {
    file: 'app/api/public/reviews/route.ts',
    markers: ['readJsonObject(request', "'barbershopId', 'clientName', 'rating', 'comment', 'reviewToken'", 'submit_public_review_with_token', 'createHash'],
    label: 'Public review request validation and one-time token RPC',
  },
];

for (const check of requestValidationChecks) {
  const source = execFileSync('git', ['show', `HEAD:${check.file}`], {
    encoding: 'utf8',
  });
  for (const marker of check.markers) {
    if (!source.includes(marker)) {
      findings.push(`${check.label}: missing guard ${marker} in ${check.file}`);
    }
  }
}

const routeSecurityChecks = [
  {
    file: 'app/api/stripe/subscription/route.ts',
    markers: [
      'sessionUserId !== user.id',
      'expectedCustomerId !== sessionCustomerId',
      'stripeSubscriptionCustomerId !== sessionCustomerId',
      'previousCustomerId !== sessionCustomerId',
    ],
    label: 'Checkout Session ownership binding',
  },
  {
    file: 'lib/security/public-rate-limit.ts',
    markers: ['isIP(real)', 'filter((value) => isIP(value))', '.at(-1)'],
    label: 'Spoof-resistant client IP rate limiting',
  },
  {
    file: 'lib/security/public-rate-limit.ts',
    markers: [
      "process.env.NODE_ENV === 'development'",
      'consumeInMemoryRateLimit',
      'return consumeInMemoryRateLimit(localKey, limit, windowSeconds);',
      'const admin = createAdminClient();',
      "admin.rpc('consume_public_rate_limit'",
      'getRateLimitSecret()',
    ],
    label:
      'Development-only in-memory fallback preserves persistent production rate limiting',
  },
  {
    file: 'scripts/qa/env-check.mjs',
    markers: [
      "'RATE_LIMIT_SECRET'",
      "name === 'RATE_LIMIT_SECRET' && value.length < 32",
    ],
    label: 'Rate limit secret environment validation',
  },
  {
    file: 'supabase/migrations/20261013010000_grant_public_rate_limit_service_role.sql',
    markers: [
      'public.consume_public_rate_limit(text, integer, integer)',
      'to service_role;',
    ],
    label: 'Public rate-limit RPC service-role permission',
  },
  {
    file: 'supabase/migrations/20261013020000_harden_public_security_definer_privileges.sql',
    markers: [
      'revoke all on function public.create_professional_with_quota',
      'from public, anon, authenticated;',
      'alter function public.create_professional_with_quota',
      'set search_path = public;',
      'Intentional public review-submission RPC',
    ],
    label: 'Public SECURITY DEFINER RPC privilege hardening',
  },
];

for (const check of routeSecurityChecks) {
  const source = execFileSync('git', ['show', `HEAD:${check.file}`], {
    encoding: 'utf8',
  });
  for (const marker of check.markers) {
    if (!source.includes(marker)) {
      findings.push(`${check.label}: missing guard ${marker} in ${check.file}`);
    }
  }
}

if (findings.length) {
  console.error('Static security audit failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  `Static security audit passed (${sourceFiles.length} tracked source files checked).`,
);
