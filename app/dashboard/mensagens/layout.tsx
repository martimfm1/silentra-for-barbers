import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mensagens e Lembretes',
  description:
    'Gere mensagens, lembretes e comunicações relacionadas com a atividade da barbearia.',
  robots: { index: false, follow: false },
};

export default function RouteMetadataLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
