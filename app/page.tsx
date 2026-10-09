import type { Metadata } from 'next';
import { SiteNavbar } from '@/components/site-navbar';
import { FooterSection } from '@/components/hero/footer-section';
import { LocalizedHomepage } from '@/components/hero/localized-homepage';
import { LocalizedPricingSection } from '@/components/hero/localized-pricing-section';

export const metadata: Metadata = {
  title: 'Silentra for Barbers — Gestão e Agendamento Online para Barbearias',
  description:
    'Gere a tua barbearia, receba marcações online e acompanha clientes, equipa e receita num único painel com a Silentra.',
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
      alternateName: 'Silentra',
      inLanguage: ['pt-PT', 'en'],
    },
    {
      '@type': 'Organization',
      '@id': 'https://barbers.silentra.me/#organization',
      url: 'https://barbers.silentra.me/',
      name: 'Silentra for Barbers',
      alternateName: 'Silentra',
      logo: 'https://barbers.silentra.me/icon-2.png',
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
