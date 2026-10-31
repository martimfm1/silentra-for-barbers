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
  alternates: { canonical: 'https://barbers.silentra.me/agendadovictor' },
  openGraph: {
    type: 'website',
    title: 'Agenda do Victor | SILVEIRA SALON',
    description: 'Marca o teu próximo serviço na SILVEIRA SALON.',
    url: 'https://barbers.silentra.me/agendadovictor',
    siteName: 'SILENTRA',
    locale: 'pt_PT',
  },
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
  const [
    { data: services, error: servicesError },
    { data: shop, error: shopError },
    { data: hours, error: hoursError },
  ] = await Promise.all([
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
      database
        .from('barbershops')
        .select('opening_time,closing_time,closed_days')
        .eq('id', profile.barbershop_id)
        .maybeSingle(),
    ]);

  if (servicesError || shopError || hoursError || !shop || !services || !hours) {
    console.error('[AGENDA_DO_VICTOR]', {
      services: servicesError?.code ?? null,
      shop: shopError?.code ?? null,
      hours: hoursError?.code ?? null,
    });
    notFound();
  }

  const { owner_user_id: _ownerUserId, ...publicProfile } = profile;
  return (
    <AgendaDoVictorPage
      profile={publicProfile}
      shop={{ ...shop, opening_time: hours.opening_time, closing_time: hours.closing_time }}
      services={services.map((service) => ({
        id: service.id,
        name: service.name,
        price: Number(service.price ?? 0),
        duration: Number(service.duration ?? 30),
      }))}
    />
  );
}
