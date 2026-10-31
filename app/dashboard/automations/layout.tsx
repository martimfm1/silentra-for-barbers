import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Automações',
  description:
    'Configura automatizações para simplificar tarefas e comunicações da tua barbearia.',
  robots: { index: false, follow: false },
};

export default function RouteMetadataLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
