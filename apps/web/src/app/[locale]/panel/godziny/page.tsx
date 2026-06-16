import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BRAND } from '@config/brand';
import { ClientHoursPanel } from '@/components/client-panel/ClientHoursPanel';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clientPanel.hours');
  return {
    title: `${t('metaTitle')} — ${BRAND.name}`,
    robots: { index: false, follow: false },
  };
}

export default function ClientHoursPage() {
  return <ClientHoursPanel />;
}
