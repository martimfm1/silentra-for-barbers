'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client'; // 👈 Alterado para o cliente de browser!
import { SilentraLoading } from '@/components/ui/silentra-loading';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient(); // 👈 Instanciado de forma segura no cliente

    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      // Faz a query à tabela 'users' de forma segura pelo browser
      const { data: profile } = await supabase
        .from('users')
        .select('barbershop_id') // ⚠️ Atenção a esta coluna (vê a nota abaixo!)
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile?.barbershop_id) {
        router.replace('/dashboard');
        return;
      }

      setLoading(false);
    }

    checkAuth();
  }, [router]);

  if (loading) {
    return <SilentraLoading />;
  }

  return <>{children}</>;
}
