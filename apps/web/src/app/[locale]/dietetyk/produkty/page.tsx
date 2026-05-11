import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { CleanProductList } from '@/components/dietitian/CleanProductList';

export default async function ProduktyPage() {
  const session = await auth();
  const t = await getTranslations('dietitian');
  const token = await getBackendToken() ?? '';

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('cleanProducts.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('cleanProducts.subtitle')}</p>
      </div>
      <CleanProductList token={token} />
    </div>
  );
}
