import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/security/request-validation';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertSameOrigin } from '@/services/billing/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MONEYFLOW_API_URL = (
  process.env.MONEYFLOW_API_URL || 'https://moneyflow.silentra.me'
).replace(/\/$/, '');

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET() {
  try {
    const { admin } = await requirePlatformAdmin();
    const [{ data: credential, error }, pending] = await Promise.all([
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

    if (error || pending.error) {
      return json({ ok: false, error: 'Não foi possível consultar a ligação ao MoneyFlow.' }, 500);
    }

    const connected = credential?.status === 'connected';
    return json({
      ok: true,
      connected,
      accountName: connected ? credential?.account_name ?? null : null,
      currencyCode: connected ? credential?.currency_code ?? null : null,
      connectedAt: connected ? credential?.connected_at ?? null : null,
      lastSyncedAt: connected ? credential?.last_synced_at ?? null : null,
      pendingEvents: pending.count ?? 0,
    });
  } catch (error) {
    const unauthorized = error instanceof Error && error.name === 'PlatformAdminError';
    return json({
      ok: false,
      error: unauthorized ? 'Acesso não autorizado.' : 'Não foi possível consultar a ligação ao MoneyFlow.',
    }, unauthorized ? 403 : 500);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin } = await requirePlatformAdmin();
    const bodyResult = await readJsonObject(request, {
      maxBytes: 4 * 1024,
      allowedKeys: ['pairingToken'],
    });
    if (!bodyResult.ok) return bodyResult.response;

    const pairingToken =
      typeof bodyResult.value.pairingToken === 'string'
        ? bodyResult.value.pairingToken.trim().toLowerCase()
        : '';

    if (!/^[a-f0-9]{64}$/.test(pairingToken)) {
      return json({ ok: false, error: 'Código de ligação inválido.' }, 400);
    }

    const eventSecret = randomBytes(32).toString('hex');
    const eventSecretHash = createHash('sha256')
      .update(eventSecret)
      .digest('hex');

    const response = await fetch(
      `${MONEYFLOW_API_URL}/api/integrations/silentra-for-barbers/pair`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({ pairingToken, eventSecretHash }),
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      },
    );

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      accountName?: string;
      currencyCode?: string;
    } | null;

    if (!response.ok || payload?.ok !== true) {
      return json({
        ok: false,
        error: payload?.error || 'O MoneyFlow recusou o código de ligação.',
      }, response.status === 410 ? 410 : 400);
    }

    if (
      typeof payload.accountName !== 'string' ||
      payload.currencyCode !== 'EUR'
    ) {
      return json({ ok: false, error: 'O MoneyFlow devolveu dados de ligação inválidos.' }, 502);
    }

    const now = new Date().toISOString();
    const { error } = await admin
      .from('moneyflow_sync_credentials')
      .upsert({
        integration_key: 'silentra-platform',
        sync_token: eventSecret,
        account_name: payload.accountName.slice(0, 120),
        currency_code: 'EUR',
        status: 'connected',
        connected_at: now,
        last_synced_at: null,
        updated_at: now,
      }, { onConflict: 'integration_key' });

    if (error) {
      await fetch(
        `${MONEYFLOW_API_URL}/api/integrations/silentra-for-barbers/disconnect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventSecret }),
          cache: 'no-store',
          signal: AbortSignal.timeout(5_000),
        },
      ).catch(() => null);
      return json({ ok: false, error: 'A ligação foi validada, mas não foi possível guardar a credencial.' }, 500);
    }

    return json({
      ok: true,
      connected: true,
      accountName: payload.accountName,
      currencyCode: 'EUR',
      connectedAt: now,
      lastSyncedAt: null,
    });
  } catch (error) {
    const unauthorized = error instanceof Error && error.name === 'PlatformAdminError';
    return json({
      ok: false,
      error: unauthorized ? 'Acesso não autorizado.' : 'Não foi possível ligar ao MoneyFlow.',
    }, unauthorized ? 403 : 502);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin } = await requirePlatformAdmin();
    const { data: credential, error: lookupError } = await admin
      .from('moneyflow_sync_credentials')
      .select('sync_token,status')
      .eq('integration_key', 'silentra-platform')
      .maybeSingle();

    if (lookupError) return json({ ok: false, error: 'Não foi possível consultar a ligação.' }, 500);
    if (!credential || credential.status !== 'connected') {
      return json({ ok: true, connected: false });
    }

    const response = await fetch(
      `${MONEYFLOW_API_URL}/api/integrations/silentra-for-barbers/disconnect`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSecret: credential.sync_token }),
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      },
    );

    const payload = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    if (!response.ok || payload?.ok !== true) {
      return json({ ok: false, error: 'O MoneyFlow não confirmou a revogação da ligação.' }, 502);
    }

    const { error } = await admin
      .from('moneyflow_sync_credentials')
      .update({
        status: 'disconnected',
        sync_token: '0'.repeat(64),
        updated_at: new Date().toISOString(),
      })
      .eq('integration_key', 'silentra-platform');

    if (error) return json({ ok: false, error: 'Não foi possível atualizar o estado da ligação.' }, 500);
    return json({ ok: true, connected: false });
  } catch (error) {
    const unauthorized = error instanceof Error && error.name === 'PlatformAdminError';
    return json({
      ok: false,
      error: unauthorized ? 'Acesso não autorizado.' : 'Não foi possível desligar o MoneyFlow.',
    }, unauthorized ? 403 : 502);
  }
}
