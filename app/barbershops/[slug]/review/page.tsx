import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { getPublicProfileBySlug } from '@/lib/barbershops/public-profile';
import { reviewAccessCookieName } from '@/lib/reviews/review-token-cookie';
import { PublicReviewForm } from './ReviewForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Deixar avaliação | Silentra for Barbers',
  description: 'Partilha a tua experiência com a barbearia.',
  robots: {
    index: false,
    follow: false,
  },
  referrer: 'no-referrer',
};

type ReviewPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ review?: string }>;
};

export default async function BarbershopReviewPage({
  params,
  searchParams,
}: ReviewPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const profile = await getPublicProfileBySlug(slug);

  if (!profile) notFound();

  if (slug !== profile.slug) {
    permanentRedirect(
      `/barbershops/${encodeURIComponent(profile.slug)}/review`,
    );
  }

  const cookieStore = await cookies();
  const reviewAccess = cookieStore.get(
    reviewAccessCookieName(profile.id),
  )?.value;
  const hasReviewAccess = reviewAccess === '1';
  const reviewStatus = ['already-used', 'expired', 'invalid', 'unavailable'].includes(query.review ?? '')
    ? (query.review as 'already-used' | 'expired' | 'invalid' | 'unavailable')
    : null;

  return (
    <PublicReviewForm
      barbershopId={profile.id}
      barbershopName={profile.name}
      slug={profile.slug}
      hasReviewAccess={hasReviewAccess && !reviewStatus}
      reviewStatus={reviewStatus}
    />
  );
}
