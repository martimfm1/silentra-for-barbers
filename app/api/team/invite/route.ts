import { withApiObservability } from '@/lib/observability/api';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';

const INVITE_METHODS = ['code', 'link', 'qr'] as const;
const INVITE_EXPIRY_HOURS = [24, 72, 168] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type InviteMethod = (typeof INVITE_METHODS)[number];

async function createRequestClient(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (authorization?.startsWith('Bearer ')) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase server configuration is incomplete.');
    }
    return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return createClient();
}

function inviteErrorResponse(error: { code?: string; message?: string }) {
  if (error.code === '42501') {
    return NextResponse.json(
      { error: 'Apenas o proprietário ou administrador pode gerir convites.' },
      { status: 403 },
    );
  }
  if (
    error.code === 'P0001' ||
    error.message === 'PROFESSIONAL_LIMIT_REACHED' ||
    error.message === 'TEAM_MEMBER_LIMIT_REACHED'
  ) {
    return NextResponse.json(
      {
        error:
          'Não existem lugares de equipa disponíveis no plano atual. Remove um membro ou faz upgrade do plano.',
      },
      { status: 409 },
    );
  }
  if (error.code === 'P0002') {
    return NextResponse.json(
      { error: 'Este convite já não está ativo ou não existe.' },
      { status: 404 },
    );
  }
  if (error.code === '22023') {
    return NextResponse.json(
      { error: 'O método ou a validade do convite não é válido.' },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: 'Não foi possível concluir a operação de convite.' },
    { status: 500 },
  );
}

async function POST__unobserved(request: Request) {
  try {
    const supabase = await createRequestClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const body: unknown = await request.json().catch(() => ({}));
    const candidate =
      body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    if (
      candidate.method !== undefined &&
      !INVITE_METHODS.includes(candidate.method as InviteMethod)
    ) {
      return NextResponse.json({ error: 'Método de convite inválido.' }, { status: 400 });
    }
    if (
      candidate.expiresInHours !== undefined &&
      (typeof candidate.expiresInHours !== 'number' ||
        !INVITE_EXPIRY_HOURS.includes(
          candidate.expiresInHours as (typeof INVITE_EXPIRY_HOURS)[number],
        ))
    ) {
      return NextResponse.json({ error: 'Validade do convite inválida.' }, { status: 400 });
    }

    const method = (candidate.method as InviteMethod | undefined) ?? 'code';
    const expiresInHours =
      (candidate.expiresInHours as (typeof INVITE_EXPIRY_HOURS)[number] | undefined) ??
      168;

    const { data, error } = await supabase.rpc(
      'create_barbershop_invite_v2',
      {
        p_method: method,
        p_expires_in_hours: expiresInHours,
        p_role: 'barber',
      },
    );

    if (error) {
      console.error('[TEAM_INVITE_CREATE_FAIL]', error.code ?? 'UNKNOWN');
      return inviteErrorResponse(error);
    }

    const invite = Array.isArray(data) ? data[0] : data;
    if (!invite?.invite_id || !invite?.invite_value || !invite?.expires_at) {
      console.error('[TEAM_INVITE_INVALID_RESPONSE]', 'INVALID_RPC_RESPONSE');
      return NextResponse.json(
        { error: 'Não foi possível gerar o convite.' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        inviteId: invite.invite_id,
        inviteValue: invite.invite_value,
        method: invite.method ?? method,
        role: invite.role ?? 'barber',
        expiresAt: invite.expires_at,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[TEAM_INVITE_CRITICAL_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { error: 'Não foi possível gerar o convite. Tenta novamente.' },
      { status: 500 },
    );
  }
}

async function GET__unobserved(request: Request) {
  const tenant = await requireTenantAuthorization(request, ['owner', 'admin']);
  if (!tenant.ok) {
    return NextResponse.json(
      { error: 'Apenas o proprietário ou administrador pode ver os convites.' },
      { status: tenant.status },
    );
  }

  const { data, error } = await tenant.admin
    .from('barbershop_invite_codes')
    .select('id, role, invite_method, expires_at, created_at')
    .eq('barbershop_id', tenant.barbershopId)
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[TEAM_INVITE_LIST_FAIL]', error.code ?? 'UNKNOWN');
    return NextResponse.json(
      { error: 'Não foi possível carregar os convites ativos.' },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { invites: data ?? [] },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

async function DELETE__unobserved(request: Request) {
  try {
    const supabase = await createRequestClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const body: unknown = await request.json().catch(() => ({}));
    const inviteId =
      body && typeof body === 'object' && 'inviteId' in body
        ? (body as { inviteId?: unknown }).inviteId
        : null;

    if (typeof inviteId !== 'string' || !UUID_PATTERN.test(inviteId)) {
      return NextResponse.json(
        { error: 'Identificador de convite inválido.' },
        { status: 400 },
      );
    }

    const { error } = await supabase.rpc('revoke_barbershop_invite', {
      p_invite_id: inviteId,
    });

    if (error) {
      console.error('[TEAM_INVITE_REVOKE_FAIL]', error.code ?? 'UNKNOWN');
      return inviteErrorResponse(error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      '[TEAM_INVITE_REVOKE_CRITICAL_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { error: 'Não foi possível revogar o convite. Tenta novamente.' },
      { status: 500 },
    );
  }
}

export const POST = withApiObservability('/api/team/invite', POST__unobserved);
export const GET = withApiObservability('/api/team/invite', GET__unobserved);
export const DELETE = withApiObservability(
  '/api/team/invite',
  DELETE__unobserved,
);
