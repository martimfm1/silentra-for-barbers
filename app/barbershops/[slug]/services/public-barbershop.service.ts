import type { BarbershopAmenities } from '@/lib/barbershops/amenities';
import type { PublicProfileRecord } from '@/lib/barbershops/public-profile';

export interface ServiceItem {
  id: string;
  name: string;
  price: number;
  duration: number;
  popular: boolean;
}

export interface ReviewItem {
  id: string;
  client_name: string;
  rating: number;
  comment?: string | null;
  created_at?: string;
}

export interface BarbershopPublicDetails extends PublicProfileRecord {
  amenities?: BarbershopAmenities;
  services: ServiceItem[];
  reviews: ReviewItem[];
  rating: number;
  reviewsCount: number;
  reviews_count?: number;
  popular_service_id?: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
  lunch_start?: string | null;
  lunch_end?: string | null;
  closed_days?: string | null;
  off_days?: number[];
  price?: number | string | null;
  rating_avg?: number;
}

interface PublicProfileApiResponse {
  data?: BarbershopPublicDetails;
  error?: string;
}

async function getPublicProfileApi(
  slug: string,
): Promise<BarbershopPublicDetails> {
  const response = await fetch(
    `/api/public/barbershops/${encodeURIComponent(slug)}`,
    {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    },
  );

  let payload: PublicProfileApiResponse = {};
  try {
    payload = (await response.json()) as PublicProfileApiResponse;
  } catch {
    throw new Error('Não foi possível carregar a página da barbearia.');
  }

  if (!response.ok || !payload.data) {
    throw new Error(payload.error || 'Barbearia não encontrada.');
  }

  return payload.data;
}

export const publicBarbershopService = {
  async getBarbershopData(slug: string) {
    const normalizedSlug = slug.trim();
    if (!normalizedSlug) {
      return {
        data: null,
        error: new Error('Barbearia não encontrada.'),
      };
    }

    try {
      const data = await getPublicProfileApi(normalizedSlug);
      return { data, error: null };
    } catch (error: unknown) {
      return {
        data: null,
        error:
          error instanceof Error
            ? error
            : new Error('Não foi possível carregar a barbearia.'),
      };
    }
  },


};
