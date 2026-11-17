import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';

const ROLES = [
  'owner',
  'admin',
  'manager',
  'barber',
  'receptionist',
  'staff',
] as const;

async function GET__unobserved(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { appointmentId } = await context.params;
    const tenant = await requireTenantAuthorization(request, ROLES);
    if (!tenant.ok) {
      return NextResponse.json(
        { success: false, error: 'Sem autorização para consultar o histórico.' },
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
        return NextResponse.json(
          { success: false, error: 'Não foi possível validar as permissões.' },
          { status: 503 },
        );
      }

      const permissions =
        grant?.permissions && typeof grant.permissions === 'object'
          ? (grant.permissions as Record<string, unknown>)
          : {};
      let allowed =
        permissions.agenda === true || permissions.appointments === true;

      if (!grant) {
        const { data: legacy, error } = await tenant.admin
          .from('staff_permissions')
          .select('allowed')
          .eq('barbershop_id', tenant.barbershopId)
          .eq('user_id', tenant.userId)
          .in('permission', ['agenda', 'appointments'])
          .eq('allowed', true)
          .limit(1)
          .maybeSingle();

        if (error) {
          return NextResponse.json(
            { success: false, error: 'Não foi possível validar as permissões.' },
            { status: 503 },
          );
        }
        allowed = legacy?.allowed === true;
      }

      if (!allowed) {
        return NextResponse.json(
          { success: false, error: 'Sem permissão para consultar o histórico da agenda.' },
          { status: 403 },
        );
      }
    }

    const { data: appointment, error: appointmentError } = await tenant.admin
      .from('appointments')
      .select('id')
      .eq('id', appointmentId)
      .eq('barbershop_id', tenant.barbershopId)
      .maybeSingle();

    if (appointmentError) {
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

    const { data: events, error: historyError } = await tenant.admin
      .from('audit_logs')
      .select('id,action,metadata,created_at')
      .eq('entity_type', 'appointment')
      .eq('entity_id', appointmentId)
      .contains('metadata', { barbershop_id: tenant.barbershopId })
      .order('created_at', { ascending: false })
      .limit(30);

    if (historyError) {
      console.error('[APPOINTMENT_HISTORY_READ_ERROR]', historyError.code ?? 'UNKNOWN');
      return NextResponse.json(
        { success: false, error: 'Não foi possível carregar o histórico.' },
        { status: 503 },
      );
    }

    const actorIds = [...new Set(
      (events ?? [])
        .map((event) => {
          const metadata =
            event.metadata && typeof event.metadata === 'object'
              ? (event.metadata as Record<string, unknown>)
              : {};
          return typeof metadata.actor_user_id === 'string'
            ? metadata.actor_user_id
            : null;
        })
        .filter((id): id is string => Boolean(id)),
    )];
    const actorNames = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: actors } = await tenant.admin
        .from('users')
        .select('id,name_complete')
        .eq('barbershop_id', tenant.barbershopId)
        .in('id', actorIds);
      for (const actor of actors ?? []) {
        if (actor.name_complete) actorNames.set(actor.id, actor.name_complete);
      }
    }

    const safeEvents = (events ?? []).map((event) => {
      const metadata =
        event.metadata && typeof event.metadata === 'object'
          ? (event.metadata as Record<string, unknown>)
          : {};
      const actorUserId =
        typeof metadata.actor_user_id === 'string'
          ? metadata.actor_user_id
          : null;
      return {
        id: event.id,
        action: event.action,
        createdAt: event.created_at,
        actorType: typeof metadata.actor_type === 'string' ? metadata.actor_type : 'system',
        actorName:
          (typeof metadata.actor_name === 'string' ? metadata.actor_name : null) ??
          (actorUserId ? actorNames.get(actorUserId) ?? null : null),
        fromStatus: typeof metadata.from_status === 'string' ? metadata.from_status : null,
        toStatus: typeof metadata.to_status === 'string' ? metadata.to_status : null,
        fromDateHour: typeof metadata.from_date_hour === 'string' ? metadata.from_date_hour : null,
        toDateHour: typeof metadata.to_date_hour === 'string' ? metadata.to_date_hour : null,
        cancellationReason: typeof metadata.cancellation_reason === 'string' ? metadata.cancellation_reason : null,
      };
    });

    return NextResponse.json(
      { success: true, events: safeEvents },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error(
      '[APPOINTMENT_HISTORY_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { success: false, error: 'Erro interno ao carregar o histórico.' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability(
  '/api/appointments/[appointmentId]/history',
  GET__unobserved,
);
