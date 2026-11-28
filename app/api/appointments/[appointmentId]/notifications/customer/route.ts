import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { assertSameOrigin } from '@/services/billing/http';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';
import { sendWebPushToCustomerEmail } from '@/lib/notifications/providers/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROLES = [
  'owner',
  'admin',
  'manager',
  'barber',
  'receptionist',
  'staff',
] as const;

async function POST__unobserved(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json(
      { success: false, error: 'A origem do pedido não pôde ser validada.' },
      { status: 403 },
    );
  }

  const tenant = await requireTenantAuthorization(request, ROLES);
  if (!tenant.ok) {
    return NextResponse.json(
      { success: false, error: 'Sem autorização para notificar o cliente.' },
      { status: tenant.status },
    );
  }

  const { appointmentId } = await context.params;
  const { data: appointment, error } = await tenant.admin
    .from('appointments')
    .select('id,status,date_hour,manual_email,manual_name,services(name),barbershops(name)')
    .eq('id', appointmentId)
    .eq('barbershop_id', tenant.barbershopId)
    .maybeSingle();

  if (error) {
    console.error('[MANUAL_BOOKING_CUSTOMER_PUSH_LOOKUP_ERROR]', error.code ?? 'UNKNOWN');
    return NextResponse.json(
      { success: false, error: 'Não foi possível consultar a marcação.' },
      { status: 503 },
    );
  }
  if (!appointment) {
    return NextResponse.json(
      { success: false, error: 'Marcação não encontrada.' },
      { status: 404 },
    );
  }

  const email = appointment.manual_email?.trim().toLowerCase() || '';
  if (!email) {
    return NextResponse.json(
      { success: true, skipped: true, reason: 'missing_email' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const service = Array.isArray(appointment.services)
    ? appointment.services[0]
    : appointment.services;
  const shop = Array.isArray(appointment.barbershops)
    ? appointment.barbershops[0]
    : appointment.barbershops;
  const date = new Date(appointment.date_hour);
  const localDate = Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('pt-PT', {
        timeZone: 'Europe/Lisbon',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    : '';

  const result = await sendWebPushToCustomerEmail(email, {
    title: 'Nova marcação · ' + (shop?.name?.trim() || 'Silentra'),
    body: (service?.name?.trim() || 'Serviço') + ' · ' + localDate +
      (appointment.status === 'scheduled' ? ' · Confirmada' : ' · Aguarda confirmação'),
    url: '/my-bookings',
    tag: 'customer-booking-' + appointment.id,
  });

  return NextResponse.json(
    { success: true, sent: result.sent, failed: result.failed },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export const POST = withApiObservability(
  '/api/appointments/[appointmentId]/notifications/customer',
  POST__unobserved,
);
