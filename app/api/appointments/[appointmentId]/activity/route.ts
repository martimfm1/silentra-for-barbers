import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { UUID_PATTERN } from '@/lib/validation';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';
import { hasPlanFeature } from '@/lib/billing/plan-features';
import { resolveAccessPlanForUser } from '@/services/billing/plan-access.guard';

const ROLES = ['owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'] as const;

function hasAgendaGrant(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const permissions = value as Record<string, unknown>;
  return permissions.agenda === true || permissions.appointments === true;
}

type ActivityRow = {
  id: string;
  action: string;
  actor_type: string | null;
  actor_name: string | null;
  actor_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

async function GET__unobserved(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { appointmentId } = await context.params;
    if (!UUID_PATTERN.test(appointmentId)) {
      return NextResponse.json({ success: false, error: 'Identificador de marcação inválido.' }, { status: 400 });
    }

    const tenant = await requireTenantAuthorization(request, ROLES);
    if (!tenant.ok) {
      return NextResponse.json(
        { success: false, error: 'Sem autorização para consultar a atividade desta marcação.' },
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
        return NextResponse.json({ success: false, error: 'Não foi possível validar as permissões.' }, { status: 503 });
      }

      let allowed = grant ? hasAgendaGrant(grant.permissions) : false;
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
          return NextResponse.json({ success: false, error: 'Não foi possível validar as permissões.' }, { status: 503 });
        }
        allowed = legacy?.allowed === true;
      }
      if (!allowed) {
        return NextResponse.json({ success: false, error: 'Sem permissão para consultar a atividade.' }, { status: 403 });
      }
    }

    const plan = await resolveAccessPlanForUser(tenant.userId);
    if (!hasPlanFeature(plan, 'appointments')) {
      return NextResponse.json({ success: false, error: 'A agenda não está incluída no plano.' }, { status: 403 });
    }

    const { data: appointment, error: appointmentError } = await tenant.admin
      .from('appointments')
      .select('id')
      .eq('id', appointmentId)
      .eq('barbershop_id', tenant.barbershopId)
      .maybeSingle();
    if (appointmentError) {
      return NextResponse.json({ success: false, error: 'Não foi possível consultar a marcação.' }, { status: 503 });
    }
    if (!appointment) {
      return NextResponse.json({ success: false, error: 'Marcação não encontrada.' }, { status: 404 });
    }

    const { data, error } = await tenant.admin
      .from('audit_logs')
      .select('id,action,actor_type,actor_name,actor_id,created_at,metadata')
      .eq('barbershop_id', tenant.barbershopId)
      .eq('entity_type', 'appointment')
      .eq('entity_id', appointmentId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(100);

    if (error) {
      console.error('[APPOINTMENT_ACTIVITY_READ_FAILED]', error.code ?? 'UNKNOWN');
      return NextResponse.json({ success: false, error: 'Não foi possível carregar o histórico.' }, { status: 503 });
    }

    const rows = (data ?? []) as ActivityRow[];
    const actorIds = [...new Set(rows
      .filter((row) => !row.actor_name && row.actor_id)
      .map((row) => row.actor_id as string))];
    const actorNames = new Map<string, string>();
    if (actorIds.length) {
      const { data: users } = await tenant.admin
        .from('users')
        .select('id,name_complete')
        .eq('barbershop_id', tenant.barbershopId)
        .in('id', actorIds);
      for (const user of users ?? []) {
        if (typeof user.name_complete === 'string' && user.name_complete.trim()) {
          actorNames.set(user.id, user.name_complete.trim().slice(0, 120));
        }
      }
    }

    const events = rows.map((row) => {
      const metadata = row.metadata ?? {};
      const safeMetadata: Record<string, unknown> = {};
      for (const key of ['from', 'to', 'previousStatus', 'newStatus', 'notificationSent', 'notificationSkipped', 'notificationRetryCount', 'notificationLastAttemptAt', 'notificationRetryFailed', 'notificationRetryStartedAt', 'barberEmailsSent', 'barberPushSent', 'reason']) {
        if (metadata[key] !== undefined) safeMetadata[key] = metadata[key];
      }
      if (typeof metadata.notificationRetryInProgress === 'boolean') {
        const retryLeaseUntil = typeof metadata.notificationRetryLeaseUntil === 'string'
          ? Date.parse(metadata.notificationRetryLeaseUntil)
          : Number.NaN;
        safeMetadata.notificationRetryInProgress =
          metadata.notificationRetryInProgress &&
          Number.isFinite(retryLeaseUntil) &&
          retryLeaseUntil > Date.now();
      }
      return {
        id: row.id,
        action: row.action,
        actorType: row.actor_type || 'system',
        actorName: row.actor_name || (row.actor_id ? actorNames.get(row.actor_id) : null) ||
          (row.actor_type === 'customer' ? 'Cliente' : row.actor_type === 'staff' ? 'Equipa da barbearia' : 'Sistema'),
        createdAt: row.created_at,
        metadata: safeMetadata,
      };
    });

    return NextResponse.json(
      { success: true, events },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[APPOINTMENT_ACTIVITY_ERROR]', error instanceof Error ? error.name : 'UNKNOWN');
    return NextResponse.json({ success: false, error: 'Erro interno ao carregar a atividade.' }, { status: 500 });
  }
}

export const GET = withApiObservability(
  '/api/appointments/[appointmentId]/activity',
  GET__unobserved,
);
