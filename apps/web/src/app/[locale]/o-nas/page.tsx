import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BRAND } from '@config/brand';
import { organizationSchema } from '@config/schemas';
import { localeAlternates } from '@/lib/seo';

import { AboutHero } from '@/components/about/AboutHero';
import { WhyWeExist } from '@/components/about/WhyWeExist';
import { OurValues } from '@/components/about/OurValues';
import { HowItWorks } from '@/components/about/HowItWorks';
import { OurTeam } from '@/components/about/OurTeam';
import { Responsibility } from '@/components/about/Responsibility';
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about.hero');
  return {
    title: `${t('title')} — ${BRAND.name}`,
    description: t('subtitle'),
    alternates: localeAlternates('/o-nas'),
  };
}

async function buildTeamSchema(locale: string) {
  setRequestLocale(locale);
  const t = await getTranslations('about.team');

  const employees = [1, 2, 3, 4, 5, 6].map((n) => ({
    '@type': 'Person',
    name: t(`member${n}Name` as Parameters<typeof t>[0]),
    jobTitle: t(`member${n}Role` as Parameters<typeof t>[0]),
    description: t(`member${n}Spec` as Parameters<typeof t>[0]),
    hasCredential: {
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'degree',
      name: t(`member${n}Credentials` as Parameters<typeof t>[0]),
    },
    alumniOf: {
      '@type': 'EducationalOrganization',
      name: t(`member${n}Education` as Parameters<typeof t>[0]),
    },
    worksFor: {
      '@type': 'Organization',
      name: BRAND.name,
    },
  }));

  const { '@type': _type, ...orgFields } = organizationSchema;

  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalOrganization',
    ...orgFields,
    medicalSpecialty: 'Dietetics',
    employee: employees,
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const teamSchema = await buildTeamSchema(locale);

  return (
    <>
      <BreadcrumbSchema locale={locale} items={[{ name: 'O nas', path: '/o-nas' }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(teamSchema) }}
      />
      <AboutHero />
      <WhyWeExist />
      <OurValues />
      <HowItWorks />
      <OurTeam />
      <Responsibility />
    </>
  );
}
