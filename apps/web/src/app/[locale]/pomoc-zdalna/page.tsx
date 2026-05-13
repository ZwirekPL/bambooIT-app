import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/marketing/PageHeader';
import { RemoteSupportDownloads } from '@/components/marketing/RemoteSupportDownloads';
import { RemoteSupportFlow } from '@/components/marketing/RemoteSupportFlow';
import { RemoteSupportSecurity } from '@/components/marketing/RemoteSupportSecurity';
import type { Metadata } from 'next';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pomocZdalna.meta' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function PomocZdalnaPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pomocZdalna.header');

  return (
    <>
      <PageHeader
        eyebrow={t('eyebrow')}
        heading={t.rich('heading', {
          em: (chunks) => <em className="italic text-bamboo-deep">{chunks}</em>,
        })}
        lede={t('lede')}
      />
      <RemoteSupportDownloads />
      <RemoteSupportFlow />
      <RemoteSupportSecurity />
    </>
  );
}
