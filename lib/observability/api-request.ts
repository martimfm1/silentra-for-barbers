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

/**
 * Records request metadata without storing request bodies, cookies, IP addresses,
 * query strings, or user-provided values. The database write is best-effort so
 * observability can never turn a successful business operation into a failure.
 */
export function withApiLogging<TArgs extends RouteArguments>(
  route: string,
  handler: (...args: TArgs) => Response | Promise<Response>,
): (...args: TArgs) => Promise<Response> {
  return async (...args: TArgs) => {
    const request = args[0];
    const startedAt = performance.now();
    const requestId = crypto.randomUUID();
    let response: Response | undefined;
    let thrown: unknown;

    try {
      response = await handler(...args);
      return response;
    } catch (error) {
      thrown = error;
      throw error;
    } finally {
      const statusCode = response?.status ?? 500;
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
            : null;

      if (response) {
        try {
          response.headers.set('x-silentra-request-id', requestId);
        } catch {
          // Some framework-managed responses can expose immutable headers.
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
          statusCode >= 500
            ? 'Erro interno ao processar o pedido.'
            : statusCode >= 400
              ? 'O pedido terminou com uma resposta de erro.'
              : 'Pedido processado com sucesso.',
      };

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
        // Logging must remain fail-open even when Supabase is unavailable.
      }
    }
  };
}
