import type { Metadata } from 'next';
import { Cookie, Fingerprint, ShieldCheck } from 'lucide-react';
import { LegalDocumentPage } from '@/components/legal/legal-document-page';
import { cookiePolicy } from '@/lib/legal/cookie-policy';
import { CookiePreferencesLink } from '@/components/privacy/cookie-preferences-link';

const CANONICAL_URL = 'https://barbers.silentra.me/cookies';

export const metadata: Metadata = {
  title: 'Política de Cookies',
  description:
    'Categorias de cookies, tecnologias de medição, consentimento e gestão de preferências na Silentra for Barbers.',
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    title: 'Política de Cookies | Silentra for Barbers',
    description:
      'Categorias de cookies, tecnologias de medição, consentimento e gestão de preferências na Silentra for Barbers.',
    url: CANONICAL_URL,
    siteName: 'Silentra',
    locale: 'pt_PT',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function CookiePolicyPage() {
  return (
    <LegalDocumentPage
      pageLabel={{ pt: 'Privacidade', en: 'Privacy' }}
      title={{ pt: 'Política de Cookies', en: 'Cookie Policy' }}
      subtitle={{
        pt: 'Explicamos que tecnologias usamos, quando são ativadas e como podes escolher ou retirar o consentimento.',
        en: 'We explain which technologies we use, when they are activated, and how you can choose or withdraw consent.',
      }}
      documentByLocale={cookiePolicy}
      headerAction={<CookiePreferencesLink />}
      highlights={[
        {
          label: { pt: 'Necessários', en: 'Necessary' },
          value: {
            pt: 'Sessão, autenticação, segurança e preferências essenciais.',
            en: 'Session, authentication, security, and essential preferences.',
          },
          icon: <ShieldCheck className="size-4" />,
        },
        {
          label: { pt: 'Controlo', en: 'Control' },
          value: {
            pt: 'Estatísticas e marketing são opcionais e dependem da tua escolha.',
            en: 'Analytics and marketing are optional and depend on your choice.',
          },
          icon: <Cookie className="size-4" />,
        },
        {
          label: { pt: 'Revisão', en: 'Review' },
          value: {
            pt: 'Podes alterar as preferências nesta página, sem manter um banner fixo no ecrã.',
            en: 'You can change preferences from this page without a persistent on-screen banner.',
          },
          icon: <Fingerprint className="size-4" />,
        },
      ]}
      supportLabel={{ pt: 'Contacto de privacidade', en: 'Privacy contact' }}
      supportValue="silentra.contact@gmail.com"
      backLabel={{ pt: 'Voltar à home', en: 'Back home' }}
    />
  );
}
