import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublicProfileBySlug } from '@/lib/barbershops/public-profile';
import AgendaDoVictorPage from './agenda-do-victor-page';

const SLUG = 'silveira-salon-6f1e9637';

export const dynamic = 'force-dynamic';

const SEO_TITLE = 'Agenda do Victor';
const SEO_DESCRIPTION =
  'Faz a tua marcação online na Agenda do Victor. Escolhe o serviço e encontra o melhor horário para ti.';

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESCRIPTION,
  alternates: { canonical: 'https://barbers.silentra.me/agendadovictor' },
  openGraph: {
    type: 'website',
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    url: 'https://barbers.silentra.me/agendadovictor',
    siteName: SEO_TITLE,
    locale: 'pt_PT',
    images: [{ url: '/images/agenda-do-victor-og.png', width: 1200, height: 630, alt: 'Agenda do Victor — marcações online' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    images: ['/images/agenda-do-victor-og.png'],
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
  if (profile.plan === 'enterprise') {
    permanentRedirect('/site/' + encodeURIComponent(profile.slug));
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
      .eq('is_active', true)
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

  if (
    servicesError ||
    shopError ||
    hoursError ||
    !shop ||
    !services ||
    !hours
  ) {
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
      shop={{
        ...shop,
        opening_time: hours.opening_time,
        closing_time: hours.closing_time,
        closed_days: hours.closed_days,
      }}
      services={services.map((service) => ({
        id: service.id,
        name: service.name,
        price: Number(service.price ?? 0),
        duration: Number(service.duration ?? 30),
      }))}
    />
  );
}
