import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

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

async function GETHandler(req: Request, { params }: Params) {
  const t = await tenant(req);
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { clientId } = await params;

  const [
    { data: client, error: clientError },
    { data: appointments, error: appointmentError },
    { data: notes },
    { data: tags },
  ] = await Promise.all([
    t.admin
      .from('users')
      .select(
        'id, name_complete, name, email, num_phone, style_notes, created_at',
      )
      .eq('id', clientId)
      .eq('barbershop_id', t.barbershopId)
      .eq('role', 'client')
      .maybeSingle(),
    t.admin
      .from('appointments')
      .select(
        'id, date_hour, status, value_products, payment_method, service_id, professional_id, description_products, created_at',
      )
      .eq('barbershop_id', t.barbershopId)
      .eq('client_id', clientId)
      .order('date_hour', { ascending: false })
      .limit(100),
    t.admin
      .from('client_notes')
      .select('id, content, author_id, created_at, updated_at')
      .eq('barbershop_id', t.barbershopId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    t.admin
      .from('client_tag_assignments')
      .select('tag_id, client_tags(id, name)')
      .eq('barbershop_id', t.barbershopId)
      .eq('client_id', clientId),
  ]);

  if (clientError)
    return NextResponse.json(
      { error: 'Failed to load client' },
      { status: 500 },
    );
  if (!client)
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (appointmentError)
    return NextResponse.json(
      { error: 'Failed to load client history' },
      { status: 500 },
    );
  return NextResponse.json({
    client,
    appointments: appointments ?? [],
    notes: notes ?? [],
    tags: tags ?? [],
  });
}

export const GET = withApiLogging('/api/crm/clients/[clientId]', GETHandler);
