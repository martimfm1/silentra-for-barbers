import { redirect } from 'next/navigation';

export default function PublicProfileSettingsPage() {
  redirect('/dashboard/settings#public-profile');
}
