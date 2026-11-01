import type { Metadata } from 'next';
import { Ban, ShieldCheck, Users } from 'lucide-react';
import { LegalDocumentPage } from '@/components/legal/legal-document-page';
import { acceptableUsePolicy } from '@/lib/legal/acceptable-use';

const CANONICAL_URL = 'https://barbers.silentra.me/acceptable-use';

export const metadata: Metadata = {
  title: 'Política de Utilização Aceitável',
  description: 'Regras de acesso, segurança, privacidade, conteúdo e utilização da plataforma Silentra for Barbers.',
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    title: 'Política de Utilização Aceitável | Silentra for Barbers',
    description: 'Regras de acesso, segurança, privacidade, conteúdo e utilização da plataforma Silentra for Barbers.',
    url: CANONICAL_URL,
    siteName: 'Silentra',
    locale: 'pt_PT',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function AcceptableUsePage() {
  return (
    <LegalDocumentPage
      pageLabel={{ pt: 'Regras da plataforma', en: 'Platform rules' }}
      title={{ pt: 'Política de Utilização Aceitável', en: 'Acceptable Use Policy' }}
      subtitle={{
        pt: 'As regras para manter contas, dados, reservas e integrações seguros e usados de forma responsável.',
        en: 'The rules for keeping accounts, data, bookings, and integrations secure and responsibly used.',
      }}
      documentByLocale={acceptableUsePolicy}
      highlights={[
        {
          label: { pt: 'Acesso', en: 'Access' },
          value: { pt: 'Usa apenas contas, dados e permissões para os quais tens autorização.', en: 'Use only accounts, data, and permissions you are authorized to access.' },
          icon: <Users className="size-4" />,
        },
        {
          label: { pt: 'Segurança', en: 'Security' },
          value: { pt: 'Não contornes proteções, limites, isolamento ou controlos técnicos.', en: 'Do not bypass protections, limits, isolation, or technical controls.' },
          icon: <ShieldCheck className="size-4" />,
        },
        {
          label: { pt: 'Abuso', en: 'Abuse' },
          value: { pt: 'Spam, fraude, scraping abusivo e acesso indevido são proibidos.', en: 'Spam, fraud, abusive scraping, and unauthorized access are prohibited.' },
          icon: <Ban className="size-4" />,
        },
      ]}
      supportLabel={{ pt: 'Questões de segurança e utilização', en: 'Security and acceptable-use questions' }}
      supportValue="contact@silentra.me"
      backLabel={{ pt: 'Voltar ao centro legal', en: 'Back to legal centre' }}
    />
  );
}
