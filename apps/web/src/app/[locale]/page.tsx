import { setRequestLocale } from 'next-intl/server';
import { HeroSection } from '@/components/marketing/HeroSection';
import { MarqueeBar } from '@/components/marketing/MarqueeBar';
import { OfferSection } from '@/components/marketing/OfferSection';
import { BRAND } from '@config/brand';

type Props = {
  params: Promise<{ locale: string }>;
};

// JSON-LD Organization schema — improves SERP rich results and grounds the
// brand for AI search engines. Lives on the homepage only; other pages can
// emit their own page-specific schemas (Article, BreadcrumbList, etc.) later.
function organizationLd() {
  const baseUrl = `https://${BRAND.domain}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND.name,
    alternateName: BRAND.shortName,
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: BRAND.seo.description,
    email: BRAND.email,
    telephone: BRAND.phone,
    foundingDate: String(BRAND.geo.foundingYear),
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'PL',
      addressLocality: BRAND.geo.headquarters,
    },
    knowsAbout: BRAND.geo.specialties,
    sameAs: [BRAND.social.facebook, BRAND.social.instagram].filter(Boolean),
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd()) }}
      />
      <HeroSection />
      <MarqueeBar />
      <OfferSection />
    </>
  );
}
