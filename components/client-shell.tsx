'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { Toaster } from '@/components/ui/sonner';
import { QueryProvider } from '@/components/providers/query-provider';
import { CookieConsentManager } from '@/components/privacy/cookie-consent-manager';
import { CursorFollowHint } from '@/components/ui/cursor-follow-hint';
import { HapticsProvider } from '@/components/haptics-provider';
import { createClient } from '@/lib/supabase/client';
import {
  identifyProductUser,
  resetProductUser,
} from '@/lib/observability/posthog';

const dashboardRoutePrefixes = [
  '/dashboard',
  '/silentra-admin',
  '/_silentra-admin',
  '/silentra_admin',
] as const;

function isDashboardRoute(pathname: string | null) {
  return Boolean(
    pathname &&
    dashboardRoutePrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ),
  );
}

function PostHogUserIdentification() {
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const identifySession = (session: Session | null) => {
      const user = session?.user;
      if (!user || identifiedUserId.current === user.id) return;

      if (identifiedUserId.current) resetProductUser();

      identifyProductUser({ id: user.id });
      identifiedUserId.current = user.id;
    };

    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => identifySession(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          identifySession(session);
        } else if (event === 'SIGNED_OUT') {
          resetProductUser();
          identifiedUserId.current = null;
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  return null;
}

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showCookieConsent = !isDashboardRoute(pathname);

  return (
    <HapticsProvider>
      <PostHogUserIdentification />
      <div className="min-h-screen text-zinc-50">
        <QueryProvider>{children}</QueryProvider>
        {isDashboardRoute(pathname) ? <CursorFollowHint /> : null}
        <Toaster richColors position="top-right" />
        {showCookieConsent ? <CookieConsentManager /> : null}
      </div>
    </HapticsProvider>
  );
}
