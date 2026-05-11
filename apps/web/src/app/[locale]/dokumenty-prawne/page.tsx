import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { Badge } from '@/components/ui/badge';
import { BRAND } from '@config/brand';
import { localeAlternates } from '@/lib/seo';
import { LegalTabs } from '@/components/legal/LegalTabs';
import fs from 'fs/promises';
import path from 'path';

type Props = { params: Promise<{ locale: string }> };

async function loadLegalDoc(locale: string, slug: string): Promise<string> {
  const supportedLocale = locale === 'en' ? 'en' : 'pl';
  const filePath = path.join(process.cwd(), 'content', 'legal', supportedLocale, `${slug}.md`);

  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    // Fallback to Polish if English not available
    const fallbackPath = path.join(process.cwd(), 'content', 'legal', 'pl', `${slug}.md`);
    return await fs.readFile(fallbackPath, 'utf-8');
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('legal');
  return {
    title: `${t('title')} — ${BRAND.name}`,
    description: t('subtitle'),
    alternates: localeAlternates('/dokumenty-prawne'),
  };
}

export default async function LegalPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('legal');

  const [privacy, terms, cookies, ai] = await Promise.all([
    loadLegalDoc(locale, 'polityka-prywatnosci'),
    loadLegalDoc(locale, 'regulamin'),
    loadLegalDoc(locale, 'polityka-cookies'),
    loadLegalDoc(locale, 'informacja-ai'),
  ]);

  return (
    <>
      <section className="bg-gradient-to-b from-sage-50/50 to-background py-20">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <Badge variant="sage-outline" className="mb-4">
            {t('title')}
          </Badge>
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl">{t('title')}</h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">{t('subtitle')}</p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <Suspense>
            <LegalTabs privacy={privacy} terms={terms} cookies={cookies} ai={ai} />
          </Suspense>
        </div>
      </section>
    </>
  );
}
