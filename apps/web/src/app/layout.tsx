import type { Metadata } from 'next';
import { BRAND } from '@config/brand';

export const metadata: Metadata = {
  metadataBase: new URL(`https://${BRAND.domain}`),
  // Pre-launch guard: block indexing entirely until SITE_INDEXABLE=true.
  // Applies to every route via the root layout; the X-Robots-Tag header in
  // next.config.ts and robots.ts Disallow are the other two layers.
  ...(process.env.SITE_INDEXABLE === 'true'
    ? {}
    : { robots: { index: false, follow: false } }),
};

// Root layout required by Next.js App Router.
// The actual <html>/<body> tags are rendered by [locale]/layout.tsx
// to avoid hydration mismatch from duplicate wrapper elements.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
