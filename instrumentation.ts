import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from '@opentelemetry/sdk-logs';
import { productionLogger } from '@/lib/observability/logger';

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();

const posthogLogConfiguration =
  posthogToken && posthogHost
    ? {
        token: posthogToken,
        url: `${posthogHost.replace(/\/+$/, '')}/i/v1/logs`,
      }
    : null;

if (!posthogLogConfiguration && process.env.NODE_ENV !== 'production') {
  for (const [variable, value] of [
    ['NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', posthogToken],
    ['NEXT_PUBLIC_POSTHOG_HOST', posthogHost],
  ] as const) {
    if (!value) {
      console.warn(
        `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`,
      );
    }
  }
}

export const posthogLogProvider = posthogLogConfiguration
  ? new LoggerProvider({
      resource: resourceFromAttributes({
        'service.name': 'silentra-for-barbers',
      }),
      processors: [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({
            url: posthogLogConfiguration.url,
            headers: {
              Authorization: `Bearer ${posthogLogConfiguration.token}`,
              'Content-Type': 'application/json',
            },
          }),
        }),
      ],
    })
  : null;

export const posthogLogLogger = posthogLogProvider?.getLogger(
  'silentra.posthog.logs',
);

export async function flushPostHogLogs() {
  if (!posthogLogProvider) return;
  await posthogLogProvider.forceFlush().catch(() => undefined);
}

let handlersRegistered = false;

export async function register() {
  if (process.env.NODE_ENV !== 'production' || handlersRegistered) return;
  handlersRegistered = true;

  process.on('uncaughtException', (error) => {
    productionLogger.exception('server.uncaught_exception', error);
  });

  process.on('unhandledRejection', (reason) => {
    productionLogger.exception('server.unhandled_rejection', reason);
  });

  const noop = () => undefined;
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}
