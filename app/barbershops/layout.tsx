import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Barbearias em Portugal — Encontra e Marca Online',
  description:
    'Descobre barbearias, compara serviços e disponibilidade e marca online em poucos segundos através da Silentra.',
  alternates: { canonical: 'https://barbers.silentra.me/barbershops' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Barbearias em Portugal — Encontra e Marca Online | Silentra',
    description:
      'Encontra a barbearia certa, consulta disponibilidade e marca online sem complicações.',
    url: 'https://barbers.silentra.me/barbershops',
    siteName: 'Silentra',
    locale: 'pt_PT',
    type: 'website',
  },
};

export default function BarbershopsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
