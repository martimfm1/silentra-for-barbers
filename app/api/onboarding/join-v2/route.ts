import { withApiObservability } from '@/lib/observability/api';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Keep legacy codes working while accepting the longer codes and bearer
// tokens used by links and QR invitations.
const INVITE_BODY = /^(?:[0-9A-HJ-NP-Z]{8}|[0-9A-HJ-NP-Z]{12})$/;
const LINK_TOKEN = /^[0-9A-F]{32}$/;
const LEGACY_INVITE_CODE = /^[0-9A-F]{10}$/;

function formatBarberCode(body: string): string {
  return `BARB-${body.match(/.{1,4}/g)?.join('-') ?? body}`;
}

function normalizeInviteCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (compact.startsWith('SIL')) {
    const token = compact.slice(3);
    return LINK_TOKEN.test(token) ? `SIL-${token}` : null;
  }

  if (compact.startsWith('BARB')) {
    const body = compact.slice(4);
    if (!INVITE_BODY.test(body)) return null;
    return formatBarberCode(body);
  }

  if (INVITE_BODY.test(compact)) return formatBarberCode(compact);
  if (LEGACY_INVITE_CODE.test(compact)) return compact;
  return null;
}

async function POST__unobserved(request: Request) {
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
            {
              error:
                'Esta conta já está associada a uma barbearia. Para entrar noutra equipa, usa uma conta sem associação ativa.',
            },
            { status: 409 },
          );
        return NextResponse.json(
          { error: 'O código é inválido, já foi utilizado ou expirou.' },
          { status: 400 },
        );
      }
      if (error.code === '42501') {
        if (error.message === 'owner_already_has_barbershop') {
          return NextResponse.json(
            {
              error:
                'Esta conta já é proprietária de outra barbearia. Para entrar nesta equipa, primeiro termina a associação à barbearia atual ou utiliza uma conta sem barbearia associada.',
            },
            { status: 409 },
          );
        }
        if (error.message === 'not_authenticated') {
          return NextResponse.json(
            { error: 'A tua sessão expirou. Inicia sessão novamente.' },
            { status: 401 },
          );
        }
        return NextResponse.json(
          { error: 'A tua conta não está autorizada a concluir este convite.' },
          { status: 403 },
        );
      }
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

export const POST = withApiObservability(
  '/api/onboarding/join-v2',
  POST__unobserved,
);
