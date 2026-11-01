import { termsAndConditions } from '@/lib/legal/terms-and-conditions';
import {
  CURRENT_LEGAL_UPDATE,
  currentTermsAddendum,
  currentTermsFeatureSections,
} from '@/lib/legal/current-legal-addendum';

export const currentTerms = {
  pt: {
    ...termsAndConditions.pt,
    lastUpdated: CURRENT_LEGAL_UPDATE,
    sections: [
      ...termsAndConditions.pt.sections,
      currentTermsAddendum.pt,
      ...currentTermsFeatureSections.pt,
    ],
  },
  en: {
    ...termsAndConditions.en,
    lastUpdated: 'November 1, 2026',
    sections: [
      ...termsAndConditions.en.sections,
      currentTermsAddendum.en,
      ...currentTermsFeatureSections.en,
    ],
  },
} as const;
