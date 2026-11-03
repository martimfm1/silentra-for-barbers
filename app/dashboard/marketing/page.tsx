import type { Metadata } from 'next';
import { CampaignLifecycleActions } from '@/app/dashboard/marketing/campaign-lifecycle-actions';
import { MarketingWorkspace } from '@/app/dashboard/marketing/marketing-workspace';

export const metadata: Metadata = {
  title: 'Campanhas',
  description:
    'Cria, agenda e acompanha campanhas de comunicação para os clientes da tua barbearia.',
  robots: { index: false, follow: false },
};

export default function MarketingPage() {
  return (
    <>
      <CampaignLifecycleActions />
      <MarketingWorkspace initialView="campaigns" />
    </>
  );
}
