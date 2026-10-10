import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { productionLogger } from '@/lib/observability/logger';

type ApiHandler = (
  ...args: never[]
) => Response | void | Promise<Response | void>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_CODE_PATTERN = /^[A-Za-z0-9_.:-]{1,80}$/;

function safeErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return 'UNHANDLED_EXCEPTION';

  const candidate = error as { code?: unknown; name?: unknown };
  if (
    typeof candidate.code === 'string' &&
    SAFE_CODE_PATTERN.test(candidate.code)
  ) {
    return candidate.code;
  }
  if (
    typeof candidate.name === 'string' &&
    SAFE_CODE_PATTERN.test(candidate.name)
  ) {
    return candidate.name;
  }
  return 'UNHANDLED_EXCEPTION';
}

type ApiLogRow = {
  request_id: string;
  route: string;
  method: string;
  status_code: number;
  duration_ms: number;
  level: 'info' | 'warn' | 'error';
  error_code: string | null;
  environment: string;
  region: string | null;
};

async function persistApiLog(row: ApiLogRow) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return;
  }

  try {
    const { error } = await createAdminClient()
      .from('platform_api_logs')
      .insert(row);
    if (error) {
      productionLogger.warn('observability.api_log_persist_failed', {
        route: row.route,
        method: row.method,
        status_code: row.status_code,
        error_code: safeErrorCode(error),
      });
    }
  } catch (error) {
    productionLogger.warn('observability.api_log_persist_failed', {
      route: row.route,
      method: row.method,
      status_code: row.status_code,
      error_code: safeErrorCode(error),
    });
  }
}

export function withApiObservability<T extends ApiHandler>(
  route: string,
  handler: T,
): T {
  const wrapped = async (
    ...args: Parameters<T>
  ): Promise<Response | void> => {
    const possibleRequest: unknown = args[0];
    const request =
      typeof Request !== 'undefined' && possibleRequest instanceof Request
        ? possibleRequest
        : null;
    const suppliedRequestId = request?.headers.get('x-request-id')?.trim();
    const requestId =
      suppliedRequestId && UUID_PATTERN.test(suppliedRequestId)
        ? suppliedRequestId
        : crypto.randomUUID();
    const method = request?.method?.toUpperCase() ?? 'UNKNOWN';
    const startedAt = performance.now();
    let statusCode = 500;
    let errorCode: string | null = null;
    let handlerThrew = false;

    try {
      const response = await handler(...args);
      statusCode = response instanceof Response ? response.status : 500;
      if (response instanceof Response) {
        try {
          response.headers.set('x-request-id', requestId);
        } catch {
          // Keep the original response if its headers are immutable.
        }
      }
      return response;
    } catch (error) {
      handlerThrew = true;
      errorCode = safeErrorCode(error);
      throw error;
    } finally {
      const durationMs = Math.max(
        0,
        Math.round(performance.now() - startedAt),
      );
      const expectedClientError = [400, 401, 403, 404, 409, 422].includes(
        statusCode,
      );
      const level =
        statusCode >= 500 || handlerThrew
          ? 'error'
          : statusCode >= 400 && !expectedClientError
            ? 'warn'
            : 'info';
      const event =
        level === 'error'
          ? 'api.request_failed'
          : statusCode >= 400
            ? 'api.request_completed_with_client_error'
            : 'api.request_completed';
      const context = {
        request_id: requestId,
        route,
        method,
        status_code: statusCode,
        duration_ms: durationMs,
        error_code: errorCode,
      };

      if (level === 'error') productionLogger.error(event, context);
      else if (level === 'warn') productionLogger.warn(event, context);
      else productionLogger.info(event, context);

      const row: ApiLogRow = {
        request_id: requestId,
        route,
        method,
        status_code: statusCode,
        duration_ms: durationMs,
        level,
        error_code: errorCode,
        environment:
          process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
        region: process.env.VERCEL_REGION?.slice(0, 80) ?? null,
      };

      after(async () => {
        await persistApiLog(row);
      });
    }
  };
  return wrapped as T;
}
