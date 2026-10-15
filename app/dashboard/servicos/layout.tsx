import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Serviços e Preços",
  description: "Organiza os serviços, a duração e os preços apresentados aos clientes da tua barbearia.",
  robots: { index: false, follow: false },
};

export default function RouteMetadataLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
