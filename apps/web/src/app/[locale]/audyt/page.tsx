import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/marketing/PageHeader';
import { AuditBenefits } from '@/components/marketing/AuditBenefits';
import { AuditFormSection } from '@/components/marketing/AuditFormSection';
import { AuditFAQ } from '@/components/marketing/AuditFAQ';
import type { Metadata } from 'next';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'audyt.meta' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function AudytPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('audyt.header');

  return (
    <>
      <PageHeader
        eyebrow={t('eyebrow')}
        heading={t.rich('heading', {
          em: (chunks) => <em className="italic text-bamboo-deep">{chunks}</em>,
        })}
        lede={t('lede')}
      />
      <AuditBenefits />
      <AuditFormSection />
      <AuditFAQ />
    </>
  );
}
