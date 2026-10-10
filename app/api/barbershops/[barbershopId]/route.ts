import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_PATTERN } from '@/lib/validation';

export const dynamic = 'force-dynamic';

async function getTenant(req: Request, barbershopId: string) {
  const authUser = await getCurrentUser(req);
  if (!authUser) return null;

  const admin = createAdminClient();
  const { data: user, error } = await admin
    .from('users')
    .select('id, barbershop_id, role')
    .eq('id', authUser.id)
    .maybeSingle();

  if (
    error ||
    !user?.barbershop_id ||
    !['admin', 'owner', 'staff'].includes(user.role ?? 'staff')
  ) {
    return null;
  }

  if (user.barbershop_id !== barbershopId) {
    return null;
  }

  const { data: shop } = await admin
    .from('barbershops')
    .select('id, name, slug, created_at')
    .eq('id', barbershopId)
    .maybeSingle();

  if (!shop) return null;
  return { admin, shop };
}

async function GETHandler(
  request: Request,
  { params }: { params: Promise<{ barbershopId: string }> },
) {
  const { barbershopId } = await params;

  if (!UUID_PATTERN.test(barbershopId)) {
    return NextResponse.json(
      { error: 'Identificador inválido.' },
      { status: 400 },
    );
  }

  const tenant = await getTenant(request, barbershopId);
  if (!tenant) {
    return NextResponse.json(
      { error: 'Não tem acesso a esta barbearia.' },
      { status: 403 },
    );
  }

  return NextResponse.json({
    id: tenant.shop.id,
    name: tenant.shop.name,
    slug: tenant.shop.slug,
    created_at: tenant.shop.created_at,
  });
}


export const GET = withApiLogging('/api/barbershops/[barbershopId]', GETHandler);
