import * as Sentry from '@sentry/nextjs';
import { productionLogger } from '@/lib/observability/logger';

let handlersRegistered = false;

export async function register() {
  if (process.env.NODE_ENV !== 'production' || handlersRegistered) return;
  handlersRegistered = true;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');

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

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Next.js 15+ surfaces caught request errors through this instrumentation hook.
export function onRequestError(
  ...args: Parameters<typeof Sentry.captureRequestError>
) {
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureRequestError(...args);
  }
}
