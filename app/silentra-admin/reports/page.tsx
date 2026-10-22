import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPlatformAdminContext } from '@/lib/internal/platform-admin';
import PlatformReportsPage from '@/app/_silentra-admin/reports-page';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Relatórios da plataforma | Silentra',
  robots: { index: false, follow: false },
};

export default async function SilentraAdminReportsRoute() {
  const context = await getPlatformAdminContext();
  if (!context) notFound();
  return <PlatformReportsPage />;
}
