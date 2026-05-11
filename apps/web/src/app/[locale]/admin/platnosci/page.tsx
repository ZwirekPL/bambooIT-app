import { getTranslations } from 'next-intl/server';
import { getBackendToken } from '@/lib/server-token';
import { redirect } from 'next/navigation';
import { StripeAdminPage } from '@/components/admin/StripeAdminPage';

export default async function Page() {
  const token = await getBackendToken();
  if (!token) redirect('/pl/zaloguj');
  const t = await getTranslations('admin.payments');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <StripeAdminPage token={token} />
    </div>
  );
}
