import * as Sentry from '@sentry/nextjs';
import { productionLogger } from '@/lib/observability/logger';
import { isSentryEnabled } from '@/lib/observability/sentry';

let handlersRegistered = false;

async function configurePostHogLogCapture() {
  if (process.env.NODE_ENV !== 'production') return;

  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!projectToken) {
    return;
  }

  if (!posthogHost) {
    return;
  }

  const [logsSdk, otlpHttpExporter, resources] = await Promise.all([
    import('@opentelemetry/sdk-logs'),
    import('@opentelemetry/exporter-logs-otlp-http'),
    import('@opentelemetry/resources'),
  ]);
  const loggerProvider = new logsSdk.LoggerProvider({
    resource: resources.resourceFromAttributes({
      'service.name': 'barbershop-web',
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    }),
    processors: [
      new logsSdk.BatchLogRecordProcessor({
        exporter: new otlpHttpExporter.OTLPLogExporter({
          url: `${posthogHost.replace(/\/$/, '')}/i/v1/logs`,
          headers: {
            Authorization: `Bearer ${projectToken}`,
            'Content-Type': 'application/json',
          },
        }),
      }),
    ],
  });
  const posthogLog = loggerProvider.getLogger('silentra-posthog-log-capture');

  posthogLog.emit({
    severityText: 'INFO',
    body: 'PostHog log export initialized',
    attributes: {
      event: 'posthog_log_export_initialized',
      runtime: 'nodejs',
    },
  });
  posthogLog.emit({
    severityText: 'INFO',
    body: 'Server instrumentation registered',
    attributes: {
      event: 'server_instrumentation_registered',
      runtime: 'nodejs',
    },
  });
}

export async function register() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await configurePostHogLogCapture();

    if (isSentryEnabled()) {
      await import('./sentry.server.config');

      if (process.env.NODE_ENV === 'production') {
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
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge' && isSentryEnabled()) {
    await import('./sentry.edge.config');
  }
}

// Next.js 15+ surfaces caught request errors through this instrumentation hook.
export function onRequestError(
  ...args: Parameters<typeof Sentry.captureRequestError>
) {
  if (isSentryEnabled()) {
    Sentry.captureRequestError(...args);
  }
}
