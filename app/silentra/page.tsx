import type { Metadata } from 'next';
import SilentraDemoBarbershop from './silentra-demo-barbershop';

export const metadata: Metadata = {
  title: 'Silentra Barbershop — Barbearia de Demonstração',
  description:
    'Conhece a experiência digital de uma barbearia criada com a Silentra: serviços, equipa, galeria e uma simulação de marcação online.',
  alternates: {
    canonical: 'https://barbers.silentra.me/silentra',
  },
  openGraph: {
    type: 'website',
    title: 'Silentra Barbershop — Uma experiência de barbearia',
    description:
      'Uma página de demonstração para mostrar como a tua barbearia pode estar online com a Silentra.',
    url: 'https://barbers.silentra.me/silentra',
    siteName: 'Silentra for Barbers',
    locale: 'pt_PT',
  },
  twitter: {
    card: 'summary',
    title: 'Silentra Barbershop — Barbearia de Demonstração',
    description:
      'Serviços, equipa, galeria e uma simulação de marcação online.',
  },
};

export default function SilentraDemoPage() {
  return <SilentraDemoBarbershop />;
}
