import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { ProtocolsManager } from '@/components/admin/ProtocolsManager';

export async function generateMetadata() {
  const t = await getTranslations('admin.protocols');
  return { title: t('title') };
}

export default async function ProtocolsPage() {
  const session = await auth();
  const token = await getBackendToken() ?? '';
  return <ProtocolsManager token={token} />;
}
