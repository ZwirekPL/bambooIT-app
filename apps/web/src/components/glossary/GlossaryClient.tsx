'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Search, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';

type CategoryKey = 'cat1' | 'cat2' | 'cat3' | 'cat4' | 'cat5';

interface Term {
  id: string;
  name: string;
  definition: string;
  category: CategoryKey;
}

interface Category {
  key: CategoryKey;
  anchor: string;
}

const CATEGORIES: Category[] = [
  { key: 'cat1', anchor: 'podstawy' },
  { key: 'cat2', anchor: 'makroskladniki' },
  { key: 'cat3', anchor: 'mikroskladniki' },
  { key: 'cat4', anchor: 'indeksy' },
  { key: 'cat5', anchor: 'diety' },
];

const TERM_COUNT = 38;

export function GlossaryClient() {
  const t = useTranslations('glossary');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(null);

  const terms = useMemo<Term[]>(() => {
    const result: Term[] = [];
    for (let i = 1; i <= TERM_COUNT; i++) {
      result.push({
        id: `t${i}`,
        name: t(`t${i}name` as Parameters<typeof t>[0]),
        definition: t(`t${i}def` as Parameters<typeof t>[0]),
        category: t(`t${i}cat` as Parameters<typeof t>[0]) as CategoryKey,
      });
    }
    return result;
  }, [t]);

  const filteredTerms = useMemo(() => {
    let result = terms;
    if (activeCategory) {
      result = result.filter((term) => term.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (term) =>
          term.name.toLowerCase().includes(q) ||
          term.definition.toLowerCase().includes(q),
      );
    }
    return result;
  }, [terms, search, activeCategory]);

  const groupedTerms = useMemo(() => {
    const groups = new Map<CategoryKey, Term[]>();
    for (const term of filteredTerms) {
      const existing = groups.get(term.category) ?? [];
      existing.push(term);
      groups.set(term.category, existing);
    }
    return groups;
  }, [filteredTerms]);

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

      {/* Category filter */}
      <nav className="flex flex-wrap gap-2" aria-label="Kategorie słownika">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() =>
              setActiveCategory(activeCategory === cat.key ? null : cat.key)
            }
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === cat.key
                ? 'border-brand-green bg-brand-green/10 text-brand-green'
                : 'border-border text-primary hover:bg-muted'
            }`}
          >
            {t(cat.key)}
          </button>
        ))}
      </nav>

      {/* Grouped terms */}
      {CATEGORIES.filter((cat) => groupedTerms.has(cat.key)).map((cat) => (
        <section key={cat.key} id={cat.anchor} className="scroll-mt-20">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight">
            <BookOpen className="h-5 w-5 text-brand-green" />
            {t(cat.key)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {groupedTerms.get(cat.key)!.map((term) => (
              <Card
                key={term.id}
                className="rounded-[16px] border border-border bg-white shadow-sm"
              >
                <CardContent className="p-5">
                  <h3 className="mb-2 text-base font-semibold text-foreground">
                    {term.name}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {term.definition}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}

      {/* No results */}
      {groupedTerms.size === 0 && (
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
