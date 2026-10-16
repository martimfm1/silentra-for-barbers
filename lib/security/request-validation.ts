import { NextResponse } from 'next/server';

export type JsonObject = Record<string, unknown>;

export type JsonObjectReadResult =
  | { ok: true; value: JsonObject }
  | {
      ok: false;
      response: NextResponse;
      reason: 'unsupported_media_type' | 'body_too_large' | 'invalid_json' | 'invalid_shape' | 'unexpected_fields';
    };

const DEFAULT_MAX_BODY_BYTES = 32 * 1024;

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json(
    { success: false, error },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}

/**
 * Reads an untrusted JSON request without trusting TypeScript casts or client
 * validation. Route handlers must still validate each field and re-fetch
 * authoritative records (ownership, price, plan, status, availability) from
 * the server/database before making changes.
 */
export async function readJsonObject(
  request: Request,
  options: {
    allowedKeys?: readonly string[];
    maxBytes?: number;
  } = {},
): Promise<JsonObjectReadResult> {
  const contentType = request.headers
    .get('content-type')
    ?.split(';', 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== 'application/json') {
    return {
      ok: false,
      response: jsonError(415, 'O pedido tem de usar JSON.'),
      reason: 'unsupported_media_type',
    };
  }

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BODY_BYTES;
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > maxBytes
    ) {
      return {
        ok: false,
        response: jsonError(413, 'O pedido excede o tamanho permitido.'),
        reason: 'body_too_large',
      };
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return {
      ok: false,
      response: jsonError(400, 'O corpo do pedido está vazio.'),
      reason: 'invalid_json',
    };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return {
          ok: false,
          response: jsonError(413, 'O pedido excede o tamanho permitido.'),
          reason: 'body_too_large',
        };
      }
      chunks.push(value);
    }
  } catch {
    return {
      ok: false,
      response: jsonError(400, 'Não foi possível ler o pedido.'),
      reason: 'invalid_json',
    };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let raw: string;
  try {
    raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return {
      ok: false,
      response: jsonError(400, 'A codificação do pedido não é válida.'),
      reason: 'invalid_json',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      response: jsonError(400, 'O JSON enviado não é válido.'),
      reason: 'invalid_json',
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      response: jsonError(400, 'O formato do pedido não é válido.'),
      reason: 'invalid_shape',
    };
  }

  const value = parsed as JsonObject;
  if (options.allowedKeys) {
    const allowed = new Set(options.allowedKeys);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
      return {
        ok: false,
        response: jsonError(400, 'O pedido contém campos não permitidos.'),
        reason: 'unexpected_fields',
      };
    }
  }

  return { ok: true, value };
}

export function isBoundedString(
  value: unknown,
  options: { min?: number; max: number; trim?: boolean },
): value is string {
  if (typeof value !== 'string') return false;
  if (value.length > options.max) return false;
  const candidate = options.trim === false ? value : value.trim();
  return candidate.length >= (options.min ?? 1);
}

export function isSafeIntegerInRange(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
}
