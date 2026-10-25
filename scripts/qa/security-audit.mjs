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

// Do not let callers choose rate-limit buckets by forging the leftmost
// X-Forwarded-For value. Route handlers must use the shared, validated IP helper.
const spoofableForwardedForPattern = /headers\.get\(['"]x-forwarded-for['"]\)\?\.split\(['"],['"]\)\[0\]/;

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

  if (spoofableForwardedForPattern.test(source)) {
    findings.push(`spoofable X-Forwarded-For rate-limit key: ${file}`);
  }

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
      'request.body?.getReader()',
      'totalBytes > maxBytes',
      "TextDecoder('utf-8', { fatal: true })",
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
      'requireTenantAuthorization(',
      'hasAgendaGrant',
      'resolveAccessPlanForUser',
      "hasPlanFeature(plan, 'appointments')",
      'getLisbonDayBounds(date)',
      "export const GET = withApiObservability('/api/appointments', GET__unobserved)",
    ],
    label: 'Authenticated appointment request validation, tenant binding, and mobile agenda read',
  },
  {
    file: 'app/api/appointments/[appointmentId]/complete/route.ts',
    markers: [
      'readJsonObject(request',
      "allowedKeys: ['paymentMethod', 'descriptionProducts', 'valueProducts']",
      "new Set(['cash', 'mbway', 'card'])",
      "'barber'",
      'requireTenantAuthorization(request, COMPLETION_ROLES)',
      'hasAgendaGrant',
      "hasPlanFeature(plan, 'appointments')",
      ".eq('barbershop_id', barbershopId)",
      ".eq('status', 'scheduled')",
      "'review_submission_tokens'",
      'sendBookingReviewRequestEmail',
      'A marcação já foi alterada',
    ],
    label: 'Appointment completion supports Bearer/cookie auth, agenda permissions, plan entitlement and tenant scoping',
  },
  {
    file: 'app/api/appointments/[appointmentId]/confirm/route.ts',
    markers: [
      'requireTenantAuthorization(request, CONFIRM_ROLES)',
      ".eq('barbershop_id', barbershopId)",
      ".eq('status', 'pending')",
      'dispatchAppointmentAutomations',
      'sendBookingConfirmationEmail',
    ],
    label: 'Appointment confirmation supports Bearer/cookie auth and remains tenant-scoped',
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
  {
    file: 'app/api/_silentra-admin/subscription-requests/[requestId]/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['action', 'paymentLink', 'reason']", 'assertSameOrigin(request)', 'requirePlatformAdmin()'],
    label: 'Manual billing admin request validation and authorization',
  },
  {
    file: 'app/api/marketplace/orders/[orderId]/email/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['subject', 'message']", ".eq('barbershop_id', barbershopId)", 'sendBrevoEmail'],
    label: 'Marketplace order email request validation and tenant binding',
  },
  {
    file: 'app/api/barbershops/avatar/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['avatarUrl']", 'requireTenantAuthorization(request', 'expectedPath', ".eq('id', tenant.barbershopId)"],
    label: 'Avatar update request validation and tenant-scoped storage path',
  },
  {
    file: 'app/api/marketplace/manage/settings/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['marketplaceSalesMode']", "requireModuleContext('pos', 'pos')", 'MODES.includes'],
    label: 'Marketplace settings request validation and tenant authorization',
  },
  {
    file: 'app/api/bookings/customer-profile/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['shopId', 'email', 'phone']", 'UUID_PATTERN.test(shopId)', 'findPublicBookingCustomer'],
    label: 'Public booking customer profile request validation',
  },
  {
    file: 'app/api/loyalty/validate/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['identifier']", 'consumePublicRateLimit', 'validate_loyalty_redemption'],
    label: 'Loyalty redemption validation request envelope and rate limit',
  },
  {
    file: 'app/api/loyalty/earning-rules/route.ts',
    markers: [
      "allowedKeys: ['name', 'serviceId', 'points', 'active']",
      "allowedKeys: ['id', 'name', 'points', 'active', 'serviceId']",
      ".eq('barbershop_id', barbershopId)",
      'uuid(body.serviceId)',
    ],
    label: 'Loyalty earning rule create/update request validation and tenant binding',
  },
  {
    file: 'app/api/loyalty/rewards/route.ts',
    markers: [
      "allowedKeys: ['name', 'description', 'points_cost', 'pointsCost', 'reward_type', 'reward_value', 'active']",
      "allowedKeys: ['id', 'name', 'description', 'points_cost', 'pointsCost', 'reward_type', 'reward_value', 'active']",
      ".eq('barbershop_id', barbershopId)",
      'REWARD_TYPES.has',
    ],
    label: 'Loyalty reward create/update request validation and tenant binding',
  },
  {
    file: 'app/api/loyalty/redeem/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['slug', 'rewardId']", 'getLoyaltyTenantBySlug', 'getLoyaltySession'],
    label: 'Loyalty redemption request validation and session checks',
  },
  {
    file: 'app/api/customer-portal/request-code/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['email']", 'consume_public_rate_limit', 'normalizePortalEmail'],
    label: 'Customer portal verification request validation and rate limiting',
  },
  {
    file: 'app/api/customer-portal/verify-code/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['email', 'code']", 'verify_booking_portal_code', 'normalizePortalEmail'],
    label: 'Customer portal verification code request validation',
  },
  {
    file: 'app/api/loyalty/request-code/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['slug', 'email']", 'consumePublicRateLimit', 'getLoyaltyTenantBySlug'],
    label: 'Loyalty OTP request validation and rate limiting',
  },
  {
    file: 'app/api/loyalty/verify-code/route.ts',
    markers: ['readJsonObject(request', "allowedKeys: ['slug', 'email', 'code', 'name']", 'consumePublicRateLimit', 'getLoyaltyTenantBySlug'],
    label: 'Loyalty OTP verification request validation and rate limiting',
  },
  {
    file: 'app/api/automations/rules/route.ts',
    markers: [
      'readJsonObject(request',
      "allowedKeys: ['name', 'triggerType', 'conditions', 'actions', 'active']",
      'TRIGGERS.includes',
      'actions.length > 10',
      'requireModuleContext',
      ".eq('barbershop_id', barbershopId)",
    ],
    label: 'Automation rule request validation and tenant binding',
  },
  {
    file: 'app/api/barbershops/qr-code/route.ts',
    markers: [
      'readJsonObject(request',
      "allowedKeys: ['text']",
      'requireTenantAuthorization(request, QR_MANAGE_ROLES)',
      ".eq('id', tenant.barbershopId)",
    ],
    label: 'QR code settings request validation and tenant binding',
  },
  {
    file: 'app/api/loyalty/leave/route.ts',
    markers: [
      'readJsonObject(request',
      "allowedKeys: ['slug']",
      'getLoyaltyTenantBySlug(slug)',
      'getLoyaltySession(tenant.barbershopId)',
      "admin.rpc('leave_loyalty_program'",
    ],
    label: 'Loyalty exit request validation and server-side session binding',
  },

  {
    file: 'app/api/enterprise/inventory/route.ts',
    markers: [
      'readJsonObject(request',
      "'locationId',",
      'Number.isFinite(unitPrice)',
      ".eq('parent_barbershop_id', barbershopId)",
      ".eq('barbershop_id', barbershopId)",
    ],
    label: 'Inventory input validation and tenant-scoped location binding',
  },
  {
    file: 'app/api/enterprise/locations/route.ts',
    markers: [
      'readJsonObject(request',
      "allowedKeys: ['name', 'slug', 'phone', 'address']",
      ".eq('parent_barbershop_id', barbershopId)",
      "assertWithinLimit(plan, 'locations'",
    ],
    label: 'Enterprise location request validation, tenant binding and quota',
  },
  {
    file: 'app/api/enterprise/commissions/route.ts',
    markers: [
      'readJsonObject(request',
      "'commissionPercentage',",
      ".eq('barbershop_id', barbershopId)",
      'grossAmount > 1_000_000_000',
      'professional.commission_percentage',
      'Number(service.price)',
      "appointment.status !== 'completed'",
      'existingCommission',
      ".eq('professional_id', professionalId)",
      ".eq('barbershop_id', barbershopId)",
    ],
    label: 'Enterprise commission request validation and tenant binding',
  },

  {
    file: 'lib/barbershops/public-profile.ts',
    markers: [
      "return plan === 'enterprise';",
    ],
    label: 'Custom public URL is restricted to Enterprise plans',
  },
  {
    file: 'app/api/barbershops/public-profile/route.ts',
    markers: [
      'readJsonObject(request',
      'maxBytes: 8 * 1024',
      'allowedKeys: [',
      "const canCustomizeSlug = plan === 'enterprise';",
      'exclusivamente no plano Enterprise',
    ],
    label: 'Public URL changes require server-verified Enterprise entitlement',
  },
  {
    file: 'app/api/loyalty/route.ts',
    markers: [
      'readJsonObject(request',
      "'points_per_euro',",
      "'referralPoints',",
      "typeof body.enabled !== 'boolean'",
      ".eq('barbershop_id', barbershopId)",
    ],
    label: 'Loyalty settings request validation and tenant binding',
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
    file: 'services/billing/plan-access.guard.ts',
    markers: [
      'getAccessPlanForRequest(',
      'getCurrentUser(request)',
      'SubscriptionService.getAccessPlan(userId)',
    ],
    label: 'Request-aware plan guard supports mobile Bearer tokens without changing cookie callers',
  },
  {
    file: 'services/modules/authorization.ts',
    markers: [
      'request?: Request',
      'getAccessPlanForRequest(request)',
      "PERMISSION_ALIASES:",
      "clients: ['clients']",
    ],
    label: 'Module authorization supports request-bound client access and preserved member permissions',
  },
  {
    file: 'app/api/crm/clients/route.ts',
    markers: [
      "requireModuleContext('clients', 'clients', req)",
      ".eq('barbershop_id', tenant.barbershopId)",
      ".eq('role', 'client')",
      'const search = url.searchParams.get(\'search\')?.trim().slice(0, 80)',
      'Cache-Control',
    ],
    label: 'Mobile client directory requires authenticated tenant, module permission and bounded search',
  },
  {
    file: 'app/api/crm/clients/[clientId]/route.ts',
    markers: [
      "requireModuleContext('clients', 'clients', req)",
      'UUID_PATTERN.test(clientId)',
      ".eq('barbershop_id', t.barbershopId)",
      ".eq('role', 'client')",
      'services(name,price), professionals(name)',
      'Cache-Control',
    ],
    label: 'Client details and history are tenant-scoped and protected by plan/module permission',
  },
  {
    file: 'app/api/crm/clients/[clientId]/notes/route.ts',
    markers: [
      "requireModuleContext('clients', 'clients', req)",
      "allowedKeys: ['content']",
      'maxBytes: 8 * 1024',
      'UUID_PATTERN.test(clientId)',
      ".eq('barbershop_id', tenant.barbershopId)",
      ".eq('role', 'client')",
      'content.length > 5000',
      'author_id: tenant.userId',
      'Cache-Control',
    ],
    label: 'CRM note creation validates request, plan/module permissions and tenant before writing',
  },
  {
    file: 'lib/marketing/brevo-webhook.ts',
    markers: [
      "contentType !== 'application/json'",
      'maxBodyBytes = 64 * 1024',
      'totalBytes > maxBodyBytes',
      'payloads.length > 100',
      "errorType: error instanceof Error ? error.name : 'UnknownError'",
    ],
    label: 'Brevo webhook bounded payload parsing and non-sensitive error logging',
  },

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
