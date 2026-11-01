import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { UUID_PATTERN } from '@/lib/validation';
import { readJsonObject } from '@/lib/security/request-validation';
import {
  requireModuleContext,
  moduleErrorResponse,
} from '@/services/modules/authorization';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ clientId: string }> };
type AdminClient = Awaited<ReturnType<typeof requireModuleContext>>['admin'];
type PlanStatus = 'active' | 'paused' | 'cancelled';
type PaymentMethod = 'cash' | 'mbway' | 'transfer' | 'card' | 'other';

function parseDateOnly(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

function dateAtUtc(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addMonthsClamped(date: Date, months: number): Date {
  const firstOfTarget = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + months,
    1,
  ));
  const lastDay = new Date(Date.UTC(
    firstOfTarget.getUTCFullYear(),
    firstOfTarget.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  return new Date(Date.UTC(
    firstOfTarget.getUTCFullYear(),
    firstOfTarget.getUTCMonth(),
    Math.min(date.getUTCDate(), lastDay),
  ));
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function currentBillingPeriod(startDate: string, now: Date) {
  const anchor = dateAtUtc(startDate);
  const today = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));

  if (today < anchor) {
    return {
      start: anchor,
      end: addMonthsClamped(anchor, 1),
      started: false,
    };
  }

  let monthOffset =
    (today.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    today.getUTCMonth() - anchor.getUTCMonth();
  let start = addMonthsClamped(anchor, monthOffset);
  if (start > today) {
    monthOffset -= 1;
    start = addMonthsClamped(anchor, monthOffset);
  }

  return {
    start,
    end: addMonthsClamped(anchor, monthOffset + 1),
    started: true,
  };
}

function validServiceIds(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) return null;
  if (!value.every((item) => typeof item === 'string' && UUID_PATTERN.test(item))) {
    return null;
  }
  return [...new Set(value)];
}

function validPaymentMethod(value: unknown): PaymentMethod | null {
  return value === 'cash' ||
    value === 'mbway' ||
    value === 'transfer' ||
    value === 'card' ||
    value === 'other'
    ? value
    : null;
}

async function validateClient(admin: AdminClient, clientId: string, barbershopId: string) {
  const { data, error } = await admin
    .from('users')
    .select('id')
    .eq('id', clientId)
    .eq('barbershop_id', barbershopId)
    .eq('role', 'client')
    .maybeSingle();

  return { valid: Boolean(data) && !error, error };
}

async function validateServices(
  admin: any,
  serviceIds: string[],
  barbershopId: string,
) {
  if (serviceIds.length === 0) return true;
  const { data, error } = await admin
    .from('services')
    .select('id')
    .eq('barbershop_id', barbershopId)
    .in('id', serviceIds);
  return !error && (data?.length ?? 0) === serviceIds.length;
}

function parsePlanFields(value: Record<string, unknown>) {
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const monthlyPrice = Number(value.monthly_price);
  const includedAppointments = Number(value.included_appointments);
  const startDate = parseDateOnly(value.start_date);
  const serviceIds = validServiceIds(value.service_ids);
  const notes = typeof value.notes === 'string' ? value.notes.trim() : '';

  if (!name || name.length > 100) {
    return { error: 'O nome do plano tem de conter entre 1 e 100 caracteres.' } as const;
  }
  if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0 || monthlyPrice > 99999) {
    return { error: 'Indica uma mensalidade válida.' } as const;
  }
  if (!Number.isInteger(includedAppointments) || includedAppointments < 1 || includedAppointments > 100) {
    return { error: 'Indica uma quantidade de utilizações entre 1 e 100.' } as const;
  }
  if (!startDate) {
    return { error: 'Indica uma data de início válida.' } as const;
  }
  if (!serviceIds) {
    return { error: 'A seleção de serviços não é válida.' } as const;
  }
  if (notes.length > 2000) {
    return { error: 'As notas não podem ultrapassar 2000 caracteres.' } as const;
  }

  return {
    value: {
      name,
      monthly_price: Math.round(monthlyPrice * 100) / 100,
      included_appointments: includedAppointments,
      service_ids: serviceIds,
      start_date: startDate,
      notes: notes || null,
    },
  } as const;
}

