import * as Sentry from '@sentry/nextjs';

const IGNORED_ERROR_PATTERN =
  /ResizeObserver loop limit exceeded|ResizeObserver loop completed with undelivered notifications|ERR_BLOCKED_BY_CLIENT|chrome-extension:\/\/|moz-extension:\/\/|safari-web-extension:\/\/|extension:\/\//i;

function isIrrelevantBrowserError(event: Sentry.Event) {
  const exceptionText = (event.exception?.values ?? [])
    .map((value) => value.value ?? '')
    .join(' ');
  const frameSources = (event.exception?.values ?? [])
    .flatMap((value) => value.stacktrace?.frames ?? [])
    .map((frame) => frame.filename ?? '')
    .join(' ');

  return IGNORED_ERROR_PATTERN.test(
    [event.message, exceptionText, frameSources, event.request?.url]
      .filter(Boolean)
      .join(' '),
  );
}

function redactSensitiveText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(
      /(?:\+351[\s.-]?)?(?:2[1-9][0-9]|9[0-9]{2})[\s.-]?[0-9]{3}[\s.-]?[0-9]{3}/g,
      '[redacted-phone]',
    );
}

function removeSensitiveRequestData<T extends Sentry.Event>(event: T): T {
  if (event.message) event.message = redactSensitiveText(event.message);
  if (event.transaction)
    event.transaction = redactSensitiveText(event.transaction);

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redactSensitiveText(exception.value);
  }

  // Breadcrumb payloads and arbitrary extras can contain form values or API
  // response bodies. Keep structural metadata only for diagnosis.
  event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
    timestamp: breadcrumb.timestamp,
    type: breadcrumb.type,
    category: breadcrumb.category,
    level: breadcrumb.level,
  }));
  event.extra = undefined;
  event.user = undefined;

  if (event.request) {
    // Do not send form bodies, cookies or query-string values to Sentry.
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;

    if (event.request.headers) {
      for (const header of Object.keys(event.request.headers)) {
        if (
          /authorization|cookie|set-cookie|x-api-key|x-forwarded|forwarded|x-real-ip|remote-addr|referer/i.test(
            header,
          )
        ) {
          delete event.request.headers[header];
        }
      }
    }

    if (event.request.url) {
      try {
        const url = new URL(event.request.url);
        const safePath = url.pathname
          .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[id]')
          .replace(/\/\d+(?=\/|$)/g, '/[id]');
        event.request.url = `${url.origin}${safePath}`;
      } catch {
        event.request.url = undefined;
      }
    }
  }

  return event;
}

/** Enable local Sentry only when explicitly opted in; production remains enabled. */
export function isSentryEnabled() {
  return (
    process.env.NODE_ENV === 'production' ||
    (process.env.NODE_ENV === 'development' &&
      process.env.NEXT_PUBLIC_SENTRY_ENABLE_IN_DEV === 'true')
  );
}

/** Initialize Sentry for a specific runtime when enabled and a DSN exists. */
export function initializeSentry(dsn: string | undefined) {
  if (!isSentryEnabled() || !dsn) return;

  const integrations =
    typeof window !== 'undefined'
      ? [
          Sentry.replayIntegration({
            maskAllText: true,
            maskAllInputs: true,
            blockAllMedia: true,
            block: [
              '.ph-no-capture',
              '[data-ph-no-capture]',
              '[data-private-data]',
            ],
          }),
        ]
      : [];

  Sentry.init({
    dsn,
    enabled: true,
    integrations,
    environment:
      process.env.NODE_ENV === 'production' ? 'production' : 'development',
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      },
      httpBodies: [],
      urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
    },
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    maxBreadcrumbs: 50,
    ignoreErrors: [
      /ResizeObserver loop limit exceeded/i,
      /ResizeObserver loop completed with undelivered notifications/i,
      /ERR_BLOCKED_BY_CLIENT/i,
      /chrome-extension:\/\//i,
      /moz-extension:\/\//i,
      /safari-web-extension:\/\//i,
      /extension:\/\//i,
    ],
    beforeSend(event) {
      if (isIrrelevantBrowserError(event)) return null;
      return removeSensitiveRequestData(event);
    },
    beforeSendSpan(span) {
      span.name = redactSensitiveText(span.name);

      for (const [key, value] of Object.entries(span.attributes)) {
        if (
          /url|http|user|email|phone|query|statement|cookie|authorization|token|request|response/i.test(
            key,
          )
        ) {
          delete span.attributes[key];
        } else if (typeof value === 'string') {
          span.attributes[key] = redactSensitiveText(value);
        }
      }

      return span;
    },
  });
}

/** Manually report a caught exception from an API/action without attaching PII. */
export function captureException(
  error: unknown,
  context: { area: string; action: string },
) {
  if (!isSentryEnabled() || !Sentry.getClient()) return;

  Sentry.captureException(error, {
    tags: {
      area: context.area,
      action: context.action,
    },
  });
}
