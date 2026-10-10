type LogContext = Record<string, unknown>;

const SENSITIVE_KEY =
  /(password|token|secret|authorization|cookie|api[_-]?key|email|phone|birth|qr|otp|verification[_-]?code|recovery[_-]?code)/i;
const MAX_STRING_LENGTH = 500;

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeValue);
  if (value && typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(
  context: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEY.test(key)) {
      output[key] = '[REDACTED]';
      continue;
    }
    output[key] = sanitizeValue(value);
  }
  return output;
}

function errorDetails(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { name: 'UnknownError' };
  }
  const candidate = error as { name?: unknown; code?: unknown };
  return {
    name: typeof candidate.name === 'string' ? candidate.name : 'Error',
    ...(typeof candidate.code === 'string' ? { code: candidate.code } : {}),
  };
}

function write(
  level: 'info' | 'warn' | 'error',
  event: string,
  context: LogContext = {},
) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    env: process.env.NODE_ENV,
    ...sanitizeObject(context),
  };

  if (level === 'error') console.error('[SILENTRA]', payload);
  else if (level === 'warn') console.warn('[SILENTRA]', payload);
  else if (process.env.NODE_ENV !== 'test') {
    // Generic console.info is silenced by instrumentation.ts in production.
    // Write JSON directly so INFO-level operational logs remain visible.
    process.stdout.write(`[SILENTRA] ${JSON.stringify(payload)}\n`);
  }
}

export const productionLogger = {
  info: (event: string, context?: LogContext) => write('info', event, context),
  warn: (event: string, context?: LogContext) => write('warn', event, context),
  error: (event: string, context?: LogContext) =>
    write('error', event, context),
  exception: (event: string, error: unknown, context?: LogContext) =>
    write('error', event, {
      ...context,
      error: errorDetails(error),
    }),
};
