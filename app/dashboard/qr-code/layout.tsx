import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Código QR de Marcações',
  description:
    'Acede ao código QR da barbearia para facilitar o acesso às marcações online.',
  robots: { index: false, follow: false },
};

export default function RouteMetadataLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
