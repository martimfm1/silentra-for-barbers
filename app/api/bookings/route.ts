import { withApiLogging } from '@/lib/observability/api-request';
import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendBookingConfirmationEmail } from '@/lib/brevo/brevo';
import { dispatchAppointmentAutomations } from '@/lib/automations/dispatch-appointment';
import { findPublicBookingCustomer } from '@/lib/bookings/public-customer-profile';
import {
  isRecord,
  isSafePublicBookingDate,
  isValidTime,
  normalizeText,
  UUID_PATTERN,
} from '@/lib/validation';

type BookingRequestBody = {
  shopId?: unknown;
  service?: unknown;
  date?: unknown;
  slot?: unknown;
  professionalId?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
  customerEmail?: unknown;
  customerBirthDate?: unknown;
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PUBLIC_BOOKING_RATE_LIMIT = 20;
const PUBLIC_BOOKING_RATE_WINDOW_SECONDS = 10 * 60;
function isValidBirthDate(value: string): boolean {
  if (!BIRTH_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  if (parsed > new Date()) return false;
  return parsed.getFullYear() >= 1900;
}
function timeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}
function overlaps(
  start: number,
  end: number,
  otherStart: number,
  otherEnd: number,
): boolean {
  return start < otherEnd && end > otherStart;
}
function parseClosedDays(value: unknown): Set<number> {
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
  const values =
    typeof value === 'string'
      ? value.split(',').map((item) => item.trim().toLowerCase())
      : [];
  const result = new Set<number>();
  for (const item of values)
    if (names[item] !== undefined) result.add(names[item]);
  return result;
}
function getClientIp(request: Request): string {
  const forwarded = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  const real = request.headers.get('x-real-ip')?.trim();
  return forwarded || real || 'unknown';
}
function getRateLimitKey(request: Request, shopId: string): string {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      'RATE_LIMIT_SECRET is not configured with sufficient entropy.',
    );
  return createHmac('sha256', secret)
    .update(`public-booking:${shopId}:${getClientIp(request)}`)
    .digest('hex');
}
async function enforcePublicBookingRateLimit(
  request: Request,
  shopId: string,
): Promise<boolean> {
  const key = getRateLimitKey(request, shopId);
  const admin = createAdminClient();
  const { data: allowed, error } = await admin.rpc(
    'consume_public_rate_limit',
    {
      p_key: key,
      p_limit: PUBLIC_BOOKING_RATE_LIMIT,
      p_window_seconds: PUBLIC_BOOKING_RATE_WINDOW_SECONDS,
    },
  );
  if (error) {
    console.error('[API_BOOKING_RATE_LIMIT_ERROR]', error.code ?? 'UNKNOWN');
    throw new Error('Public booking rate limiter unavailable.');
  }
  return allowed === true;
}

