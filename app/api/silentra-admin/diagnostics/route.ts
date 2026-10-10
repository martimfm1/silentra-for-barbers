import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function result(name: string, ok: boolean, ms: number, detail?: string) {
  return { name, ok, ms, detail: detail ?? null };
}

async function GET__unobserved(request: Request) {
  const started = performance.now();
  try {
    const { admin } = await requirePlatformAdmin();
    const url = new URL(request.url);
    const barbershopId = url.searchParams.get('barbershopId')?.trim() || '';
    const checks: Array<{
      name: string;
      ok: boolean;
      ms: number;
      detail: string | null;
    }> = [];

    const run = async (
      name: string,
      fn: () => Promise<{ ok: boolean; detail?: string }>,
    ) => {
      const t = performance.now();
      try {
        const value = await fn();
        checks.push(
          result(
            name,
            value.ok,
            Math.round(performance.now() - t),
            value.detail,
          ),
        );
      } catch (error) {
        checks.push(
          result(
            name,
            false,
            Math.round(performance.now() - t),
            error instanceof Error ? error.message : 'Erro desconhecido',
          ),
        );
      }
    };

    await run('barbershops', async () => {
      const { error } = await admin
        .from('barbershops')
        .select('id', { count: 'exact', head: true });
      return error ? { ok: false, detail: error.message } : { ok: true };
    });

    await run('users', async () => {
      const { error } = await admin
        .from('users')
        .select('id', { count: 'exact', head: true });
      return error ? { ok: false, detail: error.message } : { ok: true };
    });

    await run('appointments', async () => {
      const { error } = await admin
        .from('appointments')
        .select('id', { count: 'exact', head: true });
      return error ? { ok: false, detail: error.message } : { ok: true };
    });

    await run('subscriptions', async () => {
      const { error } = await admin
        .from('subscriptions')
        .select('id', { count: 'exact', head: true });
      return error ? { ok: false, detail: error.message } : { ok: true };
    });

    await run('barbershop_plan_assignments', async () => {
      const { error } = await admin
        .from('barbershop_plan_assignments')
        .select('barbershop_id', { count: 'exact', head: true });
      return error ? { ok: false, detail: error.message } : { ok: true };
    });

    await run('plan_resolver_rpc', async () => {
      if (!UUID_RE.test(barbershopId))
        return {
          ok: true,
          detail: 'Ignorado: seleciona uma barbearia para testar o resolver.',
        };
      const { error } = await admin.rpc(
        'get_effective_billing_plan_for_barbershop',
        { p_barbershop_id: barbershopId },
      );
      return error ? { ok: false, detail: error.message } : { ok: true };
    });

    await run('set_plan_rpc_exists', async () => {
      if (!UUID_RE.test(barbershopId))
        return {
          ok: true,
          detail: 'Ignorado: seleciona uma barbearia para testar os RPCs.',
        };
      const { error } = await admin.rpc(
        'get_effective_billing_plan_for_barbershop',
        { p_barbershop_id: barbershopId },
      );
      return error
        ? { ok: false, detail: error.message }
        : { ok: true, detail: 'RPC disponível e executável com service role.' };
    });

    const failed = checks.filter((check) => !check.ok);
    return NextResponse.json(
      {
        ok: failed.length === 0,
        generatedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        checks,
      },
      {
        status: failed.length === 0 ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError') {
      return NextResponse.json(
        { ok: false, error: 'Not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    console.error('[SILENTRA_ADMIN_DIAGNOSTICS]', error);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível executar o diagnóstico interno.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability(
  '/api/silentra-admin/diagnostics',
  GET__unobserved,
);
