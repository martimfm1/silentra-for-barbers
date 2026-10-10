import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function POST__unobserved(request: Request) {
  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    }

    const email =
      'email' in body && typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : '';
    const password =
      'password' in body && typeof body.password === 'string'
        ? body.password
        : '';

    if (!email || !password || email.length > 254 || password.length > 128) {
      return NextResponse.json(
        { error: 'Email e palavra-passe são obrigatórios.' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Credenciais inválidas.' },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, name_complete, barbershop_id, role')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[LOGIN_PROFILE_ERROR]', profileError.message);
      return NextResponse.json(
        { error: 'Não foi possível carregar o perfil da conta.' },
        { status: 500 },
      );
    }

    // A sessão é persistida pelo cliente SSR através dos cookies Supabase.
    // Não devolvemos access/refresh tokens no JSON da API.
    return NextResponse.json(
      {
        success: true,
        user: profile
          ? {
              ...profile,
              email: authData.user.email ?? null,
            }
          : {
              id: authData.user.id,
              name_complete:
                typeof authData.user.user_metadata?.name_complete === 'string'
                  ? authData.user.user_metadata.name_complete
                  : null,
              barbershop_id: null,
              role: null,
              email: authData.user.email ?? null,
            },
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    console.error(
      '[LOGIN_ERROR]',
      error instanceof Error ? error.name : 'unknown',
    );
    return NextResponse.json(
      { error: 'Ocorreu um erro interno no início de sessão.' },
      { status: 500 },
    );
  }
}

export const POST = withApiObservability('/api/auth/login', POST__unobserved);
