import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getBackendToken } from '@/lib/server-token';
import { EmailCampaignsManager } from '@/components/admin/EmailCampaignsManager';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.emailCampaigns');
  return {
    title: `${t('title')} — Admin`,
    robots: { index: false, follow: false },
  };
}

export default async function EmailKampaniePage() {
  const token = (await getBackendToken()) ?? '';
  return <EmailCampaignsManager token={token} />;
}
