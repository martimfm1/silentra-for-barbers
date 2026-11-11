'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type { Session, User } from '@supabase/supabase-js';
import posthog from 'posthog-js';
import { Toaster } from '@/components/ui/sonner';
import { QueryProvider } from '@/components/providers/query-provider';
import { CookieConsentManager } from '@/components/privacy/cookie-consent-manager';
import { CursorFollowHint } from '@/components/ui/cursor-follow-hint';
import { createClient } from '@/lib/supabase/client';

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

function PostHogAuthSync() {
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ||
      !process.env.NEXT_PUBLIC_POSTHOG_HOST
    )
      return;

    const supabase = createClient();

    const syncIdentity = (user: User | null) => {
      if (!user) {
        if (identifiedUserId.current) {
          posthog.reset();
          identifiedUserId.current = null;
        }
        return;
      }

      if (identifiedUserId.current && identifiedUserId.current !== user.id) {
        posthog.reset();
      }

      if (identifiedUserId.current !== user.id) {
        const name = user.user_metadata.name ?? user.user_metadata.full_name;
        posthog.identify(user.id, {
          ...(user.email ? { email: user.email } : {}),
          ...(typeof name === 'string' && name ? { name } : {}),
        });
        identifiedUserId.current = user.id;
      }
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      syncIdentity(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      syncIdentity(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showCookieConsent = !isDashboardRoute(pathname);

  return (
    <div className="min-h-screen text-zinc-50">
      <PostHogAuthSync />
      <QueryProvider>{children}</QueryProvider>
      {isDashboardRoute(pathname) ? <CursorFollowHint /> : null}
      <Toaster richColors position="top-right" />
      {showCookieConsent ? <CookieConsentManager /> : null}
    </div>
  );
}
