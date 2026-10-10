import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sendBookingConfirmationEmail } from '@/lib/brevo/brevo';
import { dispatchAppointmentAutomations } from '@/lib/automations/dispatch-appointment';

const CONFIRM_ROLES = new Set([
  'owner',
  'admin',
  'manager',
  'receptionist',
  'staff',
  'barber',
]);

async function POSTHandler(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  void request;
  try {
    const { appointmentId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json(
        { success: false, error: 'Sessão inválida.' },
        { status: 401 },
      );

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from('users')
      .select('barbershop_id, role')
      .eq('id', user.id)
      .maybeSingle();
    const role = String(profile?.role ?? '')
      .trim()
      .toLowerCase();
    if (profileError || !profile?.barbershop_id || !CONFIRM_ROLES.has(role))
      return NextResponse.json(
        { success: false, error: 'Sem permissão para confirmar marcações.' },
        { status: 403 },
      );

    const { data: appointment, error: appointmentError } = await admin
      .from('appointments')
      .select(
        'id,status,barbershop_id,date_hour,duration_minutes,manual_name,manual_email,client_id,service_id',
      )
      .eq('id', appointmentId)
      .eq('barbershop_id', profile.barbershop_id)
      .maybeSingle();
    if (appointmentError)
      return NextResponse.json(
        { success: false, error: 'Não foi possível consultar a marcação.' },
        { status: 503 },
      );
    if (!appointment)
      return NextResponse.json(
        { success: false, error: 'Marcação não encontrada.' },
        { status: 404 },
      );
    if (appointment.status !== 'pending')
      return NextResponse.json(
        {
          success: appointment.status === 'scheduled',
          error:
            appointment.status === 'scheduled'
              ? undefined
              : 'Esta marcação já foi processada.',
          alreadyConfirmed: appointment.status === 'scheduled',
          appointment:
            appointment.status === 'scheduled'
              ? {
                  id: appointment.id,
                  status: appointment.status,
                  date_hour: appointment.date_hour,
                }
              : undefined,
        },
        { status: appointment.status === 'scheduled' ? 200 : 409 },
      );

    const [
      { data: barbershop, error: barbershopError },
      { data: service, error: serviceError },
    ] = await Promise.all([
      admin
        .from('barbershops')
        .select('name,address')
        .eq('id', profile.barbershop_id)
        .maybeSingle(),
      appointment.service_id
        ? admin
            .from('services')
            .select('name')
            .eq('id', appointment.service_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (barbershopError || !barbershop)
      return NextResponse.json(
        {
          success: false,
          error: 'Não foi possível carregar os dados da barbearia.',
        },
        { status: 500 },
      );
    if (serviceError)
      console.error(
        '[APPOINTMENT_CONFIRM_SERVICE_ERROR]',
        serviceError.message,
      );

    let clientRelation: {
      name_complete?: string | null;
      email?: string | null;
    } | null = null;
    if (appointment.client_id) {
      const { data: client, error: clientError } = await admin
        .from('users')
        .select('name_complete,email')
        .eq('id', appointment.client_id)
        .maybeSingle();
      if (clientError)
        console.error(
          '[APPOINTMENT_CONFIRM_CLIENT_ERROR]',
          clientError.message,
        );
      clientRelation = client;
    }

    const { data: confirmedAppointment, error: updateError } = await admin
      .from('appointments')
      .update({ status: 'scheduled' })
      .eq('id', appointmentId)
      .eq('barbershop_id', profile.barbershop_id)
      .eq('status', 'pending')
      .select('id,status,date_hour')
      .maybeSingle();
    if (updateError)
      return NextResponse.json(
        { success: false, error: 'Não foi possível confirmar a marcação.' },
        { status: 409 },
      );
    if (!confirmedAppointment)
      return NextResponse.json(
        {
          success: false,
          error: 'Esta marcação já foi processada por outro utilizador.',
          alreadyConfirmed: true,
        },
        { status: 409 },
      );

    const recipientEmail =
      appointment.manual_email?.trim().toLowerCase() ||
      clientRelation?.email?.trim().toLowerCase() ||
      null;
    const recipientName =
      appointment.manual_name?.trim() ||
      clientRelation?.name_complete?.trim() ||
      'Cliente';
    let emailSent = false;
    let emailError: string | null = null;

    if (recipientEmail) {
      try {
        const appointmentDate = new Date(appointment.date_hour);
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
        const result = await sendBookingConfirmationEmail({
          to: recipientEmail,
          clientName: recipientName,
          serviceName: service?.name || 'Serviço',
          date: localDate,
          time: localTime,
          durationMinutes: Number(appointment.duration_minutes ?? 45),
          appointmentId: appointment.id,
          barbershopId: profile.barbershop_id,
          barbershopName: barbershop.name,
          barbershopAddress: barbershop.address || 'Endereço sob consulta',
        });
        emailSent = result.success;
        if (!result.success) emailError = result.error;
      } catch (emailException) {
        emailError =
          emailException instanceof Error
            ? emailException.message
            : String(emailException);
        console.error('[APPOINTMENT_CONFIRM_EMAIL_ERROR]', {
          error: emailError,
          notificationFailed: true,
        });
      }
    }

    void dispatchAppointmentAutomations('booking_created', {
      appointmentId: appointment.id,
      barbershopId: profile.barbershop_id,
      clientId: appointment.client_id,
      manualEmail: appointment.manual_email,
      manualName: appointment.manual_name,
      serviceName: service?.name,
    });

    return NextResponse.json({
      success: true,
      appointment: confirmedAppointment,
      emailSent,
      emailError,
      message: emailSent
        ? 'Marcação confirmada e e-mail enviado.'
        : recipientEmail
          ? 'Marcação confirmada, mas não foi possível enviar o e-mail.'
          : 'Marcação confirmada. O cliente não tem e-mail associado.',
    });
  } catch (error) {
    console.error(
      '[APPOINTMENT_CONFIRM_ERROR]',
      error instanceof Error ? error.message : 'unknown error',
    );
    return NextResponse.json(
      { success: false, error: 'Erro interno ao confirmar a marcação.' },
      { status: 500 },
    );
  }
}


export const POST = withApiLogging('/api/appointments/[appointmentId]/confirm', POSTHandler);
