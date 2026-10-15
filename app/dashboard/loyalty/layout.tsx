import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Fidelização de Clientes",
  description: "Configura o programa de fidelização e acompanha pontos e recompensas dos clientes.",
  robots: { index: false, follow: false },
};

export default function RouteMetadataLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
