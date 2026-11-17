import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxySupabase(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  if (!user && pathname.startsWith('/onboarding')) {
    // Preserve invite tokens when an unauthenticated recipient is sent to login.
    // handleLogin validates this as a same-origin relative path before navigating.
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set(
      'redirect',
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user) {
    // Use the authenticated SSR client directly. Do not import browser-only DB
    // helpers into the request proxy because they cannot resolve this session.
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('barbershop_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[AUTH_PROXY_PROFILE_LOOKUP_FAIL]', profileError.message);
    }

    const barbershopId = profile?.barbershop_id ?? null;

    if (barbershopId) {
      response.cookies.set('barbershop_id', barbershopId, {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    } else {
      response.cookies.delete('barbershop_id');
    }

    if (pathname.startsWith('/dashboard') && !barbershopId) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    if (pathname.startsWith('/onboarding') && barbershopId) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}
