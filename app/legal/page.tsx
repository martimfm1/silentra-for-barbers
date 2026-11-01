import type { Metadata } from 'next';
import { LegalCentrePage } from '@/components/legal/legal-centre-page';

export const metadata: Metadata = {
  title: 'Centro Legal',
  description: 'Termos, políticas, privacidade, faturação e documentação legal da Silentra for Barbers.',
  alternates: { canonical: 'https://barbers.silentra.me/legal' },
  openGraph: {
    title: 'Centro Legal | Silentra for Barbers',
    description: 'Termos, políticas, privacidade, faturação e documentação legal da Silentra for Barbers.',
    url: 'https://barbers.silentra.me/legal',
    siteName: 'Silentra',
    locale: 'pt_PT',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function LegalPage() {
  return <LegalCentrePage />;
}
