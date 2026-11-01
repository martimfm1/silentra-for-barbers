import type { Metadata } from 'next';
import { Receipt, CreditCard, RefreshCw } from 'lucide-react';
import { LegalDocumentPage } from '@/components/legal/legal-document-page';
import { billingPolicy } from '@/lib/legal/additional-policies';

const CANONICAL_URL = 'https://barbers.silentra.me/billing-policy';

export const metadata: Metadata = {
  title: 'Política de Faturação',
  description: 'Regras de planos, pagamentos, renovações, cancelamentos, promoções e pedidos de reembolso da Silentra for Barbers.',
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    title: 'Política de Faturação | Silentra for Barbers',
    description: 'Regras de planos, pagamentos, renovações, cancelamentos, promoções e pedidos de reembolso da Silentra for Barbers.',
    url: CANONICAL_URL,
    siteName: 'Silentra',
    locale: 'pt_PT',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function BillingPolicyPage() {
  return (
    <LegalDocumentPage
      pageLabel={{ pt: 'Subscrições', en: 'Subscriptions' }}
      title={{ pt: 'Política de Faturação', en: 'Billing Policy' }}
      subtitle={{
        pt: 'Como funcionam os pagamentos à Silentra, quando renova o plano e como pedir ajuda com a faturação.',
        en: 'How payments to Silentra work, when a plan renews, and how to get help with billing.',
      }}
      documentByLocale={billingPolicy}
      highlights={[
        {
          label: { pt: 'Preço e periodicidade', en: 'Price and interval' },
          value: { pt: 'Consulta o total e a data de renovação antes de confirmar no checkout.', en: 'Review the total and renewal date before confirming at checkout.' },
          icon: <Receipt className="size-4" />,
        },
        {
          label: { pt: 'Pagamento manual', en: 'Manual payment' },
          value: { pt: 'O acesso pago só é ativado depois de a Silentra confirmar o recebimento.', en: 'Paid access is enabled only after Silentra confirms receipt.' },
          icon: <CreditCard className="size-4" />,
        },
        {
          label: { pt: 'Cancelamento', en: 'Cancellation' },
          value: { pt: 'Usa o fluxo da área de faturação e guarda a confirmação.', en: 'Use the billing area flow and keep the confirmation.' },
          icon: <RefreshCw className="size-4" />,
        },
      ]}
      supportLabel={{ pt: 'Suporte de faturação', en: 'Billing support' }}
      supportValue="contact.silentra@gmail.com"
      backLabel={{ pt: 'Voltar ao centro legal', en: 'Back to legal centre' }}
    />
  );
}
