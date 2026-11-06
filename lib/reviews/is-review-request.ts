const REVIEW_REQUEST_PATTERN =
  /\b(avalia(?:ção|ções|cao|coes|r)?|classifica(?:ção|ções|cao|coes|r)?|opini(?:ão|ões|ao|oes)|reviews?|feedback|ratings?|rate\s+(?:your|us|our)|leave\s+(?:a\s+)?review|how\s+was\s+your|tell\s+us\s+about\s+your|share\s+your\s+experience)\b/i;

export function isReviewRequestContent(subject: string, body: string): boolean {
  return REVIEW_REQUEST_PATTERN.test(`${subject}\n${body}`);
}
