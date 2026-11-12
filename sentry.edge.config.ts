import { initializeSentry } from '@/lib/observability/sentry';

initializeSentry(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
