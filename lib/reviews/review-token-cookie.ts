export const REVIEW_TOKEN_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export function reviewTokenCookieName(shopId: string): string {
  return `silentra_review_${shopId.toLowerCase()}`;
}

export function reviewAccessCookieName(shopId: string): string {
  return `silentra_review_access_${shopId.toLowerCase()}`;
}
