import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MONEYFLOW_BASE_URL = 'https://moneyflow.silentra.me';

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET() {
  try {
    const { admin } = await requirePlatformAdmin();
    const [{ data: connection, error }, { count: pendingCount, error: pendingError }] =
      await Promise.all([
        admin
          .from('moneyflow_sync_credentials')
          .select('account_name,currency_code,status,connected_at,last_synced_at')
          .eq('integration_key', 'silentra-platform')
          .maybeSingle(),
        admin
          .from('moneyflow_sync_outbox')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'processing']),
      ]);

    if (error || pendingError) {
      return jsonError('Não foi possível carregar o estado da ligação.', 503);
    }

    return NextResponse.json(
      {
        ok: true,
        connected: connection?.status === 'connected',
        accountName: connection?.account_name ?? null,
        currencyCode: connection?.currency_code ?? null,
        connectedAt: connection?.connected_at ?? null,
        lastSyncedAt: connection?.last_synced_at ?? null,
        pendingEvents: pendingCount ?? 0,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError') {
      return jsonError('Not found', 404);
    }
    console.error('[MONEYFLOW_ADMIN_CONNECTION_READ_FAILED]');
    return jsonError('Não foi possível carregar o estado da ligação.', 500);
  }
}

export async function POST(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin();
    let body: { pairingToken?: unknown };

    try {
      body = (await request.json()) as { pairingToken?: unknown };
    } catch {
      return jsonError('Pedido inválido.', 400);
    }

    const pairingToken =
      typeof body.pairingToken === 'string' ? body.pairingToken.trim() : '';
    if (!/^[a-f0-9]{64}$/i.test(pairingToken)) {
      return jsonError('O código de ligação não é válido.', 400);
    }

    const baseUrl = process.env.MONEYFLOW_APP_URL?.trim() || MONEYFLOW_BASE_URL;
    let target: URL;
    try {
      target = new URL(baseUrl);
    } catch {
      return jsonError('A URL do MoneyFlow não está configurada corretamente.', 500);
    }

    // Avoid turning the platform-admin endpoint into an arbitrary server-side fetch.
    if (
      target.protocol !== 'https:' ||
      target.hostname !== 'moneyflow.silentra.me' ||
      target.username ||
      target.password
    ) {
      return jsonError('A origem do MoneyFlow não está autorizada.', 500);
    }

    let response: Response;
    try {
      response = await fetch(new URL('/api/integrations/silentra/connect', target), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairingToken }),
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      return jsonError('Não foi possível contactar o MoneyFlow.', 502);
    }

    if (!response.ok) {
      return jsonError(
        'O código expirou, já foi utilizado ou não pode ser emparelhado.',
        response.status === 401 ? 401 : 502,
      );
    }

    let result: {
      connected?: unknown;
      syncToken?: unknown;
      accountName?: unknown;
      currencyCode?: unknown;
    };
    try {
      result = (await response.json()) as typeof result;
    } catch {
      return jsonError('O MoneyFlow devolveu uma resposta inválida.', 502);
    }

    const syncToken =
      typeof result.syncToken === 'string' ? result.syncToken : '';
    const accountName =
      typeof result.accountName === 'string' ? result.accountName.trim() : '';
    const currencyCode =
      typeof result.currencyCode === 'string'
        ? result.currencyCode.toUpperCase()
        : '';

    if (
      result.connected !== true ||
      !/^[a-f0-9]{64}$/i.test(syncToken) ||
      !accountName ||
      currencyCode !== 'EUR'
    ) {
      return jsonError('A resposta de ligação do MoneyFlow não é válida.', 502);
    }

    const now = new Date().toISOString();
    const { error } = await admin
      .from('moneyflow_sync_credentials')
      .upsert(
        {
          integration_key: 'silentra-platform',
          sync_token: syncToken,
          account_name: accountName,
          currency_code: currencyCode,
          status: 'connected',
          connected_at: now,
          updated_at: now,
        },
        { onConflict: 'integration_key' },
      );

    if (error) {
      // The one-time pairing token has already been consumed. Do not attempt to
      // reuse it; the owner can generate another short-lived token in MoneyFlow.
      console.error('[MONEYFLOW_ADMIN_CONNECTION_SAVE_FAILED]', {
        code: error.code ?? 'unknown',
      });
      return jsonError(
        'A ligação foi criada no MoneyFlow, mas não foi possível guardar o acesso no servidor. Gera um novo código e tenta novamente.',
        503,
      );
    }

    // A new capability token can recover events that previously failed because
    // the old MoneyFlow connection had been revoked or rotated.
    await admin
      .from('moneyflow_sync_outbox')
      .update({
        status: 'pending',
        attempts: 0,
        available_at: now,
        locked_at: null,
        last_error: null,
        updated_at: now,
      })
      .eq('status', 'failed')
      .eq('last_error', 'HTTP_401');

    return NextResponse.json(
      { ok: true, connected: true, accountName, currencyCode, connectedAt: now },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError') {
      return jsonError('Not found', 404);
    }
    console.error('[MONEYFLOW_ADMIN_CONNECTION_CREATE_FAILED]');
    return jsonError('Não foi possível concluir a ligação ao MoneyFlow.', 500);
  }
}
