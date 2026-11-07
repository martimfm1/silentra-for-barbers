import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ferramentas e crescimento',
  description:
    'Acede às ferramentas de experiência do cliente, vendas e presença digital da tua barbearia.',
  robots: { index: false, follow: false },
};

export default function ToolsGrowthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
