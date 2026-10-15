import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "CRM de Clientes",
  description: "Consulta e organiza relações, notas e atividade dos clientes da barbearia.",
  robots: { index: false, follow: false },
};

export default function RouteMetadataLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
