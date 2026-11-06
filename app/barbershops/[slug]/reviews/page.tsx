import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getPublicProfileBySlug } from '@/lib/barbershops/public-profile';
import { PublicReviewsPage } from './public-reviews-page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);
  if (!profile) return {};
  return {
    title: `Avaliações de ${profile.name} | Silentra for Barbers`,
    description: `Consulta as opiniões e classificações dos clientes de ${profile.name}.`,
    alternates: {
      canonical: `/barbershops/${encodeURIComponent(profile.slug)}/reviews`,
    },
    robots: { index: true, follow: true },
  };
}

export default async function BarbershopReviewsRoute({ params }: PageProps) {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);
  if (!profile) notFound();

  if (slug !== profile.slug) {
    permanentRedirect(
      `/barbershops/${encodeURIComponent(profile.slug)}/reviews`,
    );
  }

  return (
    <PublicReviewsPage
      slug={profile.slug}
      barbershopName={profile.name}
      city={profile.city}
    />
  );
}
