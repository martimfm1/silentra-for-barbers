const REVIEW_REQUEST_PATTERN =
  /\b(avalia[cç][aã]o|avaliar|classificar|opini[aã]o|review|feedback|rate\s+(?:your|us)|leave\s+a\s+review)\b/i;

export function isReviewRequestContent(subject: string, body: string): boolean {
  return REVIEW_REQUEST_PATTERN.test(`${subject}\n${body}`);
}
