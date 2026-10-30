import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublicProfileBySlug } from '@/lib/barbershops/public-profile';
import AgendaDoVictorPage from './agenda-do-victor-page';

const SLUG = 'silveira-salon-6f1e9637';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Agenda do Victor | SILVEIRA SALON',
  description: 'Marca o teu próximo serviço na SILVEIRA SALON.',
  robots: { index: true, follow: true },
};

export default async function AgendaDoVictorRoute() {
  const profile = await getPublicProfileBySlug(SLUG);
  if (
    !profile ||
    profile.barbershop_id !== 'f9cf1bca-22ec-4782-87ca-c338d51fc30d' ||
    !['pro', 'enterprise'].includes(profile.plan)
  ) {
    notFound();
  }

  const database = createAdminClient();
  const [{ data: services, error: servicesError }, { data: shop, error: shopError }] =
    await Promise.all([
      database
        .from('services')
        .select('id,name,price,duration')
        .eq('barbershop_id', profile.barbershop_id)
        .order('name', { ascending: true }),
      database
        .from('shops')
        .select('id,slug,city,address,lat,lng')
        .eq('barbershop_id', profile.barbershop_id)
        .maybeSingle(),
    ]);

  if (servicesError || shopError || !shop || !services) {
    console.error('[AGENDA_DO_VICTOR]', {
      services: servicesError?.code ?? null,
      shop: shopError?.code ?? null,
    });
    notFound();
  }

  const { owner_user_id: _ownerUserId, ...publicProfile } = profile;
  return (
    <AgendaDoVictorPage
      profile={publicProfile}
      shop={shop}
      services={services.map((service) => ({
        id: service.id,
        name: service.name,
        price: Number(service.price ?? 0),
        duration: Number(service.duration ?? 30),
      }))}
    />
  );
}
