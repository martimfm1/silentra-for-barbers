import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SiteNavbar } from '@/components/site-navbar';
import { FooterSection } from '@/components/hero/footer-section';
import { StatusPageClient } from '@/components/status/status-page-client';

export const metadata: Metadata = {
  title: 'Estado da Plataforma',
  description:
    'Consulta o estado da aplicação Silentra for Barbers, da base de dados e dos serviços externos essenciais.',
  alternates: {
    canonical: 'https://barbers.silentra.me/status',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Estado da Plataforma | Silentra for Barbers',
    description:
      'Disponibilidade da aplicação, base de dados e serviços externos da Silentra for Barbers.',
    url: 'https://barbers.silentra.me/status',
    siteName: 'Silentra for Barbers',
    locale: 'pt_PT',
    type: 'website',
  },
};

export default async function StatusPage() {
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'pt';

  return (
    <div className="min-h-screen overflow-x-clip bg-zinc-950 text-zinc-50 antialiased">
      <SiteNavbar />
      <StatusPageClient locale={locale} />
      <FooterSection />
    </div>
  );
}
