'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

type CategoryKey = 'cat1' | 'cat2' | 'cat3' | 'cat4';

interface FaqItem {
  id: string;
  q: string;
  a: string;
}

interface Category {
  key: CategoryKey;
  anchor: string;
  items: FaqItem[];
}

export function FaqAccordion() {
  const t = useTranslations('faq');
  const [search, setSearch] = useState('');

  const categories = useMemo<Category[]>(
    () => [
      {
        key: 'cat1',
        anchor: 'dieta-online',
        items: [
          { id: 'c1q1', q: t('cat1q1'), a: t('cat1a1') },
          { id: 'c1q2', q: t('cat1q2'), a: t('cat1a2') },
          { id: 'c1q3', q: t('cat1q3'), a: t('cat1a3') },
          { id: 'c1q4', q: t('cat1q4'), a: t('cat1a4') },
        ],
      },
      {
        key: 'cat2',
        anchor: 'plany-zywieniowe',
        items: [
          { id: 'c2q1', q: t('cat2q1'), a: t('cat2a1') },
          { id: 'c2q2', q: t('cat2q2'), a: t('cat2a2') },
          { id: 'c2q3', q: t('cat2q3'), a: t('cat2a3') },
          { id: 'c2q4', q: t('cat2q4'), a: t('cat2a4') },
          { id: 'c2q5', q: t('cat2q5'), a: t('cat2a5') },
        ],
      },
      {
        key: 'cat3',
        anchor: 'subskrypcja',
        items: [
          { id: 'c3q1', q: t('cat3q1'), a: t('cat3a1') },
          { id: 'c3q2', q: t('cat3q2'), a: t('cat3a2') },
          { id: 'c3q3', q: t('cat3q3'), a: t('cat3a3') },
          { id: 'c3q4', q: t('cat3q4'), a: t('cat3a4') },
        ],
      },
      {
        key: 'cat4',
        anchor: 'bezpieczenstwo',
        items: [
          { id: 'c4q1', q: t('cat4q1'), a: t('cat4a1') },
          { id: 'c4q2', q: t('cat4q2'), a: t('cat4a2') },
        ],
      },
    ],
    [t],
  );

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [search, categories]);

  return (
    <div className="space-y-8">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category anchor navigation */}
      {!search && (
        <nav className="flex flex-wrap gap-2" aria-label="Kategorie FAQ">
          {categories.map((cat) => (
            <a
              key={cat.key}
              href={`#${cat.anchor}`}
              className="rounded-md border border-border px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-muted hover:no-underline"
            >
              {t(cat.key)}
            </a>
          ))}
        </nav>
      )}

      {/* Categorized accordion */}
      {filteredCategories.map((cat) => (
        <section key={cat.key} id={cat.anchor} className="scroll-mt-20">
          <h2 className="mb-4 text-xl font-semibold tracking-tight">{t(cat.key)}</h2>
          <Accordion type="single" collapsible className="w-full">
            {cat.items.map((item) => (
              <AccordionItem key={item.id} value={item.id}>
                <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                <AccordionContent className="leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}

      {/* No results state */}
      {filteredCategories.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">{t('noResults')}</p>
      )}

      {/* CTA */}
      <div className="mt-12 rounded-xl border border-border bg-muted/30 p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold">{t('ctaTitle')}</h2>
        <p className="mb-6 text-muted-foreground">{t('ctaSubtitle')}</p>
        <Button asChild size="lg">
          <Link href="/oferta">{t('ctaButton')}</Link>
        </Button>
      </div>
    </div>
  );
}
