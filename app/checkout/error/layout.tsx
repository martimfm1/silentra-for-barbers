import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Problema no Checkout',
  description:
    'Consulta os passos para resolver um problema ao concluir a subscrição Silentra.',
  robots: { index: false, follow: false },
};

export default function RouteMetadataLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
