import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gestão de Clientes',
  description:
    'Organiza a informação e o histórico dos clientes da tua barbearia.',
  robots: { index: false, follow: false },
};

export default function RouteMetadataLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
