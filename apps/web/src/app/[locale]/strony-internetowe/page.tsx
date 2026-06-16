import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ServiceLanding } from '@/components/marketing/ServiceLanding';
import type { Metadata } from 'next';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'uslugi.strony-internetowe.meta' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function StronyInternetowePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ServiceLanding serviceSlug="strony-internetowe" />;
}
