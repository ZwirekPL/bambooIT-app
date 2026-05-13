import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Fraunces, Archivo, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';

const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '600', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-fraunces',
});

const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
  variable: '--font-archivo',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { BRAND } from '@config/brand';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Providers } from '@/components/layout/Providers';
import { BambooLoader } from '@/components/layout/BambooLoader';
import { CookieBanner } from '@/components/legal/CookieBanner';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { GeoTracker } from '@/components/analytics/GeoTracker';
import '../globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(`https://${BRAND.domain}`),
  title: BRAND.seo.title,
  description: BRAND.seo.description,
  openGraph: {
    title: BRAND.seo.title,
    description: BRAND.seo.description,
    siteName: BRAND.name,
    locale: 'pl_PL',
    type: 'website',
    images: [{ url: BRAND.seo.ogImage, width: 1200, height: 630, alt: BRAND.seo.title }],
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND.seo.title,
    description: BRAND.seo.description,
    images: [BRAND.seo.ogImage],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GSC_VERIFICATION,
  },
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${archivo.variable} ${jetbrainsMono.variable} ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body>
        <BambooLoader />
        <GoogleAnalytics />
        <GeoTracker />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <Header />
            <main>{children}</main>
            <Footer />
            <CookieBanner />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
