import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BRAND } from '@config/brand';
import { CheckoutCanceled } from '@/components/checkout/CheckoutCanceled';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout');
  return {
    title: `${t('canceledTitle')} — ${BRAND.name}`,
    robots: { index: false, follow: false },
  };
}

export default function CheckoutCanceledPage() {
  return <CheckoutCanceled />;
}
