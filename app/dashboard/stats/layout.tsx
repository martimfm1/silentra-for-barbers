import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Estatísticas da Barbearia',
  description:
    'Consulta estatísticas de marcações e atividade para acompanhar o negócio.',
  robots: { index: false, follow: false },
};

export default function RouteMetadataLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
