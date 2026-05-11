import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { HeroSection } from '@/components/home/HeroSection';
import { FeaturesSection } from '@/components/home/FeaturesSection';
import { HowItWorksSection } from '@/components/home/HowItWorksSection';
import { PricingPreviewSection } from '@/components/home/PricingPreviewSection';
import { TestimonialsSection } from '@/components/home/TestimonialsSection';
import { CtaSection } from '@/components/home/CtaSection';
import { DatabaseStatsSection } from '@/components/home/DatabaseStatsSection';
import { localeAlternates } from '@/lib/seo';
import {
  organizationJsonLd,
  websiteJsonLd,
  softwareApplicationJsonLd,
  howToJsonLd,
} from '@config/schemas';

export const metadata: Metadata = {
  alternates: localeAlternates(''),
};

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <DatabaseStatsSection />
      <PricingPreviewSection />
      <TestimonialsSection />
      <CtaSection />
    </>
  );
}
