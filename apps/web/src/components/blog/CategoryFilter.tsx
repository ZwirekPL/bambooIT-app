'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { BLOG_CATEGORIES } from '@/types/blog';
import { CATEGORY_T_KEY } from '@/components/blog/category-t-key';

const ALL_VALUE = 'Wszystkie' as const;

interface CategoryFilterProps {
  selected: string;
  onChange: (category: string) => void;
  /** Dynamic category names from API. Falls back to hardcoded list if empty. */
  categoryNames?: string[];
}

export function CategoryFilter({ selected, onChange, categoryNames }: CategoryFilterProps) {
  const t = useTranslations('blog');

  const categories = useMemo(() => {
    const names = categoryNames && categoryNames.length > 0
      ? categoryNames
      : [...BLOG_CATEGORIES];
    return [ALL_VALUE, ...names];
  }, [categoryNames]);

  function getLabel(cat: string): string {
    if (cat === ALL_VALUE) return t('catAll');
    const tKey = CATEGORY_T_KEY[cat];
    if (tKey) return t(tKey);
    // Dynamic category without a translation key — show name as-is.
    return cat;
  }

  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto pb-2">
      {categories.map((cat) => {
        const isActive = cat === selected;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            className={
              isActive
                ? 'shrink-0 rounded-full bg-navy-deep px-5 py-2 text-sm font-medium text-white transition-colors'
                : 'shrink-0 rounded-full border border-line bg-white px-5 py-2 text-sm font-medium text-navy-soft transition-colors hover:border-line-strong hover:text-navy'
            }
          >
            {getLabel(cat)}
          </button>
        );
      })}
    </div>
  );
}
