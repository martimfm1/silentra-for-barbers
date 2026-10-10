import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidDate, UUID_PATTERN } from '@/lib/validation';

type AppointmentRow = {
  date_hour: string | null;
  duration_minutes: number | null;
  professional_id: string | null;
  status: string | null;
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
function normalizeClosedDays(value: unknown): Set<number> {
  const names: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    domingo: 0,
    segunda: 1,
    terça: 2,
    terca: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sábado: 6,
    sabado: 6,
  };
  const result = new Set<number>();
  const values =
    typeof value === 'string'
      ? value.split(',').map((item) => item.trim().toLowerCase())
      : Array.isArray(value)
        ? value
        : [];
  for (const item of values) {
    if (typeof item === 'number' && item >= 0 && item <= 6) result.add(item);
    if (typeof item === 'string' && names[item] !== undefined)
      result.add(names[item]);
  }
  return result;
}

async function GETHandler(
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

    const supabase = await createClient();
    const admin = createAdminClient();
    const { data: shopRecord, error: shopError } = await admin
      .from('shops')
      .select(
        `id, barbershop_id, barbershops (opening_time, closing_time, lunch_start, lunch_end, closed_days)`,
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

    const openTime = relation.opening_time || '09:00:00';
    const closeTime = relation.closing_time || '19:00:00';
    const lunchStart = relation.lunch_start || null;
    const lunchEnd = relation.lunch_end || null;
    const closedDays = normalizeClosedDays(relation.closed_days);
    const selectedWeekday = new Date(`${date}T12:00:00`).getDay();
    const isClosedDay = closedDays.has(selectedWeekday);

    const servicesResult = await admin
      .from('services')
      .select('*')
      .eq('barbershop_id', barbershopId);
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
        .eq('shop_id', shopId);
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
    const professionalsResult = await admin
      .from('professionals')
      .select('id, name, active')
      .eq('barbershop_id', barbershopId)
      .eq('active', true)
      .order('name', { ascending: true });
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
    }));
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

    const { data: blockRows, error: blocksError } = await admin
      .from('schedule_blocks')
      .select('id, professional_id, date, start_time, end_time, reason')
      .eq('barbershop_id', barbershopId)
      .eq('date', date)
      .order('start_time', { ascending: true });
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

    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;
    const { data: appointments, error: appointmentsError } = await admin
      .from('appointments')
      .select('date_hour, duration_minutes, professional_id, status')
      .eq('barbershop_id', barbershopId)
      .gte('date_hour', dayStart)
      .lte('date_hour', dayEnd)
      .in('status', ['pending', 'scheduled']);
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
    const lunchStartMinutes = lunchStart ? timeToMinutes(lunchStart) : null;
    const lunchEndMinutes = lunchEnd ? timeToMinutes(lunchEnd) : null;
    const selectedService = serviceId
      ? services.find((service) => service.id === serviceId)
      : services[0];
    const serviceDuration = Math.min(
      Math.max(Number(selectedService?.durationMinutes ?? 30), 1),
      1440,
    );
    const appointmentIntervals = ((appointments ?? []) as AppointmentRow[])
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
    const availableSlots: string[] = [];
    const professionalAvailability: Record<string, string[]> =
      Object.fromEntries(
        professionals.map((professional) => [professional.id, []]),
      );
    const openTotalMinutes = timeToMinutes(openTime);
    const closeTotalMinutes = timeToMinutes(closeTime);
    for (
      let slotStart = openTotalMinutes;
      slotStart < closeTotalMinutes;
      slotStart += 30
    ) {
      const slotEnd = slotStart + serviceDuration;
      if (
        slotEnd > closeTotalMinutes ||
        (isToday && slotStart <= currentMinutesNow) ||
        isClosedDay
      )
        continue;
      if (
        lunchStartMinutes !== null &&
        lunchEndMinutes !== null &&
        overlaps(slotStart, slotEnd, lunchStartMinutes, lunchEndMinutes)
      )
        continue;
      const availableForProfessionals = professionals.filter((professional) =>
        canProfessionalTakeSlot(slotStart, slotEnd, professional.id),
      );
      for (const professional of availableForProfessionals)
        professionalAvailability[professional.id].push(
          minutesToTime(slotStart),
        );
      if (requestedProfessionalId) {
        if (
          availableForProfessionals.some(
            (professional) => professional.id === requestedProfessionalId,
          )
        )
          availableSlots.push(minutesToTime(slotStart));
      } else if (availableForProfessionals.length > 0) {
        availableSlots.push(minutesToTime(slotStart));
      }
    }

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
        services,
        professionals,
        availableSlots,
        professionalAvailability,
        isClosed,
        closedDay: isClosedDay,
        blockedIntervals: visibleBlockedIntervals,
        selectedProfessionalId: requestedProfessionalId,
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


export const GET = withApiLogging('/api/shops/[id]/booking-data', GETHandler);
