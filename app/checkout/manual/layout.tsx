import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pedido de Subscrição Manual',
  description:
    'Acompanha o pedido de ativação manual da subscrição da tua barbearia.',
  robots: { index: false, follow: false },
};

export default function RouteMetadataLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
