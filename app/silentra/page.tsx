import { permanentRedirect } from 'next/navigation';

const SILENTRA_DEMO_PUBLIC_PATH =
  '/site/barbearia-silentra-ecf1da6c';

export default function LegacySilentraDemoPage() {
  permanentRedirect(SILENTRA_DEMO_PUBLIC_PATH);
}
