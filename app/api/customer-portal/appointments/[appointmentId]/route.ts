import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { getPortalSession } from '@/lib/customer-booking-portal';
import { readJsonObject } from '@/lib/security/request-validation';
import { createAdminClient } from '@/lib/supabase/admin';
import { isBeforeMinimumBookingNotice } from '@/lib/bookings/minimum-notice';
import {
  getDailySchedule,
  isSlotWithinDailySchedule,
  normalizeWeeklySchedule,
} from '@/lib/scheduling/weekly-schedule';
import { dispatchAppointmentAutomations } from '@/lib/automations/dispatch-appointment';
import { notifyBarberOfAppointmentChange } from '@/lib/brevo/appointment-change-notifications';
import {
  isSafePublicBookingDate,
  isValidTime,
  UUID_PATTERN,
} from '@/lib/validation';
function timeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}
function minutesToTime(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
function overlaps(
  start: number,
  end: number,
  otherStart: number,
  otherEnd: number,
): boolean {
  return start < otherEnd && end > otherStart;
}
function jsonError(error: string, status = 400) {
  return NextResponse.json(
    { success: false, error },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
async function getAuthorizedAppointment(
  request: Request,
  appointmentId: string,
) {
  const session = await getPortalSession(request);
  if (!session || !UUID_PATTERN.test(appointmentId))
    return { session, appointment: null, admin: null };
  const admin = createAdminClient();
  const { data: appointment, error } = await admin
    .from('appointments')
    .select(
      `id,barbershop_id,date_hour,duration_minutes,status,manual_email,manual_name,client_id,professional_id,service_id,barbershops(name,default_language,opening_time,closing_time,lunch_start,lunch_end,closed_days,weekly_schedule,time_limit_cancellation_hours,minimum_booking_notice_minutes),services(name,duration)`,
    )
    .eq('id', appointmentId)
    .maybeSingle();
  if (error || !appointment) return { session, appointment: null, admin };
  let ownsAppointment =
    appointment.manual_email?.trim().toLowerCase() === session.email;
  let clientName: string | null = null;
  if (appointment.client_id) {
    const { data: client, error: clientError } = await admin
      .from('users')
      .select('email,name_complete')
      .eq('id', appointment.client_id)
      .maybeSingle();
    if (clientError && !ownsAppointment)
      throw new Error('CUSTOMER_LOOKUP_FAILED');
    if (!clientError) {
      clientName = client?.name_complete?.trim() || null;
      if (!ownsAppointment)
        ownsAppointment = client?.email?.trim().toLowerCase() === session.email;
    }
  }
  if (!ownsAppointment) return { session, appointment: null, admin };
  return {
    session,
    appointment: { ...appointment, client_name: clientName },
    admin,
  };
}
function getShop(appointment: any) {
  return Array.isArray(appointment.barbershops)
    ? appointment.barbershops[0]
    : appointment.barbershops;
}
async function getAvailability(
  admin: ReturnType<typeof createAdminClient>,
  appointment: any,
  date: string,
) {
  const shop = getShop(appointment);
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const { data: professionalSchedule, error: professionalScheduleError } =
    await admin
      .from('professionals')
      .select('weekly_schedule')
      .eq('id', appointment.professional_id ?? '')
      .eq('barbershop_id', appointment.barbershop_id)
      .maybeSingle();
  if (professionalScheduleError || (appointment.professional_id && !professionalSchedule))
    throw new Error('PROFESSIONAL_SCHEDULE_LOOKUP_FAILED');
  const shopSchedule = normalizeWeeklySchedule(
    shop?.weekly_schedule,
    shop ?? undefined,
  );
  const effectiveSchedule = professionalSchedule?.weekly_schedule
    ? normalizeWeeklySchedule(professionalSchedule.weekly_schedule)
    : shopSchedule;
  const daySchedule = getDailySchedule(effectiveSchedule, weekday);
  const service = Array.isArray(appointment.services)
    ? appointment.services[0]
    : appointment.services;
  const duration = Math.min(
    Math.max(
      Number(appointment.duration_minutes ?? service?.duration ?? 30),
      1,
    ),
    1440,
  );
  if (daySchedule.day_off)
    return { availableSlots: [], closedDay: true, blockedIntervals: [] };
  const { data: blocks, error: blocksError } = await admin
    .from('schedule_blocks')
    .select('professional_id,start_time,end_time,reason')
    .eq('barbershop_id', appointment.barbershop_id)
    .eq('date', date)
    .order('start_time', { ascending: true });
  if (blocksError && blocksError.code !== '42P01')
    throw new Error('BLOCK_LOOKUP_FAILED');
  const visibleBlocks = (blocks ?? []).filter(
    (block: any) =>
      !block.professional_id ||
      block.professional_id === appointment.professional_id,
  );
  const { data: existingAppointments, error: appointmentsError } = await admin
    .from('appointments')
    .select('id,date_hour,duration_minutes,professional_id')
    .eq('barbershop_id', appointment.barbershop_id)
    .gte('date_hour', `${date}T00:00:00`)
    .lte('date_hour', `${date}T23:59:59`)
    .in('status', ['pending', 'scheduled'])
    .neq('id', appointment.id);
  if (appointmentsError) throw new Error('APPOINTMENT_LOOKUP_FAILED');
  const occupied = (existingAppointments ?? [])
    .filter((item: any) => item.professional_id === appointment.professional_id)
    .map((item: any) => {
      const raw = String(item.date_hour || '');
      const parts = raw.includes('T') ? raw.split('T') : raw.split(' ');
      return parts[0] === date && parts[1]
        ? {
            start: timeToMinutes(parts[1]),
            end:
              timeToMinutes(parts[1]) +
              Math.min(Math.max(Number(item.duration_minutes ?? 30), 1), 1440),
          }
        : null;
    })
    .filter(Boolean) as Array<{ start: number; end: number }>;
  const blockedIntervals = visibleBlocks.map((block: any) => ({
    startTime: block.start_time ? String(block.start_time).slice(0, 5) : null,
    endTime: block.end_time ? String(block.end_time).slice(0, 5) : null,
    reason:
      String(block.reason || 'Horário bloqueado').trim() || 'Horário bloqueado',
  }));
  const slots: string[] = [];
  for (const period of daySchedule.work_intervals) {
    const periodStart = timeToMinutes(period.start);
    const periodEnd = timeToMinutes(period.end);
    for (
      let start = periodStart;
      start + duration <= periodEnd;
      start += 30
    ) {
      const end = start + duration;
      if (!isSlotWithinDailySchedule(daySchedule, start, end)) continue;
      if (
        visibleBlocks.some(
          (block: any) =>
            !block.start_time ||
            !block.end_time ||
            overlaps(
              start,
              end,
              timeToMinutes(block.start_time),
              timeToMinutes(block.end_time),
            ),
        )
      )
        continue;
      if (occupied.some((item) => overlaps(start, end, item.start, item.end)))
        continue;
      const candidateTime = minutesToTime(start);
      if (
        isBeforeMinimumBookingNotice(
          date,
          candidateTime,
          Number(shop?.minimum_booking_notice_minutes ?? 0),
        )
      )
        continue;
      slots.push(candidateTime);
    }
  }
  const todayPortugal = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
  }).format(new Date());
  if (date === todayPortugal) {
    const currentMinutes = timeToMinutes(
      new Intl.DateTimeFormat('pt-PT', {
        timeZone: 'Europe/Lisbon',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date()),
    );
    return {
      availableSlots: slots.filter(
        (slot) => timeToMinutes(slot) > currentMinutes,
      ),
      closedDay: false,
      blockedIntervals,
    };
  }
  return { availableSlots: slots, closedDay: false, blockedIntervals };
}

async function GET__unobserved(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { appointmentId } = await params;
    const { session, appointment, admin } = await getAuthorizedAppointment(
      request,
      appointmentId,
    );
    if (!session)
      return jsonError('Sessão expirada. Confirma novamente o teu email.', 401);
    if (!appointment || !admin)
      return jsonError('Marcação não encontrada.', 404);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '';
    if (!isSafePublicBookingDate(date))
      return jsonError('Indica uma data válida.');
    if (!['pending', 'scheduled'].includes(appointment.status))
      return jsonError('Esta marcação já não pode ser reagendada.', 409);
    const availability = await getAvailability(admin, appointment, date);
    return NextResponse.json(
      { success: true, date, ...availability },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[CUSTOMER_PORTAL_AVAILABILITY_ERROR]', error);
    return jsonError('Não foi possível validar a disponibilidade.', 503);
  }
}

async function DELETE__unobserved(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { appointmentId } = await params;
    const { session, appointment, admin } = await getAuthorizedAppointment(
      request,
      appointmentId,
    );
    if (!session)
      return jsonError('Sessão expirada. Confirma novamente o teu email.', 401);
    if (!appointment || !admin)
      return jsonError('Marcação não encontrada.', 404);
    if (!['pending', 'scheduled'].includes(appointment.status))
      return jsonError('Esta marcação já não pode ser cancelada.', 409);
    const shop = getShop(appointment);
    const cancellationHours = Math.max(
      0,
      Number(shop?.time_limit_cancellation_hours ?? 24),
    );
    const appointmentTime = new Date(appointment.date_hour).getTime();
    if (!Number.isFinite(appointmentTime))
      return jsonError('Data da marcação inválida.', 409);
    if (Date.now() > appointmentTime - cancellationHours * 60 * 60 * 1000)
      return jsonError(
        `Esta marcação já está dentro do prazo mínimo de cancelamento (${cancellationHours}h). Contacta a barbearia para pedir ajuda.`,
        409,
      );
    const { data: updated, error } = await admin
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'Cancelamento pelo cliente através do portal',
        cancellation_actor: 'customer',
        cancellation_actor_name: session.email,
      })
      .eq('id', appointment.id)
      .in('status', ['pending', 'scheduled'])
      .select('id')
      .maybeSingle();
    if (error) {
      console.error('[CUSTOMER_PORTAL_CANCEL_ERROR]', error);
      return jsonError('Não foi possível cancelar a marcação.', 503);
    }
    if (!updated)
      return jsonError(
        'A marcação já foi alterada. Atualiza a página e tenta novamente.',
        409,
      );
    const service = Array.isArray(appointment.services)
      ? appointment.services[0]
      : appointment.services;
    const barberNotification = await notifyBarberOfAppointmentChange({
      event: 'cancelled',
      appointmentId: appointment.id,
      barbershopId: appointment.barbershop_id,
      professionalId: appointment.professional_id,
      customerName:
        appointment.manual_name?.trim() ||
        appointment.client_name ||
        session.email,
      serviceName: service?.name?.trim() || 'Serviço',
      dateHour: appointment.date_hour,
    });
    await admin.from('audit_logs').insert({
      action: 'customer_portal_cancel',
      entity_type: 'appointment',
      entity_id: appointment.id,
      metadata: {
        email: session.email,
        barberEmailsSent: barberNotification.emailsSent,
        barberPushSent: barberNotification.pushSent,
      },
    });
    void dispatchAppointmentAutomations('booking_cancelled', {
      appointmentId: appointment.id,
      barbershopId: appointment.barbershop_id,
      clientId: appointment.client_id,
      manualEmail: appointment.manual_email,
      manualName: appointment.manual_name,
    });
    return NextResponse.json({
      success: true,
      barberNotificationSent:
        barberNotification.emailsSent > 0 || barberNotification.pushSent > 0,
    });
  } catch (error) {
    console.error('[CUSTOMER_PORTAL_CANCEL_CRITICAL]', error);
    return jsonError('Não foi possível cancelar a marcação.', 500);
  }
}

