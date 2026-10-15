import type { Metadata } from 'next';
import { Database, LockKeyhole, ShieldCheck } from 'lucide-react';
import { LegalDocumentPage } from '@/components/legal/legal-document-page';
import { privacyPolicy } from '@/lib/legal/privacy-policy';
import {
  CURRENT_LEGAL_UPDATE,
  currentPrivacyAddendum,
} from '@/lib/legal/current-legal-addendum';

const CANONICAL_URL = 'https://barbers.silentra.me/privacy';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description:
    'Política de privacidade da Silentra for Barbers, com dados recolhidos, finalidades, partilha, retenção e direitos.',
  alternates: {
    canonical: CANONICAL_URL,
  },
  openGraph: {
    title: 'Privacidade | Silentra for Barbers',
    description:
      'Política de privacidade da Silentra for Barbers, com dados recolhidos, finalidades, partilha, retenção e direitos.',
    url: CANONICAL_URL,
    siteName: 'Silentra',
    locale: 'pt_PT',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

const currentPrivacyPolicy = {
  pt: {
    ...privacyPolicy.pt,
    lastUpdated: CURRENT_LEGAL_UPDATE,
    sections: [...privacyPolicy.pt.sections, currentPrivacyAddendum.pt],
  },
  en: {
    ...privacyPolicy.en,
    lastUpdated: 'August 21, 2026',
    sections: [...privacyPolicy.en.sections, currentPrivacyAddendum.en],
  },
};

export default function PrivacyPage() {
  return (
    <LegalDocumentPage
      pageLabel={{ pt: 'Privacidade', en: 'Privacy' }}
      title={{
        pt: 'Política de Privacidade',
        en: 'Privacy Policy',
      }}
      subtitle={{
        pt: 'Explicamos que dados recolhemos, porquê, durante quanto tempo os guardamos e como podes exercer os teus direitos.',
        en: 'We explain what data we collect, why we collect it, how long we keep it, and how you can exercise your rights.',
      }}
      documentByLocale={currentPrivacyPolicy}
      highlights={[
        {
          label: {
            pt: 'Modelo de tratamento',
            en: 'Processing model',
          },
          value: {
            pt: 'A Silentra atua como responsável pela conta e como parceira tecnológica quando a reserva é feita para uma barbearia.',
            en: 'Silentra acts as controller for account data and as a technology partner when a booking is made for a barbershop.',
          },
          icon: <ShieldCheck className="size-5 text-emerald-400" />,
        },
        {
          label: {
            pt: 'Segurança',
            en: 'Security',
          },
          value: {
            pt: 'Usamos controlos de acesso, monitorização e medidas de proteção adequadas ao nível do serviço.',
            en: 'We use access controls, monitoring, and protective measures appropriate for the service.',
          },
          icon: <LockKeyhole className="size-5 text-emerald-400" />,
        },
        {
          label: {
            pt: 'Onde guardamos os dados',
            en: 'Where your data is stored',
          },
          value: {
            pt: 'Os teus dados são alojados em serviços cloud seguros, com o tratamento mínimo necessário para operar e melhorar a plataforma.',
            en: 'Your data is hosted on secure cloud services, with only the processing needed to run and improve the platform.',
          },
          icon: <Database className="size-5 text-emerald-400" />,
        },
      ]}
      supportLabel={{ pt: 'Pedidos de privacidade', en: 'Privacy requests' }}
      supportValue="contact@silentra.me"
      backLabel={{ pt: 'Voltar à home', en: 'Back home' }}
    />
  );
}
