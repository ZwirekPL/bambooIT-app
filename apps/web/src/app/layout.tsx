import type { Metadata } from 'next';
import { BRAND } from '@config/brand';

export const metadata: Metadata = {
  metadataBase: new URL(`https://${BRAND.domain}`),
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
