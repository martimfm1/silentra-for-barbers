import type { Metadata } from 'next';
import { CampaignLifecycleActions } from '@/app/dashboard/marketing/campaign-lifecycle-actions';
import { MarketingWorkspace } from '@/app/dashboard/marketing/marketing-workspace';

export const metadata: Metadata = {
  title: 'Automações de clientes',
  description:
    'Gere mensagens de aniversário e outros fluxos automáticos para manter a relação com os clientes.',
  robots: { index: false, follow: false },
};

export default function AutomationsPage() {
  return (
    <>
      <CampaignLifecycleActions />
      <MarketingWorkspace initialView="automation" />
    </>
  );
}
