import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Criar Conta para a Barbearia',
  description:
    'Cria a conta da tua barbearia na Silentra for Barbers e prepara a agenda, os serviços e a equipa num único painel.',
  alternates: { canonical: 'https://barbers.silentra.me/registo' },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Criar Conta | Silentra for Barbers',
    description:
      'Cria o espaço da tua barbearia para começar a gerir marcações e clientes.',
    url: 'https://barbers.silentra.me/registo',
    siteName: 'Silentra for Barbers',
    locale: 'pt_PT',
    type: 'website',
  },
};

export default function RegistoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
