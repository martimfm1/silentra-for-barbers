import { withApiObservability } from '@/lib/observability/api';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function getSafeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/email-confirmed';
  }

  return value;
}

async function GET__unobserved(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = getSafeNext(requestUrl.searchParams.get('next'));
  const origin = requestUrl.origin;

  if (code) {
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
              // Ignorado no contexto de Server Components / Handlers
            }
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }

    console.warn('[AUTH_CALLBACK_REJECTED]', {
      code: error.code,
      status: error.status,
    });
  }

  return NextResponse.redirect(
    new URL('/login?error=Link+inv%C3%A1lido+ou+expirado', origin),
  );
}

export const GET = withApiObservability('/api/auth/callback', GET__unobserved);