async function POSTHandler(request: Request) {
  try {
    const payload: unknown = await request.json();
    if (!isRecord(payload))
      return NextResponse.json(
        { success: false, error: 'Pedido inválido.' },
        { status: 400 },
      );
    const {
      shopId,
      service,
      date,
      slot,
      professionalId,
      customerName,
      customerPhone,
      customerEmail,
      customerBirthDate,
    } = payload as BookingRequestBody;
    const name = normalizeText(customerName, 120);
    const phone = normalizeText(customerPhone, 30);
    const email = normalizeText(customerEmail, 254)?.toLowerCase();
    const birthDateInput =
      typeof customerBirthDate === 'string' ? customerBirthDate.trim() : '';
    const bookingDate =
      typeof date === 'string' ? date : new Date().toISOString().slice(0, 10);
    const bookingTime = typeof slot === 'string' ? slot.slice(0, 5) : '';
    const normalizedProfessionalId =
      typeof professionalId === 'string' && professionalId
        ? professionalId
        : null;
    if (
      typeof shopId !== 'string' ||
      !UUID_PATTERN.test(shopId) ||
      typeof service !== 'string' ||
      !UUID_PATTERN.test(service) ||
      !name ||
      !phone ||
      !email ||
      !EMAIL_PATTERN.test(email) ||
      !isSafePublicBookingDate(bookingDate) ||
      !isValidTime(bookingTime) ||
      (normalizedProfessionalId && !UUID_PATTERN.test(normalizedProfessionalId))
    )
      return NextResponse.json(
        {
          success: false,
          error:
            'Confirma os dados, email, telefone e escolhe uma data e hora válidas.',
        },
        { status: 400 },
      );
    if (!(await enforcePublicBookingRateLimit(request, shopId)))
      return NextResponse.json(
        {
          success: false,
          error:
            'Demasiadas tentativas de marcação. Tenta novamente dentro de alguns minutos.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(PUBLIC_BOOKING_RATE_WINDOW_SECONDS),
          },
        },
      );
    const supabase = await createClient();
    const admin = createAdminClient();
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select(
        `barbershop_id,is_active,barbershops(name,address,opening_time,closing_time,lunch_start,lunch_end,closed_days)`,
      )
      .eq('id', shopId)
      .maybeSingle();
    if (shopError || !shop?.barbershop_id || !shop.is_active) {
      console.error('[API_BOOKING_SHOP_ERROR]', shopError?.code ?? 'UNKNOWN');
      return NextResponse.json(
        { success: false, error: 'Barbearia indisponível.' },
        { status: 404 },
      );
    }
    const barbershopId = shop.barbershop_id;

    let birthDate = '';
    let existingCustomerId: string | null = null;
    try {
      const existingCustomer = await findPublicBookingCustomer({
        barbershopId,
        email,
        phone,
      });
      existingCustomerId = existingCustomer?.id ?? null;
      if (existingCustomer?.birthDate) {
        birthDate = existingCustomer.birthDate;
      } else if (birthDateInput && isValidBirthDate(birthDateInput)) {
        birthDate = birthDateInput;
      }
    } catch (error) {
      console.error(
        '[API_BOOKING_CUSTOMER_LOOKUP_ERROR]',
        error instanceof Error ? error.name : 'UNKNOWN',
      );
      return NextResponse.json(
        {
          success: false,
          error: 'Não foi possível verificar os dados do cliente.',
        },
        { status: 503 },
      );
    }

    if (!birthDate || !isValidBirthDate(birthDate))
      return NextResponse.json(
        {
          success: false,
          error:
            'Precisamos da tua data de nascimento para concluir a marcação.',
        },
        { status: 400 },
      );

    if (existingCustomerId && !birthDateInput) {
      // The client already has a birth date stored in the barbershop profile.
      // No need to expose that value back to the browser.
    } else if (existingCustomerId && birthDateInput) {
      const { error: birthDateUpdateError } = await admin
        .from('users')
        .update({ birth_date: birthDate })
        .eq('id', existingCustomerId)
        .eq('barbershop_id', barbershopId)
        .eq('role', 'client')
        .is('birth_date', null);
      if (birthDateUpdateError) {
        console.error(
          '[API_BOOKING_CUSTOMER_BIRTHDATE_UPDATE_ERROR]',
          birthDateUpdateError.code ?? 'UNKNOWN',
        );
      }
    }

    const shopRelation = Array.isArray(shop.barbershops)
      ? shop.barbershops[0]
      : shop.barbershops;
    const barbershopName = shopRelation?.name || 'Barbearia';
    const barbershopAddress = shopRelation?.address || 'Endereço sob consulta';
    const selectedWeekday = new Date(`${bookingDate}T12:00:00`).getDay();
    const closedDays = parseClosedDays(shopRelation?.closed_days);
    if (closedDays.has(selectedWeekday))
      return NextResponse.json(
        {
          success: false,
          error: 'A barbearia está fechada neste dia. Escolhe outro dia.',
        },
        { status: 409 },
      );
    const openTime = shopRelation?.opening_time || '09:00';
    const closeTime = shopRelation?.closing_time || '19:00';
    const lunchStart = shopRelation?.lunch_start
      ? timeToMinutes(shopRelation.lunch_start)
      : null;
    const lunchEnd = shopRelation?.lunch_end
      ? timeToMinutes(shopRelation.lunch_end)
      : null;
    const requestedStart = timeToMinutes(bookingTime);
    const { data: selectedService, error: serviceError } = await supabase
      .from('services')
      .select('id,name,duration')
      .eq('id', service)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();
    if (serviceError || !selectedService)
      return NextResponse.json(
        { success: false, error: 'Serviço indisponível para esta barbearia.' },
        { status: 400 },
      );
    const durationMinutes = Math.min(
      Math.max(Number(selectedService.duration ?? 30), 1),
      1440,
    );
    const requestedEnd = requestedStart + durationMinutes;
    if (
      requestedStart < timeToMinutes(openTime) ||
      requestedStart >= timeToMinutes(closeTime)
    )
      return NextResponse.json(
        {
          success: false,
          error: 'Este horário está fora do horário de funcionamento.',
        },
        { status: 409 },
      );
    if (requestedEnd > timeToMinutes(closeTime))
      return NextResponse.json(
        {
          success: false,
          error: 'O serviço ultrapassa o horário de funcionamento.',
        },
        { status: 409 },
      );
    if (
      lunchStart !== null &&
      lunchEnd !== null &&
      overlaps(requestedStart, requestedEnd, lunchStart, lunchEnd)
    )
      return NextResponse.json(
        {
          success: false,
          error: 'Este horário coincide com a pausa da barbearia.',
        },
        { status: 409 },
      );
    const { data: blocks, error: blocksError } = await supabase
      .from('schedule_blocks')
      .select('professional_id,start_time,end_time,reason')
      .eq('barbershop_id', barbershopId)
      .eq('date', bookingDate);
    if (blocksError && blocksError.code !== '42P01') {
      console.error(
        '[API_BOOKING_BLOCKS_ERROR]',
        blocksError.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        {
          success: false,
          error: 'Não foi possível validar os horários bloqueados.',
        },
        { status: 503 },
      );
    }
    const matchingBlock = (blocks ?? []).find((block: any) => {
      if (
        block.professional_id &&
        block.professional_id !== normalizedProfessionalId
      )
        return false;
      if (!block.start_time || !block.end_time) return true;
      return overlaps(
        requestedStart,
        requestedEnd,
        timeToMinutes(block.start_time),
        timeToMinutes(block.end_time),
      );
    });
    if (matchingBlock) {
      const interval =
        matchingBlock.start_time && matchingBlock.end_time
          ? ` (${matchingBlock.start_time.slice(0, 5)}–${matchingBlock.end_time.slice(0, 5)})`
          : ' (todo o dia)';
      return NextResponse.json(
        {
          success: false,
          error: `${matchingBlock.reason?.trim() || 'Este horário está bloqueado.'}${interval}`,
        },
        { status: 409 },
      );
    }
    const { data: appointment, error: createError } = await admin.rpc(
      'create_booking_atomic',
      {
        p_barbershop_id: barbershopId,
        p_service_id: service,
        p_professional_id: normalizedProfessionalId,
        p_date_hour: `${bookingDate}T${bookingTime}:00`,
        p_duration_minutes: durationMinutes,
        p_manual_name: name,
        p_manual_phone: phone,
        p_manual_email: email,
        p_manual_birth_date: birthDate,
        p_status: 'scheduled',
      },
    );
    if (createError || !appointment) {
      if (
        createError?.code === '23P01' ||
        createError?.code === '23505' ||
        createError?.message?.includes('BOOKING_CONFLICT')
      )
        return NextResponse.json(
          {
            success: false,
            error: 'Este horário acabou de ser reservado por outra pessoa.',
          },
          { status: 409 },
        );
      if (
        createError?.message === 'BOOKING_BARBERSHOP_CLOSED_DAY' ||
        createError?.message === 'BARBERSHOP_CLOSED_DAY'
      )
        return NextResponse.json(
          {
            success: false,
            error: 'A barbearia está fechada neste dia. Escolhe outro dia.',
          },
          { status: 409 },
        );
      if (createError?.message === 'BOOKING_SERVICE_NOT_AVAILABLE')
        return NextResponse.json(
          {
            success: false,
            error: 'O serviço selecionado já não está disponível.',
          },
          { status: 409 },
        );
      if (createError?.message === 'BOOKING_PROFESSIONAL_NOT_AVAILABLE')
        return NextResponse.json(
          {
            success: false,
            error: 'O profissional selecionado já não está disponível.',
          },
          { status: 409 },
        );
      console.error(
        '[API_BOOKING_ATOMIC_CREATE_ERROR]',
        createError?.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        {
          success: false,
          error: 'Não foi possível efetuar a marcação. Tenta novamente.',
        },
        { status: 500 },
      );
    }
    sendBookingConfirmationEmail({
      to: email,
      clientName: name,
      serviceName: selectedService.name || 'Serviço',
      date: bookingDate,
      time: bookingTime,
      durationMinutes,
      appointmentId: appointment.id,
      barbershopId,
      barbershopName,
      barbershopAddress,
    }).catch((err) =>
      console.error(
        '[BACKGROUND_EMAIL_ERROR]',
        err instanceof Error ? err.name : 'UNKNOWN',
      ),
    );
    void dispatchAppointmentAutomations('booking_created', {
      appointmentId: appointment.id,
      barbershopId,
      manualEmail: email,
      manualName: name,
      serviceName: selectedService.name || 'Serviço',
    });
    console.info('[API_BOOKING_SUCCESS]');
    return NextResponse.json(
      {
        success: true,
        message: 'Marcação confirmada com sucesso!',
        booking: {
          id: appointment.id,
          barbershopId: appointment.barbershop_id,
          serviceId: appointment.service_id,
          dateHour: appointment.date_hour,
          status: appointment.status,
        },
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[API_BOOKING_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { success: false, error: 'Erro interno no servidor. Tenta novamente.' },
      { status: 500 },
    );
  }
}


export const POST = withApiLogging('/api/bookings', POSTHandler);
