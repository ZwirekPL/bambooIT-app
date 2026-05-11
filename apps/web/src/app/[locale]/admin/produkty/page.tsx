import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { AdminCleanProductList } from '@/components/admin/AdminCleanProductList';

export default async function AdminProduktyPage() {
  const session = await auth();
  const t = await getTranslations('admin');
  const token = await getBackendToken() ?? '';

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('cleanProducts.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('cleanProducts.subtitle')}</p>
      </div>
      <AdminCleanProductList token={token} />
    </div>
  );
}
