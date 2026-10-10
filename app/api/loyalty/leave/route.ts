import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { clearLoyaltyCookie, getLoyaltySession } from '@/lib/loyalty/session';
import { requireTenantAuthorization } from '@/lib/security/tenant-guard';
import { getLoyaltyTenantBySlug } from '@/lib/loyalty/public-tenant';

export const runtime = 'nodejs';

async function POSTHandler(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { slug?: unknown };
    const slug =
      typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    if (!slug)
      return NextResponse.json(
        { error: 'Barbearia inválida.' },
        { status: 400 },
      );

    const tenant = await getLoyaltyTenantBySlug(slug);
    if (!tenant)
      return NextResponse.json(
        { error: 'A fidelização não está disponível.' },
        { status: 404 },
      );

    await requireTenantAuthorization({
      barbershopId: tenant.barbershopId,
      allowPublicTenant: true,
    });

    const session = await getLoyaltySession(tenant.barbershopId);
    if (!session)
      return NextResponse.json(
        { error: 'Não estás autenticado na fidelização.' },
        { status: 401 },
      );

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('leave_loyalty_program', {
      p_barbershop_id: tenant.barbershopId,
      p_email: session.email,
    });

    if (error) {
      console.error('[LOYALTY_LEAVE_ERROR]', {
        code: error.code ?? 'UNKNOWN',
        message: error.message,
      });
      return NextResponse.json(
        { error: 'Não foi possível sair da fidelização.' },
        { status: 503 },
      );
    }

    if (data !== true)
      return NextResponse.json(
        { error: 'Não tens uma adesão ativa nesta barbearia.' },
        { status: 404 },
      );

    await clearLoyaltyCookie();
    return NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[LOYALTY_LEAVE_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { error: 'Não foi possível sair da fidelização.' },
      { status: 503 },
    );
  }
}


export const POST = withApiLogging('/api/loyalty/leave', POSTHandler);
