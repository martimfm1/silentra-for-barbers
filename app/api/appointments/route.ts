import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { isValidDate, UUID_PATTERN } from '@/lib/validation';
import { hasPlanFeature } from '@/lib/billing/plan-features';
import { resolveAccessPlanForUser } from '@/services/billing/plan-access.guard';
import { readJsonObject } from '@/lib/security/request-validation';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';

const APPOINTMENT_WRITE_ROLES = [
  'owner',
  'admin',
  'manager',
  'barber',
  'receptionist',
  'staff',
] as const;


const APPOINTMENT_READ_STATUSES = new Set([
  'pending',
  'scheduled',
  'completed',
  'cancelled',
]);

function getLisbonDate(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}


function getLisbonOffsetMinutes(utcInstant: Date): number {
  const value = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(utcInstant).find((part) => part.type === 'timeZoneName')?.value;
  const match = /^GMT(?:([+-])(\\d{1,2})(?::(\\d{2}))?)?$/.exec(value ?? 'GMT');
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0));
}

function getLisbonDayBounds(date: string): { start: string; endExclusive: string } {
  const [year, month, day] = date.split('-').map(Number);
  const startUtc = Date.UTC(year, month - 1, day);
  const nextDayUtc = Date.UTC(year, month - 1, day + 1);
  const startOffset = getLisbonOffsetMinutes(new Date(startUtc));
  const nextOffset = getLisbonOffsetMinutes(new Date(nextDayUtc));
  return {
    start: new Date(startUtc - startOffset * 60_000).toISOString(),
    endExclusive: new Date(nextDayUtc - nextOffset * 60_000).toISOString(),
  };
}

function hasAgendaGrant(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const permissions = value as Record<string, unknown>;
  return permissions.agenda === true || permissions.appointments === true;
}

