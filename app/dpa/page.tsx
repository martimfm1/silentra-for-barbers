import type { Metadata } from 'next';
import { ShieldCheck, Database, ClipboardCheck, Store } from 'lucide-react';
import { LegalDocumentPage } from '@/components/legal/legal-document-page';
import { dataProcessingAddendum } from '@/lib/legal/additional-policies';

const CANONICAL_URL = 'https://barbers.silentra.me/dpa';

export const metadata: Metadata = {
  title: 'Adenda de Tratamento de Dados (DPA)',
  description: 'Adenda de tratamento de dados pessoais entre uma barbearia responsável pelo tratamento e a Silentra enquanto subcontratante.',
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    title: 'Adenda de Tratamento de Dados (DPA) | Silentra for Barbers',
    description: 'Adenda de tratamento de dados pessoais entre uma barbearia responsável pelo tratamento e a Silentra enquanto subcontratante.',
    url: CANONICAL_URL,
    siteName: 'Silentra',
    locale: 'pt_PT',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function DataProcessingPage() {
  return (
    <LegalDocumentPage
      pageLabel={{ pt: 'Dados de clientes', en: 'Customer data' }}
      title={{ pt: 'Adenda de Tratamento de Dados (DPA)', en: 'Data Processing Addendum (DPA)' }}
      subtitle={{
        pt: 'Condições aplicáveis quando a Silentra trata dados pessoais de clientes ou profissionais por conta da barbearia.',
        en: 'Terms that apply when Silentra processes customer or professional personal data on behalf of a barbershop.',
      }}
      documentByLocale={dataProcessingAddendum}
      highlights={[
        {
          label: { pt: 'Papel da barbearia', en: 'Barbershop role' },
          value: { pt: 'Normalmente responsável pelo tratamento dos dados dos seus clientes.', en: 'Generally the controller of its customers’ data.' },
          icon: <Store className="size-4" />,
        },
        {
          label: { pt: 'Papel da Silentra', en: 'Silentra’s role' },
          value: { pt: 'Subcontratante nos tratamentos realizados por instrução da barbearia.', en: 'Processor for processing carried out on the barbershop’s instructions.' },
          icon: <Database className="size-4" />,
        },
        {
          label: { pt: 'Aceitação', en: 'Acceptance' },
          value: { pt: 'Este modelo deve ser validado e aceite pelas partes antes do tratamento.', en: 'This template must be reviewed and accepted by the parties before processing.' },
          icon: <ClipboardCheck className="size-4" />,
        },
      ]}
      supportLabel={{ pt: 'Pedidos DPA e privacidade', en: 'DPA and privacy requests' }}
      supportValue="contact@silentra.me"
      backLabel={{ pt: 'Voltar ao centro legal', en: 'Back to legal centre' }}
    />
  );
}
