import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthCallbackUrl } from '@/lib/auth/email-confirmation';
import { normalizeText } from '@/lib/validation';
import { readJsonObject } from '@/lib/security/request-validation';

async function POST__unobserved(request: Request) {
  try {
    const bodyResult = await readJsonObject(request, {
      maxBytes: 8 * 1024,
      allowedKeys: ['email', 'name_complete', 'num_phone', 'password'],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.value;

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
        // Keep the response neutral because Supabase intentionally obfuscates
        // whether an email is already registered when enumeration protection
        // is enabled.
        message: 'REGISTRATION_NEXT_STEPS',
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

export const POST = withApiObservability(
  '/api/auth/register',
  POST__unobserved,
);
