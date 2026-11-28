import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';
import { isValidDate, UUID_PATTERN } from '@/lib/validation';
import { getReservedAppointmentMinutes } from '@/lib/bookings/appointment-capacity';
import {
  appointmentsShareProfessionalCapacity,
  getDailySchedule,
  isSlotWithinDailySchedule,
  normalizeWeeklySchedule,
  timeToMinutes,
  type LegacyScheduleInput,
  type WeeklySchedule,
} from '@/lib/scheduling/weekly-schedule';

type AppointmentRow = {
  date_hour: string | null;
  duration_minutes: number | null;
  buffer_minutes: number | null;
  professional_id: string | null;
  status: 'pending' | 'scheduled' | string | null;
  payment_status?: string | null;
  payment_expires_at?: string | null;
  manual_name?: string | null;
  services?: {
    name?: string | null;
    duration?: number | string | null;
    buffer_minutes?: number | string | null;
  } | {
    name?: string | null;
    duration?: number | string | null;
    buffer_minutes?: number | string | null;
  }[] | null;
  users?: { name_complete?: string | null } | { name_complete?: string | null }[] | null;
};

type ScheduleBlockRow = {
  id: string;
  professional_id: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

type SlotStatus = 'available' | 'booked' | 'blocked' | 'break' | 'past';

type AvailabilitySlot = {
  time: string;
  endTime: string;
  status: SlotStatus;
  detail: string | null;
};

function addDaysToDate(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function parseDateHour(value: string | null) {
  if (!value) return null;
  const [date, timePart] = value.includes('T')
    ? value.split('T')
    : value.split(' ');
  if (!date || !timePart) return null;
  const time = timePart.slice(0, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return { date, minutes: timeToMinutes(time) };
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function overlaps(start: number, end: number, otherStart: number, otherEnd: number) {
  return start < otherEnd && end > otherStart;
}

function getLisbonClock() {
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const getPart = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find((part) => part.type === type)?.value ?? '00';

  return {
    date: `${getPart(dateParts, 'year')}-${getPart(dateParts, 'month')}-${getPart(dateParts, 'day')}`,
    minutes: Number(getPart(timeParts, 'hour')) * 60 + Number(getPart(timeParts, 'minute')),
    timestamp: now.getTime(),
  };
}

const AVAILABILITY_ROLES = [
  'owner',
  'admin',
  'manager',
  'barber',
  'receptionist',
  'staff',
] as const;

function hasAgendaGrant(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const permissions = value as Record<string, unknown>;
  return permissions.agenda === true || permissions.appointments === true;
}

async function authorizeAgenda(request: Request, barbershopId: string) {
  const tenant = await requireTenantAuthorization(request, AVAILABILITY_ROLES);
  if (!tenant.ok) return { ok: false as const, status: tenant.status };

  if (tenant.barbershopId !== barbershopId) {
    return { ok: false as const, status: 403 };
  }

  if (tenant.role !== 'owner' && tenant.role !== 'admin') {
    const { data: grant, error: grantError } = await tenant.admin
      .from('barbershop_member_permissions')
      .select('permissions')
      .eq('barbershop_id', tenant.barbershopId)
      .eq('user_id', tenant.userId)
      .maybeSingle();

    if (grantError) {
      console.error('[MANUAL_BOOKING_AVAILABILITY_PERMISSION_ERROR]', grantError.code ?? 'UNKNOWN');
      return { ok: false as const, status: 503 };
    }

    let allowed = grant ? hasAgendaGrant(grant.permissions) : false;
    if (!grant) {
      const legacy = await tenant.admin
        .from('staff_permissions')
        .select('allowed')
        .eq('barbershop_id', tenant.barbershopId)
        .eq('user_id', tenant.userId)
        .in('permission', ['agenda', 'appointments'])
        .eq('allowed', true)
        .limit(1)
        .maybeSingle();
      if (legacy.error) {
        console.error('[MANUAL_BOOKING_AVAILABILITY_LEGACY_PERMISSION_ERROR]', legacy.error.code ?? 'UNKNOWN');
        return { ok: false as const, status: 503 };
      }
      allowed = legacy.data?.allowed === true;
    }

    if (!allowed) return { ok: false as const, status: 403 };
  }

  return { ok: true as const, admin: tenant.admin };
}

function getAppointmentDescription(appointment: AppointmentRow, start: number) {
  const service = Array.isArray(appointment.services)
    ? appointment.services[0]
    : appointment.services;
  const user = Array.isArray(appointment.users)
    ? appointment.users[0]
    : appointment.users;
  const customerName =
    appointment.manual_name?.trim() || user?.name_complete?.trim() || 'Cliente';
  const serviceName = service?.name?.trim();
  const statusLabel =
    appointment.status === 'pending' ? 'Pendente' : 'Confirmada';

  return [
    `${minutesToTime(start)}`,
    customerName,
    serviceName,
    statusLabel,
  ].filter(Boolean).join(' · ');
}

async function GET__unobserved(
  request: Request,
  { params }: { params: Promise<{ barbershopId: string }> },
) {
  try {
    const { barbershopId } = await params;
    if (!UUID_PATTERN.test(barbershopId)) {
      return NextResponse.json(
        { error: 'Identificador inválido.' },
        { status: 400 },
      );
    }

    const access = await authorizeAgenda(request, barbershopId);
    if (!access.ok) {
      return NextResponse.json(
        { error: 'Não tem permissão para consultar a disponibilidade da agenda.' },
        { status: access.status },
      );
    }
    const admin = access.admin;

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate') ?? '';
    const selectedDate = searchParams.get('selectedDate') ?? fromDate;
    const serviceId = searchParams.get('serviceId') ?? '';
    const professionalId = searchParams.get('professionalId') ?? '';

    if (
      !isValidDate(fromDate) ||
      !isValidDate(selectedDate) ||
      !UUID_PATTERN.test(serviceId) ||
      !UUID_PATTERN.test(professionalId)
    ) {
      return NextResponse.json(
        { error: 'Escolhe um serviço, barbeiro e data válidos.' },
        { status: 400 },
      );
    }

    const dates = Array.from({ length: 14 }, (_, index) =>
      addDaysToDate(fromDate, index),
    );
    if (!dates.includes(selectedDate)) {
      return NextResponse.json(
        { error: 'A data selecionada está fora do período disponível.' },
        { status: 400 },
      );
    }
    const lastDate = dates[dates.length - 1];

    const [
      barbershopResult,
      serviceResult,
      professionalResult,
      blocksResult,
      appointmentsResult,
    ] = await Promise.all([
      admin
        .from('barbershops')
        .select('weekly_schedule, opening_time, closing_time, lunch_start, lunch_end, closed_days')
        .eq('id', barbershopId)
        .maybeSingle(),
      admin
        .from('services')
        .select('id, duration, buffer_minutes')
        .eq('id', serviceId)
        .eq('barbershop_id', barbershopId)
        .eq('is_active', true)
        .maybeSingle(),
      admin
        .from('professionals')
        .select('id, name, active, weekly_schedule')
        .eq('id', professionalId)
        .eq('barbershop_id', barbershopId)
        .eq('active', true)
        .maybeSingle(),
      admin
        .from('schedule_blocks')
        .select('id, professional_id, date, start_time, end_time, reason')
        .eq('barbershop_id', barbershopId)
        .gte('date', fromDate)
        .lte('date', lastDate)
        .order('start_time', { ascending: true }),
      admin
        .from('appointments')
        .select('date_hour, duration_minutes, buffer_minutes, professional_id, status, payment_status, payment_expires_at, manual_name, services(name,duration,buffer_minutes), users(name_complete)')
        .eq('barbershop_id', barbershopId)
        .gte('date_hour', `${fromDate}T00:00:00`)
        .lte('date_hour', `${lastDate}T23:59:59`)
        .in('status', ['pending', 'scheduled']),
    ]);

    if (barbershopResult.error || !barbershopResult.data) {
      console.error('[MANUAL_BOOKING_AVAILABILITY_BARBERSHOP_ERROR]', barbershopResult.error?.code ?? 'NOT_FOUND');
      return NextResponse.json(
        { error: 'Não foi possível carregar o horário da barbearia.' },
        { status: 503 },
      );
    }
    if (serviceResult.error || !serviceResult.data) {
      return NextResponse.json(
        { error: 'O serviço selecionado já não está disponível.' },
        { status: 404 },
      );
    }
    if (professionalResult.error || !professionalResult.data) {
      return NextResponse.json(
        { error: 'O barbeiro selecionado já não está disponível.' },
        { status: 404 },
      );
    }
    if (blocksResult.error && blocksResult.error.code !== '42P01') {
      console.error('[MANUAL_BOOKING_AVAILABILITY_BLOCKS_ERROR]', blocksResult.error.code ?? 'UNKNOWN');
      return NextResponse.json(
        { error: 'Não foi possível carregar os bloqueios da agenda.' },
        { status: 503 },
      );
    }
    if (appointmentsResult.error) {
      console.error('[MANUAL_BOOKING_AVAILABILITY_APPOINTMENTS_ERROR]', appointmentsResult.error.code ?? 'UNKNOWN');
      return NextResponse.json(
        { error: 'Não foi possível confirmar as marcações existentes.' },
        { status: 503 },
      );
    }

    const barbershopSchedule = normalizeWeeklySchedule(
      barbershopResult.data.weekly_schedule,
      barbershopResult.data as LegacyScheduleInput,
    );
    const professional = professionalResult.data;
    const professionalSchedule: WeeklySchedule = professional.weekly_schedule
      ? normalizeWeeklySchedule(professional.weekly_schedule)
      : barbershopSchedule;
    const serviceDuration = Math.min(
      Math.max(Math.round(Number(serviceResult.data.duration ?? 30) || 30), 1),
      1440,
    );
    const serviceBuffer = Math.min(
      Math.max(Math.round(Number(serviceResult.data.buffer_minutes ?? 0) || 0), 0),
      120,
    );
    const reservedDuration = serviceDuration + serviceBuffer;
    const clock = getLisbonClock();
    const blocks = (blocksResult.data ?? []) as ScheduleBlockRow[];
    const activeAppointments = ((appointmentsResult.data ?? []) as AppointmentRow[])
      .filter(
        (appointment) =>
          !(
            appointment.payment_status === 'awaiting_review' &&
            appointment.payment_expires_at &&
            new Date(appointment.payment_expires_at).getTime() <= clock.timestamp
          ),
      );

    const getSlotsForDate = (date: string): {
      dayOff: boolean;
      workingIntervals: Array<{ start: string; end: string }>;
      breakIntervals: Array<{ start: string; end: string }>;
      slots: AvailabilitySlot[];
    } => {
      const weekday = new Date(`${date}T12:00:00`).getDay();
      const daySchedule = getDailySchedule(professionalSchedule, weekday);
      const dayOff = daySchedule.day_off || daySchedule.work_intervals.length === 0;
      if (dayOff) {
        return {
          dayOff: true,
          workingIntervals: daySchedule.work_intervals,
          breakIntervals: daySchedule.break_intervals,
          slots: [],
        };
      }

      const dayBlocks = blocks.filter(
        (block) =>
          block.date === date &&
          (!block.professional_id || block.professional_id === professionalId),
      );
      const dayAppointments = activeAppointments
        .map((appointment) => {
          const parsed = parseDateHour(appointment.date_hour);
          if (!parsed || parsed.date !== date) return null;
          return {
            appointment,
            start: parsed.minutes,
            end: parsed.minutes + getReservedAppointmentMinutes(appointment),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const slots: AvailabilitySlot[] = [];
      for (const interval of daySchedule.work_intervals) {
        const intervalStart = timeToMinutes(interval.start);
        const intervalEnd = timeToMinutes(interval.end);
        for (
          let slotStart = intervalStart;
          slotStart + reservedDuration <= intervalEnd;
          slotStart += 30
        ) {
          const slotEnd = slotStart + reservedDuration;
          if (!isSlotWithinDailySchedule(daySchedule, slotStart, slotEnd)) {
            const overlappingBreak = daySchedule.break_intervals.find((pause) =>
              overlaps(
                slotStart,
                slotEnd,
                timeToMinutes(pause.start),
                timeToMinutes(pause.end),
              ),
            );
            if (overlappingBreak) {
              slots.push({
                time: minutesToTime(slotStart),
                endTime: minutesToTime(slotEnd),
                status: 'break',
                detail: `${overlappingBreak.start}–${overlappingBreak.end}`,
              });
            }
            continue;
          }

          const collidingAppointments = dayAppointments.filter(
            (item) =>
              appointmentsShareProfessionalCapacity(
                professionalId,
                item.appointment.professional_id,
              ) && overlaps(slotStart, slotEnd, item.start, item.end),
          );
          if (collidingAppointments.length > 0) {
            slots.push({
              time: minutesToTime(slotStart),
              endTime: minutesToTime(slotEnd),
              status: 'booked',
              detail: collidingAppointments
                .slice(0, 2)
                .map((item) => getAppointmentDescription(item.appointment, item.start))
                .join(' / '),
            });
            continue;
          }

          const collidingBlock = dayBlocks.find((block) => {
            if (!block.start_time || !block.end_time) return true;
            return overlaps(
              slotStart,
              slotEnd,
              timeToMinutes(block.start_time.slice(0, 5)),
              timeToMinutes(block.end_time.slice(0, 5)),
            );
          });
          if (collidingBlock) {
            slots.push({
              time: minutesToTime(slotStart),
              endTime: minutesToTime(slotEnd),
              status: 'blocked',
              detail: collidingBlock.reason?.trim() || 'Horário bloqueado',
            });
            continue;
          }

          if (date === clock.date && slotStart <= clock.minutes) {
            slots.push({
              time: minutesToTime(slotStart),
              endTime: minutesToTime(slotEnd),
              status: 'past',
              detail: null,
            });
            continue;
          }

          slots.push({
            time: minutesToTime(slotStart),
            endTime: minutesToTime(slotEnd),
            status: 'available',
            detail: null,
          });
        }
      }

      return {
        dayOff: false,
        workingIntervals: daySchedule.work_intervals,
        breakIntervals: daySchedule.break_intervals,
        slots,
      };
    };

    const days = dates.map((date) => {
      const result = getSlotsForDate(date);
      return {
        date,
        available: result.slots.some((slot) => slot.status === 'available'),
        closedDay: result.dayOff,
        availableCount: result.slots.filter((slot) => slot.status === 'available').length,
        bookedCount: result.slots.filter((slot) => slot.status === 'booked').length,
        blockedCount: result.slots.filter((slot) => slot.status === 'blocked').length,
      };
    });
    const selectedDay = getSlotsForDate(selectedDate);

    return NextResponse.json(
      {
        selectedDate,
        days,
        slots: selectedDay.slots,
        dayOff: selectedDay.dayOff,
        workingIntervals: selectedDay.workingIntervals,
        breakIntervals: selectedDay.breakIntervals,
        serviceDuration,
        serviceBuffer,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[MANUAL_BOOKING_AVAILABILITY_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { error: 'Não foi possível carregar a disponibilidade. Tenta novamente.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability(
  '/api/barbershops/[barbershopId]/booking-availability',
  GET__unobserved,
);
