import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Gestão de Equipa",
  description: "Gere profissionais, acessos e organização da equipa da tua barbearia.",
  robots: { index: false, follow: false },
};

export default function RouteMetadataLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
