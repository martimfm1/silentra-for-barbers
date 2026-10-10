import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

type Params = { params: Promise<{ clientId: string }> };

async function tenant(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from('users')
    .select('barbershop_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (
    !data?.barbershop_id ||
    !['admin', 'owner', 'staff'].includes(data.role ?? 'staff')
  )
    return null;
  return { admin, barbershopId: data.barbershop_id };
}

async function POST__unobserved(req: Request, { params }: Params) {
  const t = await tenant(req);
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { clientId } = await params;
  const body = (await req.json().catch(() => null)) as {
    tagId?: unknown;
  } | null;
  const tagId = typeof body?.tagId === 'string' ? body.tagId : '';
  if (!tagId)
    return NextResponse.json({ error: 'Invalid tagId' }, { status: 400 });
  const [{ data: client }, { data: tag }] = await Promise.all([
    t.admin
      .from('users')
      .select('id')
      .eq('id', clientId)
      .eq('barbershop_id', t.barbershopId)
      .eq('role', 'client')
      .maybeSingle(),
    t.admin
      .from('client_tags')
      .select('id')
      .eq('id', tagId)
      .eq('barbershop_id', t.barbershopId)
      .maybeSingle(),
  ]);
  if (!client || !tag)
    return NextResponse.json(
      { error: 'Client or tag not found' },
      { status: 404 },
    );
  const { error } = await t.admin.from('client_tag_assignments').insert({
    client_id: clientId,
    tag_id: tagId,
    barbershop_id: t.barbershopId,
  });
  if (error?.code === '23505')
    return NextResponse.json(
      { error: 'Tag already assigned' },
      { status: 409 },
    );
  if (error)
    return NextResponse.json(
      { error: 'Failed to assign tag' },
      { status: 500 },
    );
  return NextResponse.json({ success: true }, { status: 201 });
}

async function DELETE__unobserved(req: Request, { params }: Params) {
  const t = await tenant(req);
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { clientId } = await params;
  const tagId = new URL(req.url).searchParams.get('tagId') ?? '';
  if (!tagId)
    return NextResponse.json({ error: 'Invalid tagId' }, { status: 400 });
  const { error } = await t.admin
    .from('client_tag_assignments')
    .delete()
    .eq('client_id', clientId)
    .eq('tag_id', tagId)
    .eq('barbershop_id', t.barbershopId);
  if (error)
    return NextResponse.json(
      { error: 'Failed to remove tag' },
      { status: 500 },
    );
  return NextResponse.json({ success: true });
}

export const POST = withApiObservability('/api/crm/clients/[clientId]/tags', POST__unobserved);
export const DELETE = withApiObservability('/api/crm/clients/[clientId]/tags', DELETE__unobserved);
