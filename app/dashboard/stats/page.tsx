import { redirect } from 'next/navigation';

export default function LegacyStatsPage(): never {
  redirect('/dashboard/analytics');
}
