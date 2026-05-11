import { setRequestLocale, getTranslations } from 'next-intl/server';
import { TestimonialForm } from '@/components/dashboard/TestimonialForm';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.testimonial' });
  return { title: t('title') };
}

export default async function TestimonialPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <TestimonialForm />;
}
