import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

export async function getOwnedBarbershopForDeletion(userId: string) {
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('id, role, barbershop_id, email')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile?.barbershop_id || profile.role !== 'owner') {
    throw new Error('BARBERSHOP_OWNER_REQUIRED');
  }

  const { data: shop, error: shopError } = await admin
    .from('barbershops')
    .select('id, name, created_by, default_language')
    .eq('id', profile.barbershop_id)
    .maybeSingle();

  if (shopError || !shop || shop.created_by !== userId) {
    throw new Error('BARBERSHOP_OWNER_REQUIRED');
  }

  return {
    barbershopId: shop.id as string,
    barbershopName: shop.name as string,
    language: shop.default_language === 'en' ? 'en' as const : 'pt' as const,
  };
}

export async function verifyAccountPassword(email: string, password: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('SUPABASE_AUTH_NOT_CONFIGURED');

  const authClient = createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  return !error && Boolean(data.user?.id);
}
