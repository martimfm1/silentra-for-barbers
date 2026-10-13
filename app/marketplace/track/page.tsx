import type { Metadata } from 'next';
import MarketplaceOrderTrackingClient from './tracking-client';

export const metadata: Metadata = {
  title: 'Acompanhar encomenda | Silentra Marketplace',
  description:
    'Consulta o estado e o histórico da tua encomenda no Silentra Marketplace.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
    },
  },
  referrer: 'no-referrer',
};

export default function MarketplaceOrderTrackingPage() {
  return <MarketplaceOrderTrackingClient />;
}
