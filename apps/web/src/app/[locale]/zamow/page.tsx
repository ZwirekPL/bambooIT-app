import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BRAND } from '@config/brand';
import { OrderCheckout } from '@/components/order/OrderCheckout';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('order');
  return {
    title: `${t('title')} — ${BRAND.name}`,
    robots: { index: false, follow: false },
  };
}

export default function ZamowPage() {
  return <OrderCheckout />;
}
