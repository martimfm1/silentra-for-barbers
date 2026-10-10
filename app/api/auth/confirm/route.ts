import { withApiLogging } from '@/lib/observability/api-request';
import { type EmailOtpType } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const allowedTypes = new Set<EmailOtpType>(['email']);

async function GETHandler(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const typeValue = requestUrl.searchParams.get('type');
  const origin = requestUrl.origin;

  if (
    !tokenHash ||
    !typeValue ||
    !allowedTypes.has(typeValue as EmailOtpType)
  ) {
    return NextResponse.redirect(
      new URL('/login?error=Link+de+confirmação+inválido+ou+expirado', origin),
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
            // Cookies podem não poder ser escritos em alguns contextos de rendering.
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: typeValue as EmailOtpType,
  });

  if (error) {
    console.warn('[AUTH_EMAIL_CONFIRM_REJECTED]', {
      code: error.code,
      status: error.status,
    });

    return NextResponse.redirect(
      new URL('/login?error=Link+de+confirmação+inválido+ou+expirado', origin),
    );
  }

  return NextResponse.redirect(new URL('/email-confirmed', origin));
}


export const GET = withApiLogging('/api/auth/confirm', GETHandler);
