import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Entrar ou Criar Conta',
  description:
    'Inicia sessão na Silentra for Barbers para gerir a agenda, os serviços e os clientes da tua barbearia.',
  alternates: { canonical: 'https://barbers.silentra.me/login' },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Entrar na Silentra for Barbers',
    description: 'Acede à tua conta para gerir marcações, serviços e clientes da barbearia.',
    url: 'https://barbers.silentra.me/login',
    siteName: 'Silentra for Barbers',
    locale: 'pt_PT',
    type: 'website',
  },
  twitter: { card: 'summary', title: 'Entrar | Silentra for Barbers', description: 'Acede à gestão da tua barbearia.' },
};

export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
