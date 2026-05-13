import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/marketing/PageHeader';
import { ContactFormSection } from '@/components/marketing/ContactFormSection';
import type { Metadata } from 'next';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'kontakt.meta' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function KontaktPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('kontakt.header');

  return (
    <>
      <PageHeader
        eyebrow={t('eyebrow')}
        heading={t.rich('heading', {
          em: (chunks) => <em className="italic text-bamboo-deep">{chunks}</em>,
        })}
        lede={t('lede')}
      />
      <ContactFormSection />
    </>
  );
}
