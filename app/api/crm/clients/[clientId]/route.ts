import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { UUID_PATTERN } from '@/lib/validation';
import { requireModuleContext, moduleErrorResponse } from '@/services/modules/authorization';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ clientId: string }> };

async function GET__unobserved(req: Request, { params }: Params) {
  try {
    const t = await requireModuleContext('clients', 'clients', req);
    const { clientId } = await params;
    if (!UUID_PATTERN.test(clientId)) {
      return NextResponse.json({ error: 'Identificador de cliente inválido.' }, { status: 400 });
    }

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
        'id, date_hour, status, value_products, payment_method, service_id, professional_id, description_products, created_at, services(name,price), professionals(name)',
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
  return NextResponse.json(
    {
      client,
      appointments: appointments ?? [],
      notes: notes ?? [],
      tags: tags ?? [],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
  } catch (error) {
    const authorization = moduleErrorResponse(error);
    if (authorization) return authorization;
    console.error('[CRM_CLIENT_DETAIL_ERROR]', error instanceof Error ? error.name : 'UNKNOWN');
    return NextResponse.json(
      { error: 'Não foi possível carregar os dados deste cliente.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability(
  '/api/crm/clients/[clientId]',
  GET__unobserved,
);
