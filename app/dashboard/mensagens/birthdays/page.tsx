import { redirect } from 'next/navigation';

// Keep old bookmarks working, but manage birthday automations in the Automations area.
export default function BirthdaysPage() {
  redirect('/dashboard/automations');
}
