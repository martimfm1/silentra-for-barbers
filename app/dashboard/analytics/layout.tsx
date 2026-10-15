import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Análise de Desempenho",
  description: "Acompanha os indicadores de atividade e desempenho da tua barbearia na Silentra.",
  robots: { index: false, follow: false },
};

export default function RouteMetadataLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
