import type { Metadata } from 'next';
import { SiteNavbar } from '@/components/site-navbar';
import { FooterSection } from '@/components/hero/footer-section';
import { LocalizedHomepage } from '@/components/hero/localized-homepage';
import { LocalizedPricingSection } from '@/components/hero/localized-pricing-section';

export const metadata: Metadata = {
  title: 'Software de Gestão e Agendamento para Barbearias',
  description:
    'Software de gestão para barbearias em Portugal: agenda online, serviços, clientes e equipa num único painel. Os clientes reservam sem conta. Começa grátis.',
  alternates: {
    canonical: 'https://barbers.silentra.me/',
  },
};

function HomeStructuredData() {
  const graph = [
    {
      '@type': 'WebSite',
      '@id': 'https://barbers.silentra.me/#website',
      url: 'https://barbers.silentra.me/',
      name: 'Silentra for Barbers',
      alternateName: 'Silentra for Barbers',
      inLanguage: ['pt-PT', 'en'],
    },
    {
      '@type': 'Organization',
      '@id': 'https://barbers.silentra.me/#organization',
      url: 'https://barbers.silentra.me/',
      name: 'Silentra for Barbers',
      alternateName: 'Silentra for Barbers',
      logo: 'https://barbers.silentra.me/icon-2.png',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://barbers.silentra.me/#software',
      name: 'Silentra for Barbers',
      url: 'https://barbers.silentra.me/',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web browser',
      description: 'Software de gestão para barbearias com agenda online, gestão de clientes e equipa e marcações sem conta do cliente.',
      inLanguage: ['pt-PT', 'en'],
      provider: { '@id': 'https://barbers.silentra.me/#organization' },
      isAccessibleForFree: true,
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': graph,
        }),
      }}
    />
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-50 antialiased">
      <HomeStructuredData />
      <SiteNavbar />
      <LocalizedHomepage />
      <LocalizedPricingSection />
      <FooterSection />
    </div>
  );
}
