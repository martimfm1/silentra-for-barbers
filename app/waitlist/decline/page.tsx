export const metadata = {
  title: 'Recusar proposta | Silentra for Barbers',
  robots: {
    index: false,
    follow: false,
  },
};

import WaitlistDeclineClient from './waitlist-decline-client';
import { UUID_PATTERN } from '@/lib/validation';

type SearchParams = {
  shop?: string;
  vacancy?: string;
  entry?: string;
  expires?: string;
  signature?: string;
};

export default async function WaitlistDeclinePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  const valid =
    typeof query.shop === 'string' &&
    UUID_PATTERN.test(query.shop) &&
    typeof query.vacancy === 'string' &&
    UUID_PATTERN.test(query.vacancy) &&
    typeof query.entry === 'string' &&
    UUID_PATTERN.test(query.entry) &&
    typeof query.expires === 'string' &&
    /^\d{10}$/.test(query.expires) &&
    typeof query.signature === 'string' &&
    /^[a-f0-9]{64}$/i.test(query.signature);

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-[#09090b] px-4 py-10 text-zinc-100">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          SILENTRA FOR BARBERS
        </p>
        <WaitlistDeclineClient
          offer={
            valid
              ? {
                  shopId: query.shop!,
                  vacancyId: query.vacancy!,
                  waitlistId: query.entry!,
                  expires: query.expires!,
                  signature: query.signature!,
                }
              : null
          }
        />
      </div>
    </main>
  );
}
