import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';
import { sendBookingConfirmationEmail } from '@/lib/brevo/brevo';

export const runtime = 'nodejs';

const EMAIL_ROLES = [
  'owner',
  'admin',
  'manager',
  'receptionist',
  'staff',
  'barber',
] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function POST__unobserved(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { appointmentId } = await context.params;
    const tenant = await requireTenantAuthorization(request, EMAIL_ROLES);
    if (!tenant.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            tenant.status === 401
              ? 'Sessão inválida.'
              : 'Sem permissão para enviar emails de marcações.',
        },
        { status: tenant.status },
      );
    }

    const { admin, barbershopId } = tenant;
    const { data: appointment, error: appointmentError } = await admin
      .from('appointments')
      .select(
        'id,status,date_hour,duration_minutes,manual_name,manual_email,client_id,service_id,recurrence_series_id',
      )
      .eq('id', appointmentId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();

    if (appointmentError) {
      console.error('[APPOINTMENT_CREATE_EMAIL_LOOKUP_ERROR]', {
        appointmentId,
        code: appointmentError.code ?? 'UNKNOWN',
      });
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
    if (!['pending', 'scheduled'].includes(appointment.status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Só é possível enviar o email de uma marcação ativa.',
        },
        { status: 409 },
      );
    }

    const [shopResult, serviceResult, clientResult] = await Promise.all([
      admin
        .from('barbershops')
        .select('name,address,default_language')
        .eq('id', barbershopId)
        .maybeSingle(),
      appointment.service_id
        ? admin
            .from('services')
            .select('name,price')
            .eq('id', appointment.service_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      appointment.client_id
        ? admin
            .from('users')
            .select('name_complete,email')
            .eq('id', appointment.client_id)
            .eq('barbershop_id', barbershopId)
            .eq('role', 'client')
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (shopResult.error || !shopResult.data) {
      return NextResponse.json(
        { success: false, error: 'Não foi possível carregar a barbearia.' },
        { status: 503 },
      );
    }
    if (serviceResult.error) {
      console.error('[APPOINTMENT_CREATE_EMAIL_SERVICE_ERROR]', {
        appointmentId,
        code: serviceResult.error.code ?? 'UNKNOWN',
      });
    }
    if (clientResult.error) {
      console.error('[APPOINTMENT_CREATE_EMAIL_CLIENT_ERROR]', {
        appointmentId,
        code: clientResult.error.code ?? 'UNKNOWN',
      });
    }

    const email =
      appointment.manual_email?.trim().toLowerCase() ||
      clientResult.data?.email?.trim().toLowerCase() ||
      '';
    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        {
          success: false,
          emailSent: false,
          error: 'A marcação não tem um endereço de email válido para o cliente.',
        },
        { status: 422 },
      );
    }

    const appointmentDate = new Date(appointment.date_hour);
    if (Number.isNaN(appointmentDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'A data da marcação é inválida.' },
        { status: 422 },
      );
    }
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Lisbon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(appointmentDate);
    const localTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Lisbon',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(appointmentDate);

    let recurringCount = 1;
    if (appointment.recurrence_series_id) {
      const { count, error: seriesError } = await admin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('barbershop_id', barbershopId)
        .eq('recurrence_series_id', appointment.recurrence_series_id);
      if (seriesError) {
        console.error('[APPOINTMENT_CREATE_EMAIL_SERIES_ERROR]', {
          appointmentId,
          code: seriesError.code ?? 'UNKNOWN',
        });
      } else if (typeof count === 'number') {
        recurringCount = Math.max(1, count);
      }
    }

    const result = await sendBookingConfirmationEmail({
      to: email,
      clientName:
        appointment.manual_name?.trim() ||
        clientResult.data?.name_complete?.trim() ||
        'Cliente',
      serviceName: serviceResult.data?.name || 'Serviço',
      servicePrice:
        serviceResult.data?.price == null
          ? undefined
          : Number(serviceResult.data.price),
      date: localDate,
      time: localTime,
      durationMinutes: Number(appointment.duration_minutes ?? 45),
      status: appointment.status === 'scheduled' ? 'scheduled' : 'pending',
      recurringCount,
      appointmentId: appointment.id,
      barbershopId,
      barbershopName: shopResult.data.name || 'Barbearia',
      barbershopAddress: shopResult.data.address || 'Endereço sob consulta',
      language: shopResult.data.default_language === 'en' ? 'en' : 'pt',
    });

    if (!result.success) {
      console.error('[APPOINTMENT_CREATE_EMAIL_SEND_ERROR]', {
        appointmentId,
        error: result.error,
      });
      return NextResponse.json(
        {
          success: false,
          emailSent: false,
          error: 'Não foi possível enviar o email ao cliente.',
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { success: true, emailSent: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[APPOINTMENT_CREATE_EMAIL_ERROR]',
      error instanceof Error ? error.message : 'unknown',
    );
    return NextResponse.json(
      { success: false, emailSent: false, error: 'Erro interno ao enviar o email.' },
      { status: 500 },
    );
  }
}

export const POST = withApiObservability(
  '/api/appointments/[appointmentId]/email',
  POST__unobserved,
);
