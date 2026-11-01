import type { Metadata } from 'next';
import { Cloud, CreditCard, ShieldCheck } from 'lucide-react';
import { LegalDocumentPage } from '@/components/legal/legal-document-page';
import { subprocessorsPolicy } from '@/lib/legal/additional-policies';

const CANONICAL_URL = 'https://barbers.silentra.me/subprocessors';

export const metadata: Metadata = {
  title: 'Lista de Subprocessadores',
  description: 'Fornecedores tecnológicos conhecidos que podem tratar dados pessoais ao prestar serviços à Silentra for Barbers.',
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    title: 'Lista de Subprocessadores | Silentra for Barbers',
    description: 'Fornecedores tecnológicos conhecidos que podem tratar dados pessoais ao prestar serviços à Silentra for Barbers.',
    url: CANONICAL_URL,
    siteName: 'Silentra',
    locale: 'pt_PT',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function SubprocessorsPage() {
  return (
    <LegalDocumentPage
      pageLabel={{ pt: 'Fornecedores', en: 'Vendors' }}
      title={{ pt: 'Lista de Subprocessadores', en: 'Subprocessor List' }}
      subtitle={{
        pt: 'Que fornecedores podem intervir, para que servem e quando são ativados.',
        en: 'Which providers may be involved, what they do, and when they are activated.',
      }}
      documentByLocale={subprocessorsPolicy}
      highlights={[
        {
          label: { pt: 'Serviços essenciais', en: 'Core providers' },
          value: { pt: 'Vercel e Supabase suportam a plataforma; Mapbox pesquisa moradas e CARTO apresenta os mapas.', en: 'Vercel and Supabase run the platform; Mapbox searches addresses and CARTO displays maps.' },
          icon: <Cloud className="size-4" />,
        },
        {
          label: { pt: 'Pagamentos e email', en: 'Payments and email' },
          value: { pt: 'Stripe processa faturação; Brevo envia email operacional.', en: 'Stripe handles billing; Brevo sends operational email.' },
          icon: <CreditCard className="size-4" />,
        },
        {
          label: { pt: 'Consentimento', en: 'Consent' },
          value: { pt: 'Estatísticas e marketing dependem das categorias de cookies escolhidas.', en: 'Analytics and marketing depend on the selected cookie categories.' },
          icon: <ShieldCheck className="size-4" />,
        },
      ]}
      supportLabel={{ pt: 'Questões sobre fornecedores', en: 'Provider questions' }}
      supportValue="contact@silentra.me"
      backLabel={{ pt: 'Voltar ao centro legal', en: 'Back to legal centre' }}
    />
  );
}
