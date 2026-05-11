import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('notFound');

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center text-center px-4 py-20">
      <p className="text-8xl font-extrabold text-sage-200 mb-4">404</p>
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <p className="text-muted-foreground mb-8">{t('description')}</p>
      <Button asChild variant="sage">
        <Link href="/">{t('backHome')}</Link>
      </Button>
    </div>
  );
}
