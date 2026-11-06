import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { getPublicProfileBySlug } from '@/lib/barbershops/public-profile';
import { reviewTokenCookieName } from '@/lib/reviews/review-token-cookie';
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
};

export default async function BarbershopReviewPage({
  params,
}: ReviewPageProps) {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);

  if (!profile) notFound();

  if (slug !== profile.slug) {
    permanentRedirect(
      `/barbershops/${encodeURIComponent(profile.slug)}/review`,
    );
  }

  const cookieStore = await cookies();
  const reviewCookie = cookieStore.get(
    reviewTokenCookieName(profile.id),
  )?.value;
  const hasReviewAccess = Boolean(
    reviewCookie && /^[A-Za-z0-9_-]{43}$/.test(reviewCookie),
  );

  return (
    <PublicReviewForm
      barbershopId={profile.id}
      barbershopName={profile.name}
      slug={profile.slug}
      hasReviewAccess={hasReviewAccess}
    />
  );
}
