import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { ClinicalRulesManager } from '@/components/admin/ClinicalRulesManager';

export async function generateMetadata() {
  const t = await getTranslations('admin.clinicalRules');
  return { title: t('title') };
}

export default async function ClinicalRulesPage() {
  const session = await auth();
  const token = await getBackendToken() ?? '';

  return <ClinicalRulesManager token={token} />;
}
