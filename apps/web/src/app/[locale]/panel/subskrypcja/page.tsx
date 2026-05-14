import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BRAND } from '@config/brand';
import { SubscriptionPanel } from '@/components/client-panel/SubscriptionPanel';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clientPanel.subscription');
  return {
    title: `${t('metaTitle')} — ${BRAND.name}`,
    robots: { index: false, follow: false },
  };
}

export default function ClientSubscriptionPage() {
  return <SubscriptionPanel />;
}
