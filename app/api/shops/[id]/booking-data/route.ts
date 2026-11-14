import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidDate, UUID_PATTERN } from '@/lib/validation';
import { isBeforeMinimumBookingNotice } from '@/lib/bookings/minimum-notice';
import {
  getDailySchedule,
  isSlotWithinDailySchedule,
  normalizeWeeklySchedule,
  timeToMinutes as scheduleTimeToMinutes,
} from '@/lib/scheduling/weekly-schedule';

type AppointmentRow = {
  date_hour: string | null;
  duration_minutes: number | null;
  professional_id: string | null;
  status: string | null;
  payment_status?: string | null;
  payment_expires_at?: string | null;
};
type ScheduleBlockRow = {
  id: string;
  professional_id: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}
function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
function parseDateHour(
  value: string | null,
): { date: string; minutes: number } | null {
  if (!value) return null;
  const [date, timePart] = value.includes('T')
    ? value.split('T')
    : value.split(' ');
  if (!date || !timePart) return null;
  return { date, minutes: timeToMinutes(timePart.slice(0, 5)) };
}
function overlaps(
  start: number,
  end: number,
  otherStart: number,
  otherEnd: number,
): boolean {
  return start < otherEnd && end > otherStart;
}
async function GET__unobserved(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: shopId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const serviceId = searchParams.get('serviceId');
    const requestedProfessionalId = searchParams.get('professionalId');
    if (!UUID_PATTERN.test(shopId) || !date || !isValidDate(date))
      return NextResponse.json(
        { error: 'Indica uma data válida.' },
        { status: 400 },
      );
    if (requestedProfessionalId && !UUID_PATTERN.test(requestedProfessionalId))
      return NextResponse.json(
        { error: 'Profissional inválido.' },
        { status: 400 },
      );

    const admin = createAdminClient();
    const { data: shopRecord, error: shopError } = await admin
      .from('shops')
      .select(
        `id, barbershop_id, barbershops (opening_time, closing_time, lunch_start, lunch_end, closed_days, weekly_schedule, minimum_booking_notice_minutes, phone, mbway_enabled, mbway_phone)`,
      )
      .eq('id', shopId)
      .single();
    if (shopError || !shopRecord) {
      console.error('[SHOP_FETCH_ERROR]', shopError?.code ?? 'NOT_FOUND');
      return NextResponse.json(
        { error: 'Barbearia não encontrada.' },
        { status: 404 },
      );
    }

    const barbershopId = shopRecord.barbershop_id;
    const relation = Array.isArray(shopRecord.barbershops)
      ? shopRecord.barbershops[0]
      : shopRecord.barbershops;
    if (!barbershopId || !relation)
      return NextResponse.json(
        { error: 'Configuração da barbearia indisponível.' },
        { status: 503 },
      );
    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;
    const [
      planResult,
      servicesResult,
      professionalsResult,
      blocksResult,
      appointmentsResult,
    ] = await Promise.all([
      admin.rpc('get_effective_billing_plan_for_barbershop', {
        p_barbershop_id: barbershopId,
      }),
      admin
        .from('services')
        .select('*')
        .eq('barbershop_id', barbershopId)
        .eq('is_active', true),
      admin
        .from('professionals')
        .select('id, name, active, weekly_schedule')
        .eq('barbershop_id', barbershopId)
        .eq('active', true)
        .order('name', { ascending: true }),
      admin
        .from('schedule_blocks')
        .select('id, professional_id, date, start_time, end_time, reason')
        .eq('barbershop_id', barbershopId)
        .eq('date', date)
        .order('start_time', { ascending: true }),
      admin
        .from('appointments')
        .select(
          'date_hour, duration_minutes, professional_id, status, payment_status, payment_expires_at',
        )
        .eq('barbershop_id', barbershopId)
        .gte('date_hour', dayStart)
        .lte('date_hour', dayEnd)
        .in('status', ['pending', 'scheduled']),
    ]);
    const effectivePlan = planResult.data;
    const resolvedPlan = ['free', 'pro', 'enterprise'].includes(
      String(effectivePlan ?? '').toLowerCase(),
    )
      ? (String(effectivePlan).toLowerCase() as 'free' | 'pro' | 'enterprise')
      : 'free';
    const { data: blockRows, error: blocksError } = blocksResult;
    const { data: appointments, error: appointmentsError } = appointmentsResult;
    const mbwayPhone = String(relation.mbway_phone ?? '').trim();
    const whatsappPhone = String(relation.phone ?? '').trim();
    const manualPrepayment = {
      enabled:
        relation.mbway_enabled === true &&
        ['pro', 'enterprise'].includes(
          String(effectivePlan ?? '').toLowerCase(),
        ) &&
        mbwayPhone.replace(/\D/g, '').length >= 9 &&
        whatsappPhone.replace(/\D/g, '').length >= 9,
      mbwayPhone,
      whatsappPhone,
    };
    const shopSchedule = normalizeWeeklySchedule(
      relation.weekly_schedule,
      relation,
    );
    const minimumNoticeMinutes = Math.max(
      0,
      Math.min(43200, Number(relation.minimum_booking_notice_minutes ?? 0)),
    );
    const selectedWeekday = new Date(`${date}T12:00:00`).getDay();
    const shopDaySchedule = getDailySchedule(shopSchedule, selectedWeekday);

    if (servicesResult.error) {
      console.error(
        '[BOOKING_SERVICES_ERROR]',
        servicesResult.error.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { error: 'Não foi possível carregar os serviços.' },
        { status: 503 },
      );
    }
    let servicesData: any[] = servicesResult.data ?? [];
    if (servicesData.length === 0) {
      const legacy = await admin
        .from('services')
        .select('*')
        .eq('shop_id', shopId)
        .eq('is_active', true);
      if (legacy.error && legacy.error.code !== '42703')
        return NextResponse.json(
          { error: 'Não foi possível carregar os serviços.' },
          { status: 503 },
        );
      servicesData = legacy.data ?? [];
    }
    const services = servicesData.map((service: any) => ({
      id: service.id,
      barbershopId: service.barbershop_id || service.shop_id || shopId,
      name: service.name || service.title || 'Serviço',
      price: Number(service.price || service.cost || 0),
      durationMinutes: Math.max(
        1,
        Number(service.duration || service.duration_minutes || 30),
      ),
    }));

    // The live professionals table contains only id/barbershop_id/name/commission/active/created_at.
    // Do not query user_id or role here; those columns do not exist and caused 42703.
    if (professionalsResult.error) {
      console.error(
        '[BOOKING_PROFESSIONALS_ERROR]',
        professionalsResult.error.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { error: 'Não foi possível carregar os barbeiros.' },
        { status: 503 },
      );
    }
    const professionalsData: any[] = professionalsResult.data ?? [];
    const professionals = professionalsData.map((professional: any) => ({
      id: professional.id,
      name: professional.name || 'Barbeiro',
      role: 'Barbeiro Profissional',
      weekly_schedule: professional.weekly_schedule
        ? normalizeWeeklySchedule(professional.weekly_schedule)
        : shopSchedule,
    }));
    const professionalSchedules = new Map<string, ReturnType<typeof normalizeWeeklySchedule>>();
    for (const professional of professionalsData) {
      professionalSchedules.set(
        professional.id,
        professional.weekly_schedule
          ? normalizeWeeklySchedule(professional.weekly_schedule)
          : shopSchedule,
      );
    }
    if (
      requestedProfessionalId &&
      !professionals.some(
        (professional) => professional.id === requestedProfessionalId,
      )
    )
      return NextResponse.json(
        { error: 'O profissional selecionado não pertence a esta barbearia.' },
        { status: 400 },
      );

    if (blocksError && blocksError.code !== '42P01') {
      console.error('[BOOKING_BLOCKS_ERROR]', blocksError.code ?? 'UNKNOWN');
      return NextResponse.json(
        { error: 'Não foi possível carregar os horários bloqueados.' },
        { status: 503 },
      );
    }
    const blockedIntervals = ((blockRows ?? []) as ScheduleBlockRow[]).map(
      (block) => ({
        id: block.id,
        professionalId: block.professional_id,
        startTime: block.start_time ? block.start_time.slice(0, 5) : null,
        endTime: block.end_time ? block.end_time.slice(0, 5) : null,
        reason: block.reason?.trim() || 'Horário bloqueado',
        allDay: !block.start_time || !block.end_time,
      }),
    );

    if (appointmentsError) {
      console.error(
        '[BOOKING_APPOINTMENTS_ERROR]',
        appointmentsError.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { error: 'Não foi possível confirmar a agenda.' },
        { status: 503 },
      );
    }

    const now = new Date();
    const todayPortugal = now.toLocaleDateString('en-CA', {
      timeZone: 'Europe/Lisbon',
    });
    const timePortugal = now.toLocaleTimeString('pt-PT', {
      timeZone: 'Europe/Lisbon',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const isToday = date === todayPortugal;
    const currentMinutesNow = timeToMinutes(timePortugal);
    const selectedService = serviceId
      ? services.find((service) => service.id === serviceId)
      : services[0];
    const serviceDuration = Math.min(
      Math.max(Number(selectedService?.durationMinutes ?? 30), 1),
      1440,
    );
    const activeAppointments = (
      (appointments ?? []) as AppointmentRow[]
    ).filter(
      (appointment) =>
        !(
          appointment.payment_status === 'awaiting_review' &&
          appointment.payment_expires_at &&
          new Date(appointment.payment_expires_at).getTime() <= Date.now()
        ),
    );
    const appointmentIntervals = activeAppointments
      .map((appointment) => {
        const parsed = parseDateHour(appointment.date_hour);
        if (!parsed || parsed.date !== date) return null;
        return {
          start: parsed.minutes,
          end:
            parsed.minutes +
            Math.min(
              Math.max(Number(appointment.duration_minutes ?? 30), 1),
              1440,
            ),
          professionalId: appointment.professional_id,
        };
      })
      .filter(Boolean) as Array<{
      start: number;
      end: number;
      professionalId: string | null;
    }>;
    const isBlockedForProfessional = (
      slotStart: number,
      slotEnd: number,
      professionalId: string | null,
    ) =>
      blockedIntervals.some((block) => {
        if (block.professionalId && block.professionalId !== professionalId)
          return false;
        if (block.allDay) return true;
        return overlaps(
          slotStart,
          slotEnd,
          timeToMinutes(block.startTime!),
          timeToMinutes(block.endTime!),
        );
      });
    const isBookedForProfessional = (
      slotStart: number,
      slotEnd: number,
      professionalId: string | null,
    ) =>
      appointmentIntervals.some((appointment) => {
        if (professionalId)
          return (
            appointment.professionalId === professionalId &&
            overlaps(slotStart, slotEnd, appointment.start, appointment.end)
          );
        return (
          appointment.professionalId === null &&
          overlaps(slotStart, slotEnd, appointment.start, appointment.end)
        );
      });
    const canProfessionalTakeSlot = (
      slotStart: number,
      slotEnd: number,
      professionalId: string,
    ) =>
      !isBlockedForProfessional(slotStart, slotEnd, professionalId) &&
      !isBookedForProfessional(slotStart, slotEnd, professionalId);
    const professionalAvailability: Record<string, string[]> =
      Object.fromEntries(
        professionals.map((professional) => [professional.id, []]),
      );

    for (const professional of professionals) {
      const schedule = professionalSchedules.get(professional.id) ?? shopSchedule;
      const daySchedule = getDailySchedule(schedule, selectedWeekday);
      if (daySchedule.day_off) continue;

      for (const period of daySchedule.work_intervals) {
        const periodStart = scheduleTimeToMinutes(period.start);
        const periodEnd = scheduleTimeToMinutes(period.end);
        for (
          let slotStart = periodStart;
          slotStart + serviceDuration <= periodEnd;
          slotStart += 30
        ) {
          const slotEnd = slotStart + serviceDuration;
          if (
            (isToday && slotStart <= currentMinutesNow) ||
            isBeforeMinimumBookingNotice(
              date,
              minutesToTime(slotStart),
              minimumNoticeMinutes,
            ) ||
            !isSlotWithinDailySchedule(daySchedule, slotStart, slotEnd) ||
            !canProfessionalTakeSlot(slotStart, slotEnd, professional.id)
          ) {
            continue;
          }
          professionalAvailability[professional.id].push(
            minutesToTime(slotStart),
          );
        }
      }
    }

    const selectedProfessionalDay = requestedProfessionalId
      ? getDailySchedule(
          professionalSchedules.get(requestedProfessionalId) ?? shopSchedule,
          selectedWeekday,
        )
      : null;
    const isClosedDay = requestedProfessionalId
      ? selectedProfessionalDay?.day_off === true
      : professionals.length > 0
        ? professionals.every(
            (professional) =>
              getDailySchedule(
                professionalSchedules.get(professional.id) ?? shopSchedule,
                selectedWeekday,
              ).day_off,
          )
        : shopDaySchedule.day_off;
    const availableSlots = requestedProfessionalId
      ? (professionalAvailability[requestedProfessionalId] ?? [])
      : Array.from(new Set(Object.values(professionalAvailability).flat())).sort();
    const visibleBlockedIntervals = requestedProfessionalId
      ? blockedIntervals.filter(
          (block) =>
            !block.professionalId ||
            block.professionalId === requestedProfessionalId,
        )
      : blockedIntervals;
    const isClosed =
      isClosedDay || professionals.length === 0 || availableSlots.length === 0;
    return NextResponse.json(
      {
        plan: resolvedPlan,
        services,
        professionals,
        availableSlots,
        professionalAvailability,
        isClosed,
        closedDay: isClosedDay,
        blockedIntervals: visibleBlockedIntervals,
        selectedProfessionalId: requestedProfessionalId,
        manualPrepayment,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[BOOKING_DATA_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      {
        error: 'Não foi possível carregar a disponibilidade. Tenta novamente.',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability(
  '/api/shops/[id]/booking-data',
  GET__unobserved,
);
