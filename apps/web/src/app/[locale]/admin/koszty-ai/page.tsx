import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { AiCostsManager } from '@/components/admin/AiCostsManager';

export async function generateMetadata() {
  const t = await getTranslations('admin.aiCosts');
  return { title: t('title') };
}

export default async function AiCostsPage() {
  const session = await auth();
  const token = await getBackendToken() ?? '';
  return <AiCostsManager token={token} />;
}
