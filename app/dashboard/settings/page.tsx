import SettingsPage from './settings-page';
import { SettingsCancellationPolicyPanel } from '@/components/dashboard/settings-cancellation-policy-panel';

export default function SettingsRoute() {
  return (
    <>
      <SettingsPage />
      <SettingsCancellationPolicyPanel />
    </>
  );
}
