import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { ProtocolSelector } from '@/components/dietitian/ProtocolSelector';

export async function generateMetadata() {
  const t = await getTranslations('dietitian.protocol');
  return { title: t('title') };
}

export default async function ProtocolPage() {
  const session = await auth();
  const token = await getBackendToken() ?? '';
  return <ProtocolSelector token={token} />;
}
