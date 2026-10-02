import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Gift } from 'lucide-react';
import { getPlatformAdminContext } from '@/lib/internal/platform-admin';
import PlatformAdminConsole from '@/app/_silentra-admin/platform-admin-console';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Silentra Internal',
  robots: { index: false, follow: false },
};

export default async function SilentraAdminPage() {
  const context = await getPlatformAdminContext();
  if (!context) notFound();

  return (
    <div className="relative">
      <PlatformAdminConsole />
      <Link
        href="/silentra-admin/loyalty"
        className="fixed bottom-5 right-5 z-50 inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-400/20 bg-zinc-950/95 px-4 text-xs font-semibold text-emerald-200 shadow-2xl backdrop-blur-xl transition hover:bg-zinc-900"
      >
        <Gift className="size-4" />
        Gestão de pontos
      </Link>
    </div>
  );
}