async function GET__unobserved(req: Request, { params }: Params) {
  try {
    const tenant = await requireModuleContext('clients', 'clients', req);
    const { clientId } = await params;
    if (!UUID_PATTERN.test(clientId)) {
      return NextResponse.json({ error: 'Identificador de cliente inválido.' }, { status: 400 });
    }

    const [{ valid: clientValid }, { data: plans, error: plansError }, { data: services, error: servicesError }] =
      await Promise.all([
        validateClient(tenant.admin, clientId, tenant.barbershopId),
        tenant.admin
          .from('client_plans')
          .select('id, name, monthly_price, included_appointments, service_ids, start_date, status, notes, created_at, updated_at')
          .eq('barbershop_id', tenant.barbershopId)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(20),
        tenant.admin
          .from('services')
          .select('id, name')
          .eq('barbershop_id', tenant.barbershopId)
          .order('name', { ascending: true }),
      ]);

    if (!clientValid) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
    }
    if (plansError || servicesError) {
      console.error('[CRM_CLIENT_PLANS_LOAD_ERROR]', plansError?.code ?? servicesError?.code ?? 'UNKNOWN');
      return NextResponse.json({ error: 'Não foi possível carregar os planos do cliente.' }, { status: 503 });
    }

    const activePlan = (plans ?? []).find((plan) => plan.status === 'active');
    let enrichedPlans = (plans ?? []).map((plan) => ({
      ...plan,
      used_appointments: null as number | null,
      remaining_appointments: null as number | null,
      period_start: null as string | null,
      period_end: null as string | null,
      current_payment: null as Record<string, unknown> | null,
      payment_history: [] as Record<string, unknown>[],
    }));

    if (activePlan) {
      const period = currentBillingPeriod(activePlan.start_date, new Date());
      const periodStart = toDateOnly(period.start);
      const periodEnd = toDateOnly(period.end);
      let usageData: Array<{ service_id: string | null }> = [];
      if (period.started) {
        const usageResult = await tenant.admin
          .from('appointments')
          .select('id, service_id')
          .eq('barbershop_id', tenant.barbershopId)
          .eq('client_id', clientId)
          .eq('status', 'completed')
          .gte('date_hour', `${periodStart}T00:00:00.000Z`)
          .lt('date_hour', `${periodEnd}T00:00:00.000Z`);
        if (usageResult.error) {
          console.error('[CRM_CLIENT_PLANS_USAGE_ERROR]', usageResult.error.code ?? 'UNKNOWN');
          return NextResponse.json({ error: 'Não foi possível carregar a utilização do plano.' }, { status: 503 });
        }
        usageData = (usageResult.data ?? []) as Array<{ service_id: string | null }>;
      }

      const [paymentResult, paymentHistoryResult] = await Promise.all([
        tenant.admin
          .from('client_plan_payments')
          .select('id, period_start, period_end, amount, status, payment_method, paid_at')
          .eq('barbershop_id', tenant.barbershopId)
          .eq('client_id', clientId)
          .eq('plan_id', activePlan.id)
          .eq('period_start', periodStart)
          .maybeSingle(),
        tenant.admin
          .from('client_plan_payments')
          .select('id, period_start, period_end, amount, status, payment_method, paid_at')
          .eq('barbershop_id', tenant.barbershopId)
          .eq('client_id', clientId)
          .eq('plan_id', activePlan.id)
          .order('period_start', { ascending: false })
          .limit(6),
      ]);

      if (paymentResult.error || paymentHistoryResult.error) {
        console.error('[CRM_CLIENT_PLANS_PAYMENT_ERROR]', paymentResult.error?.code ?? paymentHistoryResult.error?.code ?? 'UNKNOWN');
        return NextResponse.json({ error: 'Não foi possível carregar os pagamentos do plano.' }, { status: 503 });
      }

      const allowedServices = Array.isArray(activePlan.service_ids)
        ? new Set(activePlan.service_ids as string[])
        : new Set<string>();
      const used = usageData.filter((appointment) =>
        allowedServices.size === 0 ||
        (appointment.service_id && allowedServices.has(appointment.service_id)),
      ).length;
      enrichedPlans = enrichedPlans.map((plan) =>
        plan.id === activePlan.id
          ? {
              ...plan,
              used_appointments: used,
              remaining_appointments: Math.max(0, Number(plan.included_appointments) - used),
              period_start: periodStart,
              period_end: periodEnd,
              current_payment: period.started ? paymentResult.data ?? null : null,
              payment_history: paymentHistoryResult.data ?? [],
            }
          : plan,
      );
    }

    return NextResponse.json(
      { plans: enrichedPlans, services: services ?? [] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const authorization = moduleErrorResponse(error);
    if (authorization) return authorization;
    console.error('[CRM_CLIENT_PLANS_INTERNAL_ERROR]', error instanceof Error ? error.name : 'UNKNOWN');
    return NextResponse.json(
      { error: 'Não foi possível carregar os planos deste cliente.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

async function POST__unobserved(req: Request, { params }: Params) {
  try {
    const tenant = await requireModuleContext('clients', 'clients', req);
    const { clientId } = await params;
    if (!UUID_PATTERN.test(clientId)) {
      return NextResponse.json({ error: 'Identificador de cliente inválido.' }, { status: 400 });
    }
    const payload = await readJsonObject(req, {
      maxBytes: 12 * 1024,
      allowedKeys: ['name', 'monthly_price', 'included_appointments', 'service_ids', 'start_date', 'notes'],
    });
    if (!payload.ok) return payload.response;
    const parsed = parsePlanFields(payload.value);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const [{ valid: clientValid }, servicesValid, { data: activePlan, error: activePlanError }] =
      await Promise.all([
        validateClient(tenant.admin, clientId, tenant.barbershopId),
        validateServices(tenant.admin, parsed.value.service_ids, tenant.barbershopId),
        tenant.admin
          .from('client_plans')
          .select('id')
          .eq('barbershop_id', tenant.barbershopId)
          .eq('client_id', clientId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle(),
      ]);

    if (!clientValid) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
    if (!servicesValid) return NextResponse.json({ error: 'Um dos serviços selecionados não pertence a esta barbearia.' }, { status: 400 });
    if (activePlanError) return NextResponse.json({ error: 'Não foi possível validar o plano atual.' }, { status: 503 });
    if (activePlan) return NextResponse.json({ error: 'Este cliente já tem um plano ativo. Pausa ou termina o plano atual antes de criar outro.' }, { status: 409 });

    const { data: plan, error } = await tenant.admin
      .from('client_plans')
      .insert({
        ...parsed.value,
        barbershop_id: tenant.barbershopId,
        client_id: clientId,
        created_by: tenant.userId,
        status: 'active',
      })
      .select('id, name, monthly_price, included_appointments, service_ids, start_date, status, notes, created_at, updated_at')
      .single();

    if (error || !plan) {
      console.error('[CRM_CLIENT_PLAN_CREATE_ERROR]', error?.code ?? 'UNKNOWN');
      return NextResponse.json({ error: 'Não foi possível criar o plano.' }, { status: 503 });
    }

    return NextResponse.json({ plan }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const authorization = moduleErrorResponse(error);
    if (authorization) return authorization;
    console.error('[CRM_CLIENT_PLAN_CREATE_INTERNAL_ERROR]', error instanceof Error ? error.name : 'UNKNOWN');
    return NextResponse.json({ error: 'Não foi possível criar o plano.' }, { status: 500 });
  }
}

async function PATCH__unobserved(req: Request, { params }: Params) {
  try {
    const tenant = await requireModuleContext('clients', 'clients', req);
    const { clientId } = await params;
    if (!UUID_PATTERN.test(clientId)) {
      return NextResponse.json({ error: 'Identificador de cliente inválido.' }, { status: 400 });
    }
    const payload = await readJsonObject(req, {
      maxBytes: 12 * 1024,
      allowedKeys: ['plan_id', 'action', 'name', 'monthly_price', 'included_appointments', 'service_ids', 'start_date', 'notes', 'payment_method'],
    });
    if (!payload.ok) return payload.response;

    const planId = typeof payload.value.plan_id === 'string' ? payload.value.plan_id : '';
    const action = typeof payload.value.action === 'string' ? payload.value.action : '';
    if (!UUID_PATTERN.test(planId)) return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });

    const { data: plan, error: planError } = await tenant.admin
      .from('client_plans')
      .select('id, name, monthly_price, included_appointments, service_ids, start_date, status, notes')
      .eq('id', planId)
      .eq('barbershop_id', tenant.barbershopId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (planError) return NextResponse.json({ error: 'Não foi possível validar o plano.' }, { status: 503 });
    if (!plan) return NextResponse.json({ error: 'Plano não encontrado.' }, { status: 404 });

    if (action === 'update') {
      const parsed = parsePlanFields(payload.value);
      if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      const servicesValid = await validateServices(tenant.admin, parsed.value.service_ids, tenant.barbershopId);
      if (!servicesValid) return NextResponse.json({ error: 'Um dos serviços selecionados não pertence a esta barbearia.' }, { status: 400 });

      const { data: updated, error } = await tenant.admin
        .from('client_plans')
        .update({ ...parsed.value, updated_at: new Date().toISOString() })
        .eq('id', planId)
        .eq('barbershop_id', tenant.barbershopId)
        .eq('client_id', clientId)
        .select('id, name, monthly_price, included_appointments, service_ids, start_date, status, notes, created_at, updated_at')
        .single();

      if (error || !updated) return NextResponse.json({ error: 'Não foi possível atualizar o plano.' }, { status: 503 });
      return NextResponse.json({ plan: updated }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'pause' || action === 'activate' || action === 'cancel') {
      const nextStatus: PlanStatus =
        action === 'pause' ? 'paused' : action === 'cancel' ? 'cancelled' : 'active';

      if (action === 'activate') {
        const { data: otherActive, error: activeError } = await tenant.admin
          .from('client_plans')
          .select('id')
          .eq('barbershop_id', tenant.barbershopId)
          .eq('client_id', clientId)
          .eq('status', 'active')
          .neq('id', planId)
          .limit(1)
          .maybeSingle();
        if (activeError) return NextResponse.json({ error: 'Não foi possível validar os planos ativos.' }, { status: 503 });
        if (otherActive) return NextResponse.json({ error: 'Este cliente já tem outro plano ativo.' }, { status: 409 });
      }

      const { data: updated, error } = await tenant.admin
        .from('client_plans')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', planId)
        .eq('barbershop_id', tenant.barbershopId)
        .eq('client_id', clientId)
        .select('id, status')
        .single();
      if (error || !updated) return NextResponse.json({ error: 'Não foi possível alterar o estado do plano.' }, { status: 503 });
      return NextResponse.json({ plan: updated }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'mark-paid' || action === 'mark-pending') {
      if (plan.status !== 'active') {
        return NextResponse.json({ error: 'Só podes registar a mensalidade de um plano ativo.' }, { status: 409 });
      }
      const period = currentBillingPeriod(plan.start_date, new Date());
      if (!period.started) {
        return NextResponse.json({ error: 'O plano ainda não começou.' }, { status: 409 });
      }

      const periodStart = toDateOnly(period.start);
      const periodEnd = toDateOnly(period.end);
      if (action === 'mark-paid') {
        const paymentMethod = validPaymentMethod(payload.value.payment_method);
        if (!paymentMethod) return NextResponse.json({ error: 'Seleciona um método de pagamento válido.' }, { status: 400 });
        const { data: payment, error } = await tenant.admin
          .from('client_plan_payments')
          .upsert({
            plan_id: planId,
            barbershop_id: tenant.barbershopId,
            client_id: clientId,
            period_start: periodStart,
            period_end: periodEnd,
            amount: plan.monthly_price,
            status: 'paid',
            payment_method: paymentMethod,
            paid_at: new Date().toISOString(),
            created_by: tenant.userId,
          }, { onConflict: 'plan_id,period_start' })
          .select('id, period_start, period_end, amount, status, payment_method, paid_at')
          .single();
        if (error || !payment) return NextResponse.json({ error: 'Não foi possível registar o pagamento.' }, { status: 503 });
        return NextResponse.json({ payment }, { headers: { 'Cache-Control': 'no-store' } });
      }

      const { data: payment, error } = await tenant.admin
        .from('client_plan_payments')
        .update({ status: 'pending', payment_method: null, paid_at: null })
        .eq('barbershop_id', tenant.barbershopId)
        .eq('client_id', clientId)
        .eq('plan_id', planId)
        .eq('period_start', periodStart)
        .select('id, period_start, period_end, amount, status, payment_method, paid_at')
        .maybeSingle();
      if (error) return NextResponse.json({ error: 'Não foi possível atualizar o estado do pagamento.' }, { status: 503 });
      return NextResponse.json({ payment }, { headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({ error: 'Ação de plano inválida.' }, { status: 400 });
  } catch (error) {
    const authorization = moduleErrorResponse(error);
    if (authorization) return authorization;
    console.error('[CRM_CLIENT_PLAN_UPDATE_INTERNAL_ERROR]', error instanceof Error ? error.name : 'UNKNOWN');
    return NextResponse.json({ error: 'Não foi possível atualizar o plano.' }, { status: 500 });
  }
}

export const GET = withApiObservability('/api/crm/clients/[clientId]/plans', GET__unobserved);
export const POST = withApiObservability('/api/crm/clients/[clientId]/plans', POST__unobserved);
export const PATCH = withApiObservability('/api/crm/clients/[clientId]/plans', PATCH__unobserved);