async function GET__unobserved(request: Request) {
  try {
    const tenant = await requireTenantAuthorization(
      request,
      APPOINTMENT_WRITE_ROLES,
    );
    if (!tenant.ok) {
      return NextResponse.json(
        {
          error: tenant.status === 401
            ? 'Não autenticado.'
            : 'Sem permissão para consultar a agenda.',
        },
        { status: tenant.status },
      );
    }

    if (tenant.role !== 'owner') {
      const { data: grant, error: grantError } = await tenant.admin
        .from('barbershop_member_permissions')
        .select('permissions')
        .eq('barbershop_id', tenant.barbershopId)
        .eq('user_id', tenant.userId)
        .maybeSingle();

      if (grantError) {
        console.error('[API_APPOINTMENTS_LIST_PERMISSION_ERROR]', grantError.code ?? 'UNKNOWN');
        return NextResponse.json(
          { error: 'Não foi possível validar as permissões da agenda.' },
          { status: 503 },
        );
      }

      let allowed = false;
      if (grant) {
        allowed = hasAgendaGrant(grant.permissions);
      } else {
        const { data: legacyGrant, error: legacyError } = await tenant.admin
          .from('staff_permissions')
          .select('allowed')
          .eq('barbershop_id', tenant.barbershopId)
          .eq('user_id', tenant.userId)
          .in('permission', ['agenda', 'appointments'])
          .eq('allowed', true)
          .limit(1)
          .maybeSingle();
        if (legacyError) {
          console.error('[API_APPOINTMENTS_LIST_LEGACY_PERMISSION_ERROR]', legacyError.code ?? 'UNKNOWN');
          return NextResponse.json(
            { error: 'Não foi possível validar as permissões da agenda.' },
            { status: 503 },
          );
        }
        allowed = legacyGrant?.allowed === true;
      }

      if (!allowed) {
        return NextResponse.json(
          { error: 'Sem permissão para consultar a agenda.' },
          { status: 403 },
        );
      }
    }

    const plan = await resolveAccessPlanForUser(tenant.userId);
    if (!hasPlanFeature(plan, 'appointments')) {
      return NextResponse.json(
        { error: 'A agenda não está incluída no plano desta barbearia.' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') ?? getLisbonDate();
    const status = searchParams.get('status') ?? 'all';
    const rawLimit = Number(searchParams.get('limit') ?? 50);
    const rawOffset = Number(searchParams.get('offset') ?? 0);

    if (!isValidDate(date)) {
      return NextResponse.json(
        { error: 'Indica uma data válida no formato AAAA-MM-DD.' },
        { status: 400 },
      );
    }
    if (status !== 'all' && !APPOINTMENT_READ_STATUSES.has(status)) {
      return NextResponse.json(
        { error: 'Filtro de estado inválido.' },
        { status: 400 },
      );
    }

    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100)
      : 50;
    const offset = Number.isFinite(rawOffset)
      ? Math.min(Math.max(Math.trunc(rawOffset), 0), 100_000)
      : 0;

    const dayBounds = getLisbonDayBounds(date);
    let query = tenant.admin
      .from('appointments')
      .select(
        'id,date_hour,duration_minutes,status,manual_name,manual_phone,manual_email,client_id,professional_id,service_id,users(name_complete,num_phone,email),services(name,price,duration),professionals(name)',
        { count: 'exact' },
      )
      .eq('barbershop_id', tenant.barbershopId)
      .gte('date_hour', dayBounds.start)
      .lt('date_hour', dayBounds.endExclusive)
      .order('date_hour', { ascending: true })
      .range(offset, offset + limit - 1);

    if (status !== 'all') query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) {
      console.error('[API_APPOINTMENTS_LIST_ERROR]', error.code ?? 'UNKNOWN');
      return NextResponse.json(
        { error: 'Não foi possível carregar as marcações.' },
        { status: 503 },
      );
    }

    const appointments = (data ?? []).map((appointment) => {
      const client = Array.isArray(appointment.users)
        ? appointment.users[0]
        : appointment.users;
      const service = Array.isArray(appointment.services)
        ? appointment.services[0]
        : appointment.services;
      const professional = Array.isArray(appointment.professionals)
        ? appointment.professionals[0]
        : appointment.professionals;

      return {
        id: appointment.id,
        date_hour: appointment.date_hour,
        duration_minutes: Number(
          appointment.duration_minutes ?? service?.duration ?? 30,
        ),
        status: appointment.status,
        clientName:
          appointment.manual_name?.trim() ||
          client?.name_complete?.trim() ||
          'Cliente',
        clientPhone:
          appointment.manual_phone?.trim() ||
          client?.num_phone?.trim() ||
          null,
        clientEmail:
          appointment.manual_email?.trim().toLowerCase() ||
          client?.email?.trim().toLowerCase() ||
          null,
        clientId: appointment.client_id,
        professionalId: appointment.professional_id,
        professionalName: professional?.name ?? null,
        serviceId: appointment.service_id,
        serviceName: service?.name ?? 'Serviço',
        servicePrice: Number(service?.price ?? 0),
      };
    });

    return NextResponse.json(
      { date, status, appointments, total: count ?? 0, limit, offset },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[API_APPOINTMENTS_LIST_INTERNAL_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { error: 'Não foi possível carregar a agenda.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

async function POST__unobserved(request: Request) {
  try {
    const tenant = await requireTenantAuthorization(
      request,
      APPOINTMENT_WRITE_ROLES,
    );
    if (!tenant.ok) {
      return NextResponse.json(
        {
          error:
            tenant.status === 401
              ? 'Não autenticado.'
              : 'Sem permissão para criar marcações.',
        },
        { status: tenant.status },
      );
    }

    const bodyResult = await readJsonObject(request, {
      maxBytes: 16 * 1024,
      allowedKeys: [
        'shopId',
        'serviceId',
        'date',
        'date_hour',
        'clientName',
        'clientPhone',
        'clientEmail',
        'professionalId',
      ],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.value;

    const shopId = typeof body.shopId === 'string' ? body.shopId : '';
    const serviceId = typeof body.serviceId === 'string' ? body.serviceId : '';
    const date = typeof body.date === 'string' ? body.date : '';
    const dateHour =
      typeof body.date_hour === 'string' ? body.date_hour.trim() : '';
    const clientName =
      typeof body.clientName === 'string' ? body.clientName.trim() : 'Cliente';
    const clientPhone =
      typeof body.clientPhone === 'string' ? body.clientPhone.trim() : '';
    const clientEmail =
      typeof body.clientEmail === 'string'
        ? body.clientEmail.trim().toLowerCase()
        : '';
    const professionalId =
      typeof body.professionalId === 'string' && body.professionalId
        ? body.professionalId
        : null;

    if (
      !UUID_PATTERN.test(shopId) ||
      !UUID_PATTERN.test(serviceId) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{2}:\d{2}(:\d{2})?$/.test(dateHour)
    ) {
      return NextResponse.json(
        { error: 'Dados da marcação inválidos.' },
        { status: 400 },
      );
    }
    if (professionalId && !UUID_PATTERN.test(professionalId)) {
      return NextResponse.json(
        { error: 'Profissional inválido.' },
        { status: 400 },
      );
    }

    const { admin, barbershopId } = tenant;
    const { data: shop } = await admin
      .from('shops')
      .select('barbershop_id')
      .eq('id', shopId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();
    if (!shop)
      return NextResponse.json(
        { error: 'Barbearia não encontrada.' },
        { status: 404 },
      );

    const { data: service } = await admin
      .from('services')
      .select('id,duration')
      .eq('id', serviceId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();
    if (!service)
      return NextResponse.json(
        { error: 'Serviço não encontrado.' },
        { status: 404 },
      );

    if (professionalId) {
      const { data: professional } = await admin
        .from('professionals')
        .select('id')
        .eq('id', professionalId)
        .eq('barbershop_id', barbershopId)
        .eq('active', true)
        .maybeSingle();
      if (!professional)
        return NextResponse.json(
          { error: 'Profissional não encontrado.' },
          { status: 404 },
        );
    }

    const durationMinutes = Math.min(
      Math.max(Number(service.duration ?? 30), 1),
      1440,
    );
    const { data: appointment, error } = await admin.rpc(
      'create_booking_atomic',
      {
        p_barbershop_id: barbershopId,
        p_service_id: serviceId,
        p_professional_id: professionalId,
        p_date_hour: `${date}T${dateHour.slice(0, 5)}:00`,
        p_duration_minutes: durationMinutes,
        p_manual_name: clientName,
        p_manual_phone: clientPhone,
        p_manual_email: clientEmail || null,
        p_manual_birth_date: null,
        p_status: 'scheduled',
      },
    );

    if (error || !appointment) {
      if (
        error?.code === '23P01' ||
        error?.code === '23505' ||
        error?.message?.includes('BOOKING_CONFLICT')
      ) {
        return NextResponse.json(
          { error: 'Este horário já não está disponível.' },
          { status: 409 },
        );
      }
      console.error('[APPOINTMENT_CREATE_ERROR]', error);
      return NextResponse.json(
        { error: 'Não foi possível criar a marcação.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, appointment }, { status: 201 });
  } catch (error) {
    console.error('[APPOINTMENT_INTERNAL_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro interno ao criar a marcação.' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability('/api/appointments', GET__unobserved);
export const POST = withApiObservability('/api/appointments', POST__unobserved);
