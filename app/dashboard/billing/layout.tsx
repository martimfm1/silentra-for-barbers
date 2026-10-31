import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Faturação e Subscrição',
  description:
    'Consulta a subscrição, os pagamentos e o histórico de faturação da Silentra for Barbers.',
  robots: { index: false, follow: false },
};

export default function RouteMetadataLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
