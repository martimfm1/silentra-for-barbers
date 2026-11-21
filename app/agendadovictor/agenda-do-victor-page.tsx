'use client';

import ProBookingPage from '@/app/barbershops/[slug]/pro-booking-page';
import type { PublicProfileRecord } from '@/lib/barbershops/public-profile';

type AgendaService = {
  id: string;
  name: string;
  price: number;
  duration: number;
};

type AgendaShop = {
  opening_time: string | null;
  closing_time: string | null;
  closed_days: string | null;
  time_limit_cancellation_hours: number | null;
  minimum_booking_notice_minutes: number | null;
};

export default function AgendaDoVictorPage({
  profile,
  shop,
  services,
}: {
  profile: Omit<PublicProfileRecord, 'owner_user_id'>;
  shop: AgendaShop;
  services: AgendaService[];
}) {
  return (
    <ProBookingPage
      profile={profile}
      services={services}
      openingTime={shop.opening_time}
      closingTime={shop.closing_time}
      closedDays={shop.closed_days}
      cancellationWindowHours={shop.time_limit_cancellation_hours ?? 24}
      minimumBookingNoticeMinutes={shop.minimum_booking_notice_minutes ?? 0}
      hideClosedDays
      requireBirthDate={false}
      agendaHeroLayout
    />
  );
}
