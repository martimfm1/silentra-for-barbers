import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type ApiLogLevel = 'info' | 'warn' | 'error';

type ApiLogRecord = {
  request_id: string;
  method: string;
  route: string;
  status_code: number;
  duration_ms: number;
  level: ApiLogLevel;
  error_code: string | null;
  message: string;
};

type RouteArguments = [Request, ...unknown[]];
type RouteResult = Response | void | Promise<Response | void>;

/**
 * Captures metadata for API requests without recording bodies, cookies, IPs,
 * query strings, credentials, or user-provided values.
 *
 * The log write runs with Next's post-response lifecycle so analytics do not
 * add database latency to booking, authentication, and payment operations.
 */
export function withApiLogging<TArgs extends RouteArguments>(
  route: string,
  handler: (...args: TArgs) => RouteResult,
): (...args: TArgs) => Promise<Response | void> {
  return async (...args: TArgs) => {
    const request = args[0];
    const startedAt = performance.now();
    const requestId = crypto.randomUUID();
    let response: Response | void = undefined;
    let thrown: unknown;

    try {
      response = await handler(...args);
      return response;
    } catch (error) {
      thrown = error;
      throw error;
    } finally {
      const statusCode = response instanceof Response ? response.status : 500;
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      const level: ApiLogLevel =
        statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
      const candidate =
        thrown && typeof thrown === 'object'
          ? (thrown as { code?: unknown; name?: unknown })
          : null;
      const errorCode =
        candidate && typeof candidate.code === 'string' &&
        /^[A-Za-z0-9_:-]{1,80}$/.test(candidate.code)
          ? candidate.code
          : thrown && candidate && typeof candidate.name === 'string'
            ? candidate.name.slice(0, 80)
            : response === undefined
              ? 'EMPTY_RESPONSE'
              : null;

      if (response instanceof Response) {
        try {
          response.headers.set('x-silentra-request-id', requestId);
        } catch {
          // Framework-managed response headers may be immutable.
        }
      }

      const record: ApiLogRecord = {
        request_id: requestId,
        method: request.method.toUpperCase(),
        route,
        status_code: statusCode,
        duration_ms: durationMs,
        level,
        error_code: errorCode,
        message:
          thrown || statusCode >= 500
            ? 'A API não conseguiu concluir o pedido.'
            : response === undefined
              ? 'A rota terminou sem produzir uma resposta HTTP.'
              : statusCode >= 400
                ? 'O pedido terminou com uma resposta de erro HTTP.'
                : 'Pedido processado com sucesso.',
      };

      after(async () => {
        try {
          const admin = createAdminClient();
          const { error } = await admin.from('platform_api_logs').insert(record);
          if (
            error &&
            error.code !== '42P01' &&
            error.code !== 'PGRST205' &&
            process.env.NODE_ENV !== 'test'
          ) {
            console.error('[SILENTRA_API_LOG_WRITE_FAILED]', {
              route,
              error_code: error.code ?? 'UNKNOWN',
            });
          }
        } catch {
          // Observability must never change the business operation's result.
        }
      });
    }
  };
}
