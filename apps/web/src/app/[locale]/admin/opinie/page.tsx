import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AdminTestimonials } from '@/components/admin/AdminTestimonials';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.testimonials' });
  return { title: t('title') };
}

export default async function AdminTestimonialsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AdminTestimonials />;
}
