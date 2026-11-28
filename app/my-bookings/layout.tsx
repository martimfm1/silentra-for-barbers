import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'As Minhas Marcações | Silentra',
  description:
    'Consulta e gere as tuas marcações de barbearia através da Silentra.',
  robots: { index: false, follow: false },
  manifest: '/customer.webmanifest',
};

export default function MyBookingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
