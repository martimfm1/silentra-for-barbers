import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPlatformAdminContext } from '@/lib/internal/platform-admin';
import PlatformAdminConsole from '@/app/_silentra-admin/platform-admin-console';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Silentra Internal',
  robots: { index: false, follow: false },
};

export default async function SilentraAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getPlatformAdminContext();
  if (!context) {
    const params = await searchParams;
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') query.set(key, value);
    }
    const nextPath = query.toString()
      ? `/silentra-admin?${query.toString()}`
      : '/silentra-admin';

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const loginQuery = new URLSearchParams({
        redirect: nextPath,
      });
      const { redirect } = await import('next/navigation');
      redirect(`/login?${loginQuery.toString()}`);
    }

    notFound();
  }

  return <PlatformAdminConsole />;
}
