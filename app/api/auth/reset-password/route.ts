import { withApiLogging } from '@/lib/observability/api-request';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function POSTHandler(request: Request) {
  try {
    const body: unknown = await request.json();
    const password =
      typeof body === 'object' && body !== null && 'password' in body
        ? (body as { password?: unknown }).password
        : undefined;

    if (
      typeof password !== 'string' ||
      password.length < 12 ||
      password.length > 128
    ) {
      return NextResponse.json(
        { error: 'A nova palavra-passe deve ter entre 12 e 128 caracteres.' },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              );
            } catch {
              // Cookies are persisted by the active Route Handler response.
            }
          },
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'A sessão de recuperação é inválida ou expirou.' },
        { status: 401 },
      );
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.warn('[AUTH_PASSWORD_UPDATE_REJECTED]', {
        code: error.code,
        status: error.status,
      });
      return NextResponse.json(
        {
          error:
            'Não foi possível atualizar a palavra-passe. Solicita um novo link e tenta novamente.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[AUTH_PASSWORD_UPDATE_ERROR]',
      error instanceof Error ? error.name : 'unknown',
    );
    return NextResponse.json(
      { error: 'Ocorreu um erro interno ao redefinir a palavra-passe.' },
      { status: 500 },
    );
  }
}

export const POST = withApiLogging('/api/auth/reset-password', POSTHandler);
