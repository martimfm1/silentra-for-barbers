import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Finalizar Subscrição',
  description:
    'Revê e conclui a ativação do plano da tua barbearia na Silentra for Barbers.',
  alternates: { canonical: 'https://barbers.silentra.me/checkout' },
  robots: { index: false, follow: false },
  openGraph: { title: 'Finalizar Subscrição | Silentra for Barbers', description: 'Conclui a ativação do plano da tua barbearia.', url: 'https://barbers.silentra.me/checkout', siteName: 'Silentra for Barbers', locale: 'pt_PT', type: 'website' },
};

export default function CheckoutLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
