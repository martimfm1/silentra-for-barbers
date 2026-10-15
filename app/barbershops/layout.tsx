import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Encontrar Barbearias e Marcar Online',
  description:
    'Encontra barbearias, consulta serviços e horários disponíveis e faz a tua marcação online em Portugal.',
  alternates: { canonical: 'https://barbers.silentra.me/barbershops' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Encontrar Barbearias e Marcar Online | Silentra for Barbers',
    description:
      'Encontra a barbearia certa, consulta disponibilidade e marca online sem complicações.',
    url: 'https://barbers.silentra.me/barbershops',
    siteName: 'Silentra for Barbers',
    locale: 'pt_PT',
    type: 'website',
  },
};

export default function BarbershopsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
