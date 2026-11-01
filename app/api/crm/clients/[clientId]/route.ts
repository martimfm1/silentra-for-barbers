import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { UUID_PATTERN } from '@/lib/validation';
import {
  requireModuleContext,
  moduleErrorResponse,
} from '@/services/modules/authorization';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ clientId: string }> };
type AdminClient = Awaited<ReturnType<typeof requireModuleContext>>['admin'];

type CompletedAppointmentAmount = {
  service_price?: number | string | null;
  value_products?: number | string | null;
  services?:
    | { price?: number | string | null }
    | Array<{ price?: number | string | null }>
    | null;
};

async function getCompletedAppointmentsTotal(
  admin: AdminClient,
  barbershopId: string,
  clientId: string,
): Promise<{ total: number; error: boolean }> {
  const pageSize = 500;
  let offset = 0;
  let total = 0;

  while (true) {
    const { data, error } = await admin
      .from('appointments')
      .select('service_price, value_products')
      .eq('barbershop_id', barbershopId)
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .order('date_hour', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('[CRM_CLIENT_TOTAL_SPENT_ERROR]', error.code ?? 'UNKNOWN');
      return { total: 0, error: true };
    }

    const rows = (data ?? []) as unknown as CompletedAppointmentAmount[];
    for (const appointment of rows) {
      total +=
        (Number(appointment.service_price) || 0) +
        (Number(appointment.value_products) || 0);
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return { total: Math.round(total * 100) / 100, error: false };
}

async function GET__unobserved(req: Request, { params }: Params) {
  try {
    const t = await requireModuleContext('clients', 'clients', req);
    const { clientId } = await params;
    if (!UUID_PATTERN.test(clientId)) {
      return NextResponse.json(
        { error: 'Identificador de cliente inválido.' },
        { status: 400 },
      );
    }

    const [
      { data: client, error: clientError },
      { data: appointments, error: appointmentError },
      { data: upcomingAppointments, error: upcomingAppointmentError },
      { data: notes },
      { data: tags },
      completedAppointmentsTotal,
    ] = await Promise.all([
      t.admin
        .from('users')
        .select(
          'id, name_complete, name, email, num_phone, birth_date, style_notes, created_at',
        )
        .eq('id', clientId)
        .eq('barbershop_id', t.barbershopId)
        .eq('role', 'client')
        .maybeSingle(),
      t.admin
        .from('appointments')
        .select(
          'id, date_hour, status, service_price, value_products, payment_method, service_id, professional_id, description_products, created_at, services(name,price), professionals(name)',
        )
        .eq('barbershop_id', t.barbershopId)
        .eq('client_id', clientId)
        .lte('date_hour', new Date().toISOString())
        .order('date_hour', { ascending: false })
        .limit(100),
      t.admin
        .from('appointments')
        .select(
          'id, date_hour, status, service_price, value_products, payment_method, service_id, professional_id, description_products, created_at, services(name,price), professionals(name)',
        )
        .eq('barbershop_id', t.barbershopId)
        .eq('client_id', clientId)
        .in('status', ['pending', 'scheduled'])
        .gte('date_hour', new Date().toISOString())
        .order('date_hour', { ascending: true })
        .limit(20),
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
      getCompletedAppointmentsTotal(t.admin, t.barbershopId, clientId),
    ]);

    if (clientError)
      return NextResponse.json(
        { error: 'Failed to load client' },
        { status: 500 },
      );
    if (!client)
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    if (appointmentError || upcomingAppointmentError)
      return NextResponse.json(
        { error: 'Failed to load client bookings' },
        { status: 500 },
      );
    if (completedAppointmentsTotal.error)
      return NextResponse.json(
        { error: 'Failed to calculate client spending' },
        { status: 503 },
      );
    return NextResponse.json(
      {
        client,
        appointments: appointments ?? [],
        upcomingAppointments: upcomingAppointments ?? [],
        totalSpent: completedAppointmentsTotal.total,
        notes: notes ?? [],
        tags: tags ?? [],
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const authorization = moduleErrorResponse(error);
    if (authorization) return authorization;
    console.error(
      '[CRM_CLIENT_DETAIL_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
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
