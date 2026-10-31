import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Loja Online de Produtos para Barbearias',
  description:
    'Descobre produtos de barbearia disponíveis no marketplace Silentra. Consulta produtos e opções de compra das lojas participantes.',
  alternates: { canonical: 'https://barbers.silentra.me/marketplace' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Marketplace de Produtos para Barbearias | Silentra for Barbers',
    description:
      'Explora produtos publicados por lojas de barbearia no marketplace Silentra.',
    url: 'https://barbers.silentra.me/marketplace',
    siteName: 'Silentra for Barbers',
    locale: 'pt_PT',
    type: 'website',
  },
};

export default function MarketplaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
