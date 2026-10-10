import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

type Params = { params: Promise<{ clientId: string }> };

async function tenant(req: Request) {
  const authUser = await getCurrentUser(req);
  if (!authUser) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from('users')
    .select('barbershop_id, role')
    .eq('id', authUser.id)
    .maybeSingle();
  if (
    !data?.barbershop_id ||
    !['admin', 'owner', 'staff'].includes(data.role ?? 'staff')
  )
    return null;
  return { admin, userId: authUser.id, barbershopId: data.barbershop_id };
}

async function POSTHandler(req: Request, { params }: Params) {
  const t = await tenant(req);
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { clientId } = await params;
  const body = (await req.json().catch(() => null)) as {
    content?: unknown;
  } | null;
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (content.length < 1 || content.length > 5000)
    return NextResponse.json({ error: 'Invalid note' }, { status: 400 });

  const { data: client } = await t.admin
    .from('users')
    .select('id')
    .eq('id', clientId)
    .eq('barbershop_id', t.barbershopId)
    .eq('role', 'client')
    .maybeSingle();
  if (!client)
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const { data, error } = await t.admin
    .from('client_notes')
    .insert({
      client_id: clientId,
      barbershop_id: t.barbershopId,
      author_id: t.userId,
      content,
    })
    .select('id, content, author_id, created_at, updated_at')
    .single();
  if (error)
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 },
    );
  return NextResponse.json({ note: data }, { status: 201 });
}

export const POST = withApiLogging(
  '/api/crm/clients/[clientId]/notes',
  POSTHandler,
);
