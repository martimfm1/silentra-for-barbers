import type { FetchMarketplaceShopsParams } from '@/types/marketplace/filters';
import type {
  MarketplaceShop,
  MarketplaceShopResponse,
} from '@/types/marketplace/shops';
import { mapMarketplaceShopResponseToMarketplaceShop } from '@/lib/marketplace/shop-mappers';

export async function fetchShops({
  query = '',
  date,
  filter,
  userLocation,
  signal,
}: FetchMarketplaceShopsParams & { signal?: AbortSignal }): Promise<
  MarketplaceShop[]
> {
  const params = new URLSearchParams();

  if (query) params.set('query', query);
  if (date) params.set('date', date);
  if (filter && filter !== 'All') params.set('filter', filter);
  if (userLocation) {
    params.set('lat', String(userLocation.latitude));
    params.set('lng', String(userLocation.longitude));
  }

  const response = await fetch(`/api/shops?${params.toString()}`, {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch shops: ${response.statusText}`);
  }

  const result: { data: MarketplaceShopResponse[] } = await response.json();

  return (result.data || []).map(mapMarketplaceShopResponseToMarketplaceShop);
}
