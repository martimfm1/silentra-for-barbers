import SettingsPage from './settings-page';
import { SettingsCancellationPolicyPanel } from '@/components/dashboard/settings-cancellation-policy-panel';
import { SettingsPushNotificationsPanel } from '@/components/dashboard/settings-push-notifications-panel';

export default function SettingsRoute() {
  return (
    <>
      <SettingsPage />
      <SettingsPushNotificationsPanel />
      <SettingsCancellationPolicyPanel />
    </>
  );
}
