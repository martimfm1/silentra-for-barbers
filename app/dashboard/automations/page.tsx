import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Automações",
  description: "Configura automatizações para simplificar tarefas e comunicações da tua barbearia.",
  robots: { index: false, follow: false },
};

import { redirect } from 'next/navigation';

export default function AutomationsPage() {
  redirect('/dashboard/marketing');
}
