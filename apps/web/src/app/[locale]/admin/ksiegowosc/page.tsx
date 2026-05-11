import { getTranslations } from 'next-intl/server';
import { getBackendToken } from '@/lib/server-token';
import { redirect } from 'next/navigation';
import { AccountingPage } from '@/components/admin/AccountingPage';

export default async function Page() {
  const token = await getBackendToken();
  if (!token) redirect('/pl/zaloguj');
  const t = await getTranslations('admin.accounting');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <AccountingPage token={token} />
    </div>
  );
}
