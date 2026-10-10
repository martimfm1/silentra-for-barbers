import { withApiLogging } from '@/lib/observability/api-request';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const NEW_INVITE_BODY = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const LEGACY_INVITE_CODE = /^[0-9A-F]{10}$/;

function normalizeInviteCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.startsWith('BARB')) {
    const body = compact.slice(4);
    if (!NEW_INVITE_BODY.test(body)) return null;
    return `BARB-${body.slice(0, 4)}-${body.slice(4)}`;
  }
  if (NEW_INVITE_BODY.test(compact))
    return `BARB-${compact.slice(0, 4)}-${compact.slice(4)}`;
  if (LEGACY_INVITE_CODE.test(compact)) return compact;
  return null;
}

async function POSTHandler(request: Request) {
  try {
    const supabase = await createClient();
    const body: unknown = await request.json().catch(() => null);
    const inviteCode =
      body && typeof body === 'object' && 'inviteCode' in body
        ? normalizeInviteCode((body as { inviteCode?: unknown }).inviteCode)
        : null;

    if (!inviteCode)
      return NextResponse.json(
        {
          error:
            'Introduz um código de convite válido, por exemplo BARB-7K4P-9X2M.',
        },
        { status: 400 },
      );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { data, error } = await supabase.rpc('join_barbershop_with_invite', {
      p_code: inviteCode,
    });
    if (error) {
      console.error(
        '[ONBOARDING_JOIN_FAIL]',
        error.code ?? 'UNKNOWN',
        error.message ?? '',
      );
      if (
        error.code === 'P0001' &&
        (error.message === 'PROFESSIONAL_LIMIT_REACHED' ||
          error.message === 'TEAM_MEMBER_LIMIT_REACHED')
      ) {
        return NextResponse.json(
          {
            error:
              'Esta barbearia atingiu o limite de pessoas da equipa do plano atual.',
          },
          { status: 409 },
        );
      }
      if (error.code === '22023') {
        if (error.message === 'already_team_member')
          return NextResponse.json(
            { error: 'Já fazes parte da equipa desta barbearia.' },
            { status: 409 },
          );
        return NextResponse.json(
          { error: 'O código é inválido, já foi utilizado ou expirou.' },
          { status: 400 },
        );
      }
      if (error.code === '42501')
        return NextResponse.json(
          { error: 'Não tens permissão para entrar nesta equipa.' },
          { status: 403 },
        );
      if (error.code === 'P0002')
        return NextResponse.json(
          { error: 'Não foi possível encontrar o teu perfil.' },
          { status: 409 },
        );
      return NextResponse.json(
        {
          error:
            'Não foi possível associar a tua conta à barbearia. Tenta novamente.',
        },
        { status: 500 },
      );
    }

    const membership = Array.isArray(data) ? data[0] : data;
    if (!membership?.barbershop_id || !membership?.role) {
      console.error(
        '[ONBOARDING_JOIN_INVALID_RESPONSE]',
        'INVALID_RPC_RESPONSE',
      );
      return NextResponse.json(
        { error: 'Não foi possível concluir a associação.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      barbershopId: membership.barbershop_id,
      role: membership.role,
    });
  } catch (error) {
    console.error(
      '[ONBOARDING_JOIN_CRITICAL_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { error: 'Não foi possível concluir o convite. Tenta novamente.' },
      { status: 500 },
    );
  }
}


export const POST = withApiLogging('/api/onboarding/join-v2', POSTHandler);
