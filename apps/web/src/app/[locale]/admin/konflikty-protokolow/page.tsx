import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { ProtocolConflictManager } from '@/components/admin/ProtocolConflictManager';

export async function generateMetadata() {
  const t = await getTranslations('admin.protocolConflicts');
  return { title: t('title') };
}

export default async function ProtocolConflictsPage() {
  const session = await auth();
  const token = await getBackendToken() ?? '';
  return <ProtocolConflictManager token={token} />;
}
