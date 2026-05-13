import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BRAND } from '@config/brand';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('order');
  return {
    title: `${t('title')} — ${BRAND.name}`,
    robots: { index: false, follow: false },
  };
}

export default function ZamowPage() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold mb-4">Składanie zamówienia</h1>
      <p className="text-slate-600">Przepraszamy, formularz zamówienia jest tymczasowo niedostępny — wracamy w przebudowanej wersji w fazie 4.</p>
    </div>
  );
}
