import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AboutHero } from '@/components/marketing/AboutHero';
import { AboutStats } from '@/components/marketing/AboutStats';
import { AboutStory } from '@/components/marketing/AboutStory';
import { AboutTeam } from '@/components/marketing/AboutTeam';
import { AboutValues } from '@/components/marketing/AboutValues';
import { FinalCTASection } from '@/components/marketing/FinalCTASection';
import type { Metadata } from 'next';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'oNas.meta' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function ONasPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <AboutHero />
      <AboutStats />
      <AboutStory />
      <AboutTeam />
      <AboutValues />
      <FinalCTASection />
    </>
  );
}
