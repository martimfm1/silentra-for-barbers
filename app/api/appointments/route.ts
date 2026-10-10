import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { isRecord, UUID_PATTERN } from '@/lib/validation';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';

const APPOINTMENT_WRITE_ROLES = [
  'owner',
  'admin',
  'manager',
  'barber',
  'receptionist',
  'staff',
] as const;

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

    const body: unknown = await request.json();
    if (!isRecord(body))
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });

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

export const POST = withApiObservability('/api/appointments', POST__unobserved);
