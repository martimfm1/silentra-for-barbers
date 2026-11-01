import type { Metadata } from 'next';
import { CalendarCheck, Store, CreditCard } from 'lucide-react';
import { LegalDocumentPage } from '@/components/legal/legal-document-page';
import { bookingPolicy } from '@/lib/legal/additional-policies';

const CANONICAL_URL = 'https://barbers.silentra.me/booking-terms';

export const metadata: Metadata = {
  title: 'Política de Reservas',
  description: 'Informação sobre reservas, confirmação, cancelamentos, pré-pagamento MB WAY e dados utilizados na marcação.',
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    title: 'Política de Reservas | Silentra for Barbers',
    description: 'Informação sobre reservas, confirmação, cancelamentos, pré-pagamento MB WAY e dados utilizados na marcação.',
    url: CANONICAL_URL,
    siteName: 'Silentra',
    locale: 'pt_PT',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function BookingTermsPage() {
  return (
    <LegalDocumentPage
      pageLabel={{ pt: 'Reservas', en: 'Bookings' }}
      title={{ pt: 'Política de Reservas', en: 'Booking Policy' }}
      subtitle={{
        pt: 'O que deves saber antes de marcares um serviço numa barbearia através da Silentra.',
        en: 'What to know before booking a service at a barbershop through Silentra.',
      }}
      documentByLocale={bookingPolicy}
      highlights={[
        {
          label: { pt: 'Quem presta o serviço', en: 'Service provider' },
          value: { pt: 'A barbearia escolhida é responsável pelo serviço e pelas condições da marcação.', en: 'The selected barbershop is responsible for the service and booking conditions.' },
          icon: <Store className="size-4" />,
        },
        {
          label: { pt: 'Cancelamentos', en: 'Cancellations' },
          value: { pt: 'O prazo e as condições são definidos pela barbearia e apresentados antes da confirmação.', en: 'Notice periods and conditions are set by the barbershop and shown before confirmation.' },
          icon: <CalendarCheck className="size-4" />,
        },
        {
          label: { pt: 'Pré-pagamento', en: 'Prepayment' },
          value: { pt: 'Quando existe MB WAY, o pagamento é feito diretamente à barbearia.', en: 'Where MB WAY is offered, payment is made directly to the barbershop.' },
          icon: <CreditCard className="size-4" />,
        },
      ]}
      supportLabel={{ pt: 'Ajuda sobre a marcação', en: 'Booking support' }}
      supportValue="contact@silentra.me"
      backLabel={{ pt: 'Voltar ao centro legal', en: 'Back to legal centre' }}
    />
  );
}
