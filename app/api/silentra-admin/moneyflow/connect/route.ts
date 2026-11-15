import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';
import { assertSameOrigin } from '@/services/billing/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  pairingToken: z.string().regex(/^[a-f0-9]{64}$/i),
});

function moneyFlowApiUrl() {
  const value = (
    process.env.MONEYFLOW_API_URL ?? 'https://moneyflow.silentra.me'
  ).trim();
  const url = new URL(value);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('MoneyFlow endpoint must use HTTPS.');
  }
  return url.toString().replace(/\/$/, '');
}

export async function GET() {
  try {
    const { admin } = await requirePlatformAdmin();
    const [{ data: connection, error }, { count: pendingEvents }] =
      await Promise.all([
        admin
          .from('moneyflow_sync_credentials')
          .select(
            'account_name, currency_code, status, connected_at, last_synced_at',
          )
          .eq('integration_key', 'silentra-platform')
          .maybeSingle(),
        admin
          .from('moneyflow_sync_outbox')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'processing']),
      ]);

    if (error) throw error;

    const connected =
      connection?.status === 'connected' && Boolean(connection.account_name);

    return NextResponse.json(
      {
        ok: true,
        connected,
        accountName: connected ? connection.account_name : null,
        currencyCode: connected ? connection.currency_code : null,
        connectedAt: connected ? connection.connected_at : null,
        lastSyncedAt: connected ? connection.last_synced_at : null,
        pendingEvents: pendingEvents ?? 0,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const status =
      error instanceof Error && error.name === 'PlatformAdminError' ? 403 : 500;
    return NextResponse.json(
      { ok: false, error: 'Não foi possível carregar o estado da ligação.' },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin } = await requirePlatformAdmin();
    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'O código de ligação é inválido.' },
        { status: 400 },
      );
    }

    const eventSecret = randomBytes(32).toString('hex');
    const eventSecretHash = createHash('sha256')
      .update(eventSecret)
      .digest('hex');

    const response = await fetch(
      `${moneyFlowApiUrl()}/api/integrations/silentra-for-barbers/pair`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairingToken: parsed.data.pairingToken,
          eventSecretHash,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      },
    );
    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.ok !== true) {
      return NextResponse.json(
        {
          ok: false,
          error:
            typeof payload?.error === 'string'
              ? payload.error
              : 'O MoneyFlow não aceitou o código. Gera um novo código e tenta novamente.',
        },
        { status: response.status >= 500 ? 502 : 400 },
      );
    }

    const now = new Date().toISOString();
    const { error } = await admin
      .from('moneyflow_sync_credentials')
      .upsert(
        {
          integration_key: 'silentra-platform',
          sync_token: eventSecret,
          account_name: String(payload.accountName).slice(0, 120),
          currency_code: String(payload.currencyCode).toUpperCase(),
          status: 'connected',
          connected_at: now,
          updated_at: now,
        },
        { onConflict: 'integration_key' },
      );

    if (error) {
      console.error('[MONEYFLOW_CONNECT_STORE_FAILED]', {
        code: error.code ?? 'UNKNOWN',
      });
      return NextResponse.json(
        {
          ok: false,
          error: 'A ligação foi iniciada mas não pôde ser guardada. Gera um novo código e tenta novamente.',
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        connected: true,
        accountName: payload.accountName,
        currencyCode: payload.currencyCode,
        connectedAt: now,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const status =
      error instanceof Error && error.name === 'PlatformAdminError' ? 403 : 500;
    return NextResponse.json(
      { ok: false, error: 'Não foi possível concluir a ligação ao MoneyFlow.' },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin } = await requirePlatformAdmin();
    const now = new Date().toISOString();
    const { error } = await admin
      .from('moneyflow_sync_credentials')
      .update({
        status: 'disconnected',
        sync_token: '',
        updated_at: now,
      })
      .eq('integration_key', 'silentra-platform');

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status =
      error instanceof Error && error.name === 'PlatformAdminError' ? 403 : 500;
    return NextResponse.json(
      { ok: false, error: 'Não foi possível desligar o MoneyFlow.' },
      { status },
    );
  }
}
