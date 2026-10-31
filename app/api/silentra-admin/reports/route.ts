import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';
import { withApiObservability } from '@/lib/observability/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function GET__unobserved(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin();
    const url = new URL(request.url);
    const rawDays = Number(url.searchParams.get('days') ?? 30);
    const days = Number.isInteger(rawDays)
      ? Math.max(7, Math.min(rawDays, 90))
      : 30;
    const { data, error } = await admin.rpc('get_platform_admin_reports', {
      p_days: days,
    });

    if (error) {
      console.error('[SILENTRA_ADMIN_REPORTS_RPC]', {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        {
          ok: false,
          error: 'Não foi possível gerar os relatórios da plataforma.',
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { ok: true, report: data },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError') {
      return NextResponse.json(
        { ok: false, error: 'Not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    console.error('[SILENTRA_ADMIN_REPORTS_FAILED]', {
      error: error instanceof Error ? error.message : 'UNKNOWN',
    });
    return NextResponse.json(
      {
        ok: false,
        error: 'Não foi possível gerar os relatórios da plataforma.',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability(
  '/api/silentra-admin/reports',
  GET__unobserved,
);
