import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getPlatformAdminContext } from '@/lib/internal/platform-admin';
import CustomWebsitesAdmin from './custom-websites-admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Sites Enterprise | Silentra Internal',
  robots: { index: false, follow: false },
};

export default async function CustomWebsitesAdminPage() {
  const context = await getPlatformAdminContext();
  if (!context) {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login?redirect=%2Fsilentra-admin%2Fwebsites');
    notFound();
  }
  return <CustomWebsitesAdmin />;
}
