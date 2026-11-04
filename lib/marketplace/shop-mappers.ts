import type {
  MarketplaceShop,
  MarketplaceShopRecord,
  MarketplaceShopResponse,
} from '@/types/marketplace/shops';

export function mapRecordToMarketplaceShopResponse(
  record: MarketplaceShopRecord,
): MarketplaceShopResponse {
  const relation = Array.isArray(record.barbershops)
    ? record.barbershops[0]
    : record.barbershops;

  return {
    id: record.id,
    barbershopId: record.barbershop_id,
    name: relation?.name || 'Barbearia',
    address: relation?.address || '',
    city: record.city,
    price: record.price,
    tags: record.tags || [],
    lat: record.lat,
    lng: record.lng,
    distanceKm: 0,
    openTime: relation?.opening_time?.substring(0, 5) || '09:00',
    closeTime: relation?.closing_time?.substring(0, 5) || '19:00',
    slug: record.slug,
    nextSlot: '15:00',
    rating: Number(record.rating ?? 0),
    reviewsCount: Number(record.reviews_count ?? 0),
  };
}

export function mapMarketplaceShopResponseToMarketplaceShop(
  shop: MarketplaceShopResponse,
): MarketplaceShop {
  return {
    id: shop.id,
    barbershop_id: shop.barbershopId,
    slug: shop.slug,
    name: shop.name,
    address: shop.address,
    city: shop.city,
    opening_time: shop.openTime,
    closing_time: shop.closeTime,
    hours: `${shop.openTime} - ${shop.closeTime}`,
    distanceKm: shop.distanceKm,
    price: `€${shop.price.toFixed(2)}`,
    rating: shop.rating,
    reviewsCount: shop.reviewsCount,
    reviews: String(shop.reviewsCount),
    nextSlot: shop.nextSlot ? `${shop.nextSlot} Hoje` : 'Sem vagas',
    tags: shop.tags,
    lat: shop.lat,
    lng: shop.lng,
    accent: 'amber',
  };
}
