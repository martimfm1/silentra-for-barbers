import type { Metadata } from 'next';
import { CampaignLifecycleActions } from '@/app/dashboard/marketing/campaign-lifecycle-actions';
import { MarketingWorkspace } from '@/app/dashboard/marketing/marketing-workspace';

export const metadata: Metadata = {
  title: 'Automações',
  description:
    'Configura automatizações para simplificar tarefas e comunicações da tua barbearia.',
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
