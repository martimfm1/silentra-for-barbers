/** Shapes used from Supabase through to marketplace UI cards. */
export interface MarketplaceBarbershopRelation {
  name: string;
  address: string | null;
  opening_time: string | null;
  closing_time: string | null;
}

export interface MarketplaceShopRecord {
  id: string;
  barbershop_id: string;
  slug: string;
  city: string;
  price: number;
  tags: string[];
  lat: number;
  lng: number;
  rating?: number | null;
  reviews_count?: number | null;
  is_active: boolean;
  barbershops:
    MarketplaceBarbershopRelation | MarketplaceBarbershopRelation[] | null;
}

/** API representation before presentation formatting. */
export interface MarketplaceShopResponse {
  id: string;
  barbershopId: string;
  name: string;
  address: string;
  city: string;
  price: number;
  tags: string[];
  lat: number;
  lng: number;
  distanceKm: number;
  openTime: string;
  closeTime: string;
  slug: string;
  nextSlot: string;
  rating: number;
  reviewsCount: number;
  plan?: 'free' | 'pro' | 'enterprise' | null;
}

/** Marketplace card and map model. */
export interface MarketplaceShop {
  id: string;
  barbershop_id: string;
  reviewsCount: number;
  closing_time: string;
  opening_time: string;
  name: string;
  slug: string;
  address?: string;
  city: string;
  distanceKm: number;
  hours: string;
  price: string;
  rating: number;
  reviews: string;
  nextSlot: string;
  tags: string[];
  featured?: boolean;
  accent?: string;
  lat?: number;
  lng?: number;
  closed_days?: string | null;
  closedDays?: string | null;
  off_days?: number[];
  /** Resolved public subscription tier; required to expose Enterprise-only booking options. */
  plan?: 'free' | 'pro' | 'enterprise' | null;
}

export interface MarketplaceService {
  id: string;
  barbershopId: string;
  name: string;
  price: number;
  durationMinutes: number;
}
