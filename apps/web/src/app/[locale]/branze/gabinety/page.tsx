import { setRequestLocale, getTranslations } from 'next-intl/server';
import { IndustryLanding } from '@/components/marketing/IndustryLanding';
import type { Metadata } from 'next';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'branze.gabinety.meta' });
  return { title: t('title'), description: t('description') };
}

export default async function GabinetyBranzaPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <IndustryLanding industrySlug="gabinety" />;
}
