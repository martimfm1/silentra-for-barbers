import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthCallbackUrl } from '@/lib/auth/email-confirmation';
import { isRecord, normalizeText } from '@/lib/validation';

async function POSTHandler(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    }

    const email = normalizeText(body.email, 254)?.toLowerCase();
    const name = normalizeText(body.name_complete, 120);
    const phone = normalizeText(body.num_phone, 30);
    const password = body.password;

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== 'string' ||
      password.length < 12 ||
      password.length > 128 ||
      !name ||
      !phone
    ) {
      return NextResponse.json(
        {
          error:
            'Usa um email válido, uma palavra-passe entre 12 e 128 caracteres e preenche os restantes campos.',
        },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(
        '[REGISTER_CONFIG_ERROR] Missing Supabase public credentials.',
      );
      return NextResponse.json(
        {
          error:
            'O registo está temporariamente indisponível. Tenta novamente mais tarde.',
        },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const emailRedirectTo = getAuthCallbackUrl(request);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          name_complete: name,
          full_name: name,
          num_phone: phone,
          phone,
        },
      },
    });

    if (error) {
      // Do not reveal whether an account already exists. Supabase Auth must
      // remain the authority for account state and enumeration protection.
      console.warn('[REGISTER_REJECTED]', {
        code: error.code,
        status: error.status,
      });

      return NextResponse.json(
        {
          error:
            'Não foi possível criar a conta. Confirma os dados e tenta novamente.',
        },
        { status: 400 },
      );
    }

    if (!data.user) {
      console.error(
        '[REGISTER_ERROR] Supabase did not return a user after signUp.',
      );
      return NextResponse.json(
        { error: 'Não foi possível criar a conta. Tenta novamente.' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        requiresEmailConfirmation: !data.session,
        message: data.session
          ? 'Conta criada com sucesso.'
          : 'Conta criada. Enviámos um email de confirmação.',
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[REGISTER_ERROR]',
      error instanceof Error ? error.name : 'unknown',
    );
    return NextResponse.json(
      { error: 'Ocorreu um erro interno no servidor.' },
      { status: 500 },
    );
  }
}

export const POST = withApiLogging('/api/auth/register', POSTHandler);
