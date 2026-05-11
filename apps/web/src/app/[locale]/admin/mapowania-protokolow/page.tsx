import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { ProtocolTriggerManager } from '@/components/admin/ProtocolTriggerManager';

export async function generateMetadata() {
  const t = await getTranslations('admin.protocolTriggers');
  return { title: t('title') };
}

export default async function ProtocolTriggersPage() {
  const session = await auth();
  const token = await getBackendToken() ?? '';
  return <ProtocolTriggerManager token={token} />;
}
