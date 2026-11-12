import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const posthog = read('lib/observability/posthog.ts');
const sentry = read('lib/observability/sentry.ts');
const clientInstrumentation = read('instrumentation-client.ts');
const serverInstrumentation = read('instrumentation.ts');
const serverConfig = read('sentry.server.config.ts');
const edgeConfig = read('sentry.edge.config.ts');
const nextConfig = read('next.config.ts');
const consent = read('components/privacy/cookie-consent-manager.tsx');
const appointments = read('app/state/_hooks/dashboard/useAppointments.ts');
const appointmentsTable = read(
  'app/dashboard/_components/AppointmentsTable.tsx',
);
const globalError = read('app/global-error.tsx');
const envExample = read('.env.example');
const docs = read('docs/observability.md');
const packageJson = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/ci.yml');

assert.match(posthog, /process\.env\.NODE_ENV !== 'production'/);
assert.match(posthog, /sampleRate: 0\.2/);
assert.match(posthog, /maskAllInputs: true/);
assert.match(posthog, /maskTextSelector:/);
assert.match(posthog, /blockSelector:/);
assert.match(posthog, /autocapture: false/);
assert.ok(posthog.includes('before_send(event)'));
assert.match(posthog, /disable_capture_url_hashes: true/);
assert.match(posthog, /URL_PROPERTIES/);
assert.match(clientInstrumentation, /isSentryEnabled\(\)/);
assert.match(clientInstrumentation, /hasAnalyticsConsent\(\)/);
assert.match(sentry, /NEXT_PUBLIC_SENTRY_ENABLE_IN_DEV/);
assert.match(sentry, /tracesSampleRate: 0\.1/);
assert.match(sentry, /dataCollection: \{/);
assert.match(sentry, /userInfo: false/);
assert.match(sentry, /httpBodies: \[\]/);
assert.match(sentry, /beforeSend\(event\)/);
assert.match(sentry, /beforeSendSpan\(span\)/);
assert.match(sentry, /replaysSessionSampleRate: 0\.1/);
assert.match(sentry, /maskAllText: true/);
assert.match(sentry, /maskAllInputs: true/);
assert.match(sentry, /redactSensitiveText/);
assert.match(sentry, /event\.extra = undefined/);
assert.match(sentry, /event\.breadcrumbs = event\.breadcrumbs\?\.map/);
assert.match(sentry, /ResizeObserver loop limit exceeded/i);
assert.match(sentry, /ERR_BLOCKED_BY_CLIENT/i);
assert.match(serverInstrumentation, /NEXT_RUNTIME === 'nodejs'/);
assert.match(serverInstrumentation, /NEXT_RUNTIME === 'edge'/);
assert.match(serverInstrumentation, /Sentry\.captureRequestError/);
assert.match(serverConfig, /SENTRY_DSN/);
assert.match(edgeConfig, /SENTRY_DSN/);
assert.match(nextConfig, /withSentryConfig\(nextConfig/);
assert.match(consent, /PostHog/);
assert.match(appointments, /captureProductEvent\('agendamento_criado'/);
assert.match(appointments, /captureException\(error/);
assert.match(appointments, /recorrente: recurrence !== 'none'/);
assert.match(appointmentsTable, /ph-no-capture/);
assert.match(globalError, /captureException/);
assert.match(envExample, /NEXT_PUBLIC_POSTHOG_KEY=/);
assert.match(envExample, /NEXT_PUBLIC_POSTHOG_HOST=/);
assert.match(envExample, /NEXT_PUBLIC_SENTRY_DSN=/);
assert.match(envExample, /SENTRY_DSN=/);
assert.match(envExample, /NEXT_PUBLIC_SENTRY_ENABLE_IN_DEV=/);
assert.match(docs, /SENTRY_AUTH_TOKEN/);
assert.equal(
  packageJson.scripts['qa:observability'],
  'node scripts/qa/observability.mjs',
);
assert.ok(packageJson.scripts.qa.includes('pnpm qa:observability'));
assert.match(workflow, /Observability contracts[\s\S]*pnpm qa:observability/);

console.log('Observability QA passed.');