async function PATCH__unobserved(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { appointmentId } = await params;
    if (!UUID_PATTERN.test(appointmentId))
      return jsonError('Identificador de marcação inválido.');

    const bodyResult = await readJsonObject(request, {
      maxBytes: 4 * 1024,
      allowedKeys: ['date', 'slot'],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const date =
      typeof bodyResult.value.date === 'string' ? bodyResult.value.date : '';
    const slot =
      typeof bodyResult.value.slot === 'string'
        ? bodyResult.value.slot.slice(0, 5)
        : '';
    if (!isSafePublicBookingDate(date) || !isValidTime(slot))
      return jsonError('Indica uma data e hora válidas.');
    const { session, appointment, admin } = await getAuthorizedAppointment(
      request,
      appointmentId,
    );
    if (!session)
      return jsonError('Sessão expirada. Confirma novamente o teu email.', 401);
    if (!appointment || !admin)
      return jsonError('Marcação não encontrada.', 404);
    if (!['pending', 'scheduled'].includes(appointment.status))
      return jsonError('Esta marcação já não pode ser reagendada.', 409);
    const shop = getShop(appointment);
    const minimumNoticeMinutes = Math.max(
      0,
      Math.min(43200, Number(shop?.minimum_booking_notice_minutes ?? 0)),
    );
    const currentAppointmentTime = new Date(appointment.date_hour).getTime();
    if (
      minimumNoticeMinutes > 0 &&
      Number.isFinite(currentAppointmentTime) &&
      Date.now() > currentAppointmentTime - minimumNoticeMinutes * 60_000
    )
      return jsonError(
        'Já não podes alterar esta marcação dentro da antecedência mínima configurada.',
        409,
      );
    if (isBeforeMinimumBookingNotice(date, slot, minimumNoticeMinutes))
      return jsonError(
        'Este horário não respeita a antecedência mínima da barbearia. Escolhe um horário mais distante.',
        409,
      );
    const cancellationHours = Math.max(
      0,
      Number(shop?.time_limit_cancellation_hours ?? 24),
    );
    if (
      Date.now() >
      new Date(appointment.date_hour).getTime() -
        cancellationHours * 60 * 60 * 1000
    )
      return jsonError(
        `Esta marcação já está dentro do prazo mínimo de reagendamento (${cancellationHours}h). Contacta a barbearia.`,
        409,
      );
    const availability = await getAvailability(admin, appointment, date);
    if (!availability.availableSlots.includes(slot)) {
      const slotStart = timeToMinutes(slot);
      const slotEnd =
        slotStart +
        Math.min(Math.max(Number(appointment.duration_minutes ?? 30), 1), 1440);
      const block = availability.blockedIntervals.find(
        (item) =>
          item.startTime &&
          item.endTime &&
          overlaps(
            slotStart,
            slotEnd,
            timeToMinutes(item.startTime),
            timeToMinutes(item.endTime),
          ),
      );
      if (block)
        return jsonError(
          `${block.reason} (${block.startTime}–${block.endTime})`,
          409,
        );
      if (availability.closedDay)
        return jsonError('Este dia é de folga da barbearia.', 409);
      return jsonError('Este horário já não está disponível.', 409);
    }
    const newDateHour = `${date}T${slot}:00`;
    const { data: updated, error: updateError } = await admin
      .from('appointments')
      .update({ date_hour: newDateHour })
      .eq('id', appointment.id)
      .in('status', ['pending', 'scheduled'])
      .select('id,date_hour')
      .maybeSingle();
    if (updateError) {
      if (updateError.code === '23505' || updateError.code === '23P01')
        return jsonError(
          'Este horário acabou de ser ocupado. Escolhe outro.',
          409,
        );
      console.error('[CUSTOMER_PORTAL_RESCHEDULE_ERROR]', updateError);
      return jsonError('Não foi possível reagendar a marcação.', 503);
    }
    if (!updated)
      return jsonError(
        'A marcação já foi alterada. Atualiza a página e tenta novamente.',
        409,
      );
    const service = Array.isArray(appointment.services)
      ? appointment.services[0]
      : appointment.services;
    const barberNotification = await notifyBarberOfAppointmentChange({
      event: 'rescheduled',
      appointmentId: appointment.id,
      barbershopId: appointment.barbershop_id,
      professionalId: appointment.professional_id,
      customerName:
        appointment.manual_name?.trim() ||
        appointment.client_name ||
        session.email,
      serviceName: service?.name?.trim() || 'Serviço',
      previousDateHour: appointment.date_hour,
      newDateHour: updated.date_hour,
    });
    await admin.from('audit_logs').insert({
      action: 'customer_portal_reschedule',
      entity_type: 'appointment',
      entity_id: appointment.id,
      metadata: {
        email: session.email,
        from: appointment.date_hour,
        to: newDateHour,
        barberEmailsSent: barberNotification.emailsSent,
        barberPushSent: barberNotification.pushSent,
      },
    });
    return NextResponse.json({
      success: true,
      dateHour: updated.date_hour,
      barberNotificationSent:
        barberNotification.emailsSent > 0 || barberNotification.pushSent > 0,
    });
  } catch (error) {
    console.error('[CUSTOMER_PORTAL_RESCHEDULE_CRITICAL]', error);
    return jsonError('Não foi possível reagendar a marcação.', 500);
  }
}

export const GET = withApiObservability(
  '/api/customer-portal/appointments/[appointmentId]',
  GET__unobserved,
);
export const DELETE = withApiObservability(
  '/api/customer-portal/appointments/[appointmentId]',
  DELETE__unobserved,
);
export const PATCH = withApiObservability(
  '/api/customer-portal/appointments/[appointmentId]',
  PATCH__unobserved,
);
