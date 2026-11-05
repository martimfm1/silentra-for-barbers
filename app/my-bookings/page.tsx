import Link from 'next/link';
import { SiteNavbar } from '@/components/site-navbar';
import { MyBookingsPage } from '@/components/customer-portal/my-bookings-page';

export default async function CustomerBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialEmail = Array.isArray(params.email) ? params.email[0] : params.email;
  return (
    <div className="silentra-page-shell min-h-screen text-foreground">
      <SiteNavbar />
      <div className="silentra-page-grid" aria-hidden="true" />

      <div className="relative z-[1] mx-auto w-full max-w-6xl px-4 pb-4 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        <MyBookingsPage initialEmail={initialEmail} />
      </div>

      <footer className="relative z-[1] mx-auto flex max-w-6xl items-center justify-center border-t border-white/[0.06] px-4 py-8 text-xs text-zinc-600 sm:px-6 lg:px-8">
        <Link
          href="/barbershops"
          className="transition-colors hover:text-zinc-400"
        >
          Explorar barbearias
        </Link>
      </footer>
    </div>
  );
}
