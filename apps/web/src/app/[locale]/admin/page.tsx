import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return {
    title: `${t('title')} — Admin`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminPage() {
  const t = await getTranslations('admin');

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Admin dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Panel administratora bambooIT — w przebudowie. Pełny dashboard z KPI
            (MRR, churn, aktywne firmy, wolumen ticketów) wracający w fazie 4.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
