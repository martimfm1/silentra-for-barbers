import { captureProductEvent } from '@/lib/observability/posthog';

type BookingSurface = 'default' | 'agenda';

export function trackWaitlistJoined(bookingSurface: BookingSurface) {
  captureProductEvent('waitlist_joined', {
    booking_surface: bookingSurface,
  });
}

export function trackBookingCompleted(
  bookingSurface: BookingSurface,
  manualPrepaymentRequested: boolean,
  paymentMethod: string | null,
) {
  captureProductEvent('booking_completed', {
    booking_surface: bookingSurface,
    manual_prepayment_requested: manualPrepaymentRequested,
    payment_method: paymentMethod ?? 'none',
  });
}
