import type { MarketplaceService, MarketplaceShop } from './shops';

/** A selectable day in the booking flow. */
export interface BookingDayOption {
  dateStr: string;
  weekdayShort: string;
  dayNumeric: number;
  fullDateFormatted: string;
  isToday: boolean;
}

export interface MarketplaceProfessional {
  id: string;
  name: string;
  role?: string;
}

export interface BookingBlockedInterval {
  id: string;
  professionalId: string | null;
  startTime: string | null;
  endTime: string | null;
  reason: string;
  allDay: boolean;
}

export interface BookingDrawerProps {
  shop: MarketplaceShop | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: BookingSuccessData) => void;
  selectedServiceId?: string | null;
  appearance?: 'default' | 'agenda';
}

export interface BookingSuccessData {
  shopName: string;
  serviceName: string;
  date: string;
  time: string;
  customerEmail: string;
}

export interface MarketplaceBookingResponse {
  services: MarketplaceService[];
  availableSlots: string[];
  isClosed: boolean;
  closedDay?: boolean;
  blockedIntervals?: BookingBlockedInterval[];
  professionals?: MarketplaceProfessional[];
  professionalAvailability?: Record<string, string[]>;
  manualPrepayment?: {
    enabled: boolean;
    mbwayPhone: string;
    whatsappPhone: string;
  };
}

export interface UseBookingSlotsReturn {
  nextDays: BookingDayOption[];
  selectedDayIndex: number;
  setSelectedDayIndex: (index: number) => void;
  currentDay: BookingDayOption;
  slots: string[];
  isClosed: boolean;
  isLoading: boolean;
  selectedSlot: string | null;
  setSelectedSlot: (slot: string | null) => void;
}
