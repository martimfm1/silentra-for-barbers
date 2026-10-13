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
