import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Comunicação com Clientes",
  description: "Gere comunicações e acompanha o contacto com os clientes da tua barbearia.",
  robots: { index: false, follow: false },
};

export default function RouteMetadataLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
