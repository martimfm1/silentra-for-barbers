import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recuperar Palavra-passe',
  description:
    'Pede uma ligação segura para recuperar o acesso à tua conta Silentra for Barbers.',
  alternates: { canonical: 'https://barbers.silentra.me/forgot-password' },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Recuperar Palavra-passe | Silentra for Barbers',
    description: 'Recupera o acesso à tua conta de forma segura.',
    url: 'https://barbers.silentra.me/forgot-password',
    siteName: 'Silentra for Barbers',
    locale: 'pt_PT',
    type: 'website',
  },
};

export default function ForgotPasswordLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
