import type { MetadataRoute } from 'next';
import { BRAND } from '@config/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: BRAND.seo.description,
    start_url: '/pl',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: BRAND.colors.navy,
    icons: [
      { src: '/icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
