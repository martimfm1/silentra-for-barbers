import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { createBarbershopCalendarFeedToken } from '@/lib/calendar/feed-token';
import { getPublicAppUrl } from '@/lib/email/calendar-link';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AGENDA_ROLES = [
  'owner',
  'admin',
  'manager',
  'barber',
  'receptionist',
  'staff',
] as const;

type ContextResult =
  | {
      ok: true;
      tenant: Extract<
        Awaited<ReturnType<typeof requireTenantAuthorization>>,
        { ok: true }
      >;
      shop: {
        calendar_feed_enabled: boolean;
        calendar_feed_version: number;
      };
    }
  | { ok: false; status: number; message: string };

function hasAgendaGrant(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const permissions = value as Record<string, unknown>;
  return permissions.agenda === true || permissions.appointments === true;
}

async function getAuthorizedContext(request: Request): Promise<ContextResult> {
  const tenant = await requireTenantAuthorization(request, AGENDA_ROLES);
  if (!tenant.ok) {
    return {
      ok: false,
      status: tenant.status,
      message:
        tenant.status === 401
          ? 'Não autenticado.'
          : 'Sem permissão para consultar a agenda.',
    };
  }

  if (tenant.role !== 'owner') {
    const { data: grant, error: grantError } = await tenant.admin
      .from('barbershop_member_permissions')
      .select('permissions')
      .eq('barbershop_id', tenant.barbershopId)
      .eq('user_id', tenant.userId)
      .maybeSingle();

    if (grantError) {
      return {
        ok: false,
        status: 503,
        message: 'Não foi possível validar as permissões da agenda.',
      };
    }

    let allowed = grant ? hasAgendaGrant(grant.permissions) : false;
    if (!grant) {
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
        return {
          ok: false,
          status: 503,
          message: 'Não foi possível validar as permissões da agenda.',
        };
      }
      allowed = legacyGrant?.allowed === true;
    }

    if (!allowed) {
      return {
        ok: false,
        status: 403,
        message: 'Não tem permissão para sincronizar a agenda.',
      };
    }
  }

  const { data: shop, error: shopError } = await tenant.admin
    .from('barbershops')
    .select('calendar_feed_enabled,calendar_feed_version')
    .eq('id', tenant.barbershopId)
    .maybeSingle();

  if (shopError || !shop) {
    console.error(
      '[CALENDAR_FEED_SETTINGS_READ_ERROR]',
      shopError?.code ?? 'BARBERSHOP_NOT_FOUND',
    );
    return {
      ok: false,
      status: 503,
      message: 'Não foi possível carregar as definições de sincronização.',
    };
  }

  return {
    ok: true,
    tenant,
    shop: {
      calendar_feed_enabled: shop.calendar_feed_enabled === true,
      calendar_feed_version: Number(shop.calendar_feed_version ?? 1),
    },
  };
}

function buildFeedUrl(barbershopId: string, version: number): string {
  const url = new URL('/api/calendar/feed', getPublicAppUrl());
  url.searchParams.set(
    'token',
    createBarbershopCalendarFeedToken(barbershopId, version),
  );
  return url.toString();
}

async function GET__unobserved(request: Request) {
  const context = await getAuthorizedContext(request);
  if (!context.ok) {
    return NextResponse.json(
      { error: context.message },
      { status: context.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    {
      enabled: context.shop.calendar_feed_enabled,
      feedUrl: context.shop.calendar_feed_enabled
        ? buildFeedUrl(
            context.tenant.barbershopId,
            context.shop.calendar_feed_version,
          )
        : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

async function POST__unobserved(request: Request) {
  const context = await getAuthorizedContext(request);
  if (!context.ok) {
    return NextResponse.json(
      { error: context.message },
      { status: context.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const nextVersion = context.shop.calendar_feed_version + 1;
  const { data: updated, error } = await context.tenant.admin
    .from('barbershops')
    .update({
      calendar_feed_enabled: true,
      calendar_feed_version: nextVersion,
    })
    .eq('id', context.tenant.barbershopId)
    .eq('calendar_feed_version', context.shop.calendar_feed_version)
    .select('calendar_feed_enabled,calendar_feed_version')
    .maybeSingle();

  if (error || !updated) {
    console.error(
      '[CALENDAR_FEED_SETTINGS_ROTATE_ERROR]',
      error?.code ?? 'CONCURRENT_UPDATE',
    );
    return NextResponse.json(
      { error: 'Não foi possível gerar o link da agenda. Tenta novamente.' },
      { status: error ? 503 : 409, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    {
      enabled: true,
      feedUrl: buildFeedUrl(
        context.tenant.barbershopId,
        Number(updated.calendar_feed_version),
      ),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

async function DELETE__unobserved(request: Request) {
  const context = await getAuthorizedContext(request);
  if (!context.ok) {
    return NextResponse.json(
      { error: context.message },
      { status: context.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const nextVersion = context.shop.calendar_feed_version + 1;
  const { data: updated, error } = await context.tenant.admin
    .from('barbershops')
    .update({
      calendar_feed_enabled: false,
      calendar_feed_version: nextVersion,
    })
    .eq('id', context.tenant.barbershopId)
    .eq('calendar_feed_version', context.shop.calendar_feed_version)
    .select('id')
    .maybeSingle();

  if (error || !updated) {
    console.error(
      '[CALENDAR_FEED_SETTINGS_DISABLE_ERROR]',
      error?.code ?? 'CONCURRENT_UPDATE',
    );
    return NextResponse.json(
      { error: 'Não foi possível desativar a sincronização.' },
      { status: error ? 503 : 409, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    { enabled: false, feedUrl: null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export const GET = withApiObservability(
  '/api/calendar/feed/settings',
  GET__unobserved,
);
export const POST = withApiObservability(
  '/api/calendar/feed/settings',
  POST__unobserved,
);
export const DELETE = withApiObservability(
  '/api/calendar/feed/settings',
  DELETE__unobserved,
);
