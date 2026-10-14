'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { trackMarketingEvent } from '@/lib/analytics/marketing';

type TrackedMarketingLinkProps = Omit<
  ComponentProps<typeof Link>,
  'href' | 'onClick'
> & {
  href: string;
  ctaId: string;
  ctaLocation: string;
};

export function TrackedMarketingLink({
  href,
  ctaId,
  ctaLocation,
  children,
  ...props
}: TrackedMarketingLinkProps) {
  return (
    <Link
      {...props}
      href={href}
      onClick={() => {
        trackMarketingEvent('silentra_cta_click', {
          cta_id: ctaId,
          cta_location: ctaLocation,
          cta_destination: href,
        });
      }}
    >
      {children}
    </Link>
  );
}
