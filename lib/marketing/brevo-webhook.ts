import { NextRequest, NextResponse } from 'next/server';
import { applyProviderDeliveryEvent } from '@/lib/marketing/delivery';

function authorized(request: NextRequest) {
  const secret = process.env.BREVO_WEBHOOK_SECRET;
  if (!secret) return false;
  const authorization = request.headers.get('authorization');
  const headerSecret = request.headers.get('x-webhook-secret');
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

function resolveChannel(payload: Record<string, unknown>): 'email' | 'sms' {
  const channel =
    typeof payload.channel === 'string' ? payload.channel.toLowerCase() : '';
  if (channel === 'sms') return 'sms';

  const eventType =
    typeof payload.event === 'string' ? payload.event.toLowerCase() : '';
  if (eventType.startsWith('sms')) return 'sms';

  return 'email';
}

export async function handleBrevoWebhook(
  request: NextRequest,
  channelOverride?: 'email' | 'sms',
) {
  if (!authorized(request)) {
    console.warn('[BREVO_WEBHOOK] unauthorized');
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const contentType = request.headers
    .get('content-type')
    ?.split(';', 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== 'application/json') {
    return NextResponse.json(
      { ok: false, error: 'Content-Type must be application/json' },
      { status: 415 },
    );
  }

  const maxBodyBytes = 64 * 1024;
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > maxBodyBytes
    ) {
      return NextResponse.json(
        { ok: false, error: 'Payload too large' },
        { status: 413 },
      );
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return NextResponse.json(
      { ok: false, error: 'Empty payload' },
      { status: 400 },
    );
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBodyBytes) {
        await reader.cancel().catch(() => undefined);
        return NextResponse.json(
          { ok: false, error: 'Payload too large' },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Unable to read payload' },
      { status: 400 },
    );
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON payload' },
      { status: 400 },
    );
  }

  const payloads = Array.isArray(raw) ? raw : [raw];
  if (
    payloads.length > 100 ||
    payloads.some(
      (payload) =>
        !payload ||
        typeof payload !== 'object' ||
        Array.isArray(payload),
    )
  ) {
    return NextResponse.json(
      { ok: false, error: 'Invalid webhook event batch' },
      { status: 400 },
    );
  }

  let processed = 0;
  let matched = 0;

  for (const payload of payloads) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      continue;

    const normalized = payload as Record<string, unknown>;
    const channel = channelOverride ?? resolveChannel(normalized);

    try {
      const result = await applyProviderDeliveryEvent({
        channel,
        payload: normalized,
      });

      processed += 1;
      if (result.matched) matched += 1;
    } catch (error) {
      console.error('[BREVO_WEBHOOK] event processing failed', {
        channel,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  return NextResponse.json({ ok: true, processed, matched });
}
