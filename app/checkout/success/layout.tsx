import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Subscrição Confirmada',
  description:
    'Consulta o estado da ativação do teu plano Silentra for Barbers.',
  robots: { index: false, follow: false },
};

export default function RouteMetadataLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
