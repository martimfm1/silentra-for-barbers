import { withApiObservability } from '@/lib/observability/api';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

async function POST__unobserved(request: Request) {
  try {
    const authorization = request.headers.get('Authorization');
    let supabase;
    if (authorization?.startsWith('Bearer ')) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase server configuration is incomplete.');
      }
      supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } else {
      supabase = await createClient();
    }
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { data, error } = await supabase.rpc(
      'create_barbershop_invite_code',
      { p_role: 'barber' },
    );
    if (error) {
      console.error('[TEAM_INVITE_CREATE_FAIL]', error.code ?? 'UNKNOWN');
      if (error.code === '42501')
        return NextResponse.json(
          {
            error:
              'Apenas o proprietário ou administrador pode gerar convites.',
          },
          { status: 403 },
        );
      if (error.code === 'P0001')
        return NextResponse.json(
          {
            error:
              'Não existe espaço disponível para adicionar outra pessoa à equipa.',
          },
          { status: 409 },
        );
      return NextResponse.json(
        { error: 'Não foi possível gerar o convite.' },
        { status: 500 },
      );
    }

    const invite = Array.isArray(data) ? data[0] : data;
    if (!invite?.code || !invite?.expires_at) {
      console.error('[TEAM_INVITE_INVALID_RESPONSE]', 'INVALID_RPC_RESPONSE');
      return NextResponse.json(
        { error: 'Não foi possível gerar o convite.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      code: invite.code,
      role: invite.role ?? 'barber',
      expiresAt: invite.expires_at,
    });
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

export const POST = withApiObservability('/api/team/invite', POST__unobserved);
