'use client';

import { useState, useMemo } from 'react';
import { BlogHero } from '@/components/blog/BlogHero';
import { CategoryFilter } from '@/components/blog/CategoryFilter';
import { BlogCard } from '@/components/blog/BlogCard';
import { NewsletterBanner } from '@/components/blog/NewsletterBanner';
import type { BlogListItem } from '@/types/blog';

interface BlogPageClientProps {
  posts: BlogListItem[];
  categoryNames?: string[];
  translations: {
    heroTitle: string;
    heroSubtitle: string;
    searchPlaceholder: string;
    ctaLabel: string;
    noPostsTitle: string;
    noPostsDesc: string;
    newsletterText: string;
    newsletterPlaceholder: string;
    newsletterButton: string;
  };
}

export function BlogPageClient({ posts, categoryNames, translations: t }: BlogPageClientProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('Wszystkie');

  const filtered = useMemo(() => {
    return posts.filter((post) => {
      const matchesCategory = category === 'Wszystkie' || post.category === category;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q.length === 0 ||
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [posts, category, search]);

  return (
    <>
      <BlogHero
        title={t.heroTitle}
        subtitle={t.heroSubtitle}
        searchPlaceholder={t.searchPlaceholder}
        ctaLabel={t.ctaLabel}
        searchValue={search}
        onSearchChange={setSearch}
      />

      <section className="bg-paper px-5 py-12 md:px-12 md:py-16">
        <div className="mx-auto w-full max-w-[1440px] space-y-8">
          <CategoryFilter
            selected={category}
            onChange={setCategory}
            categoryNames={categoryNames}
          />

          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <p className="mb-2 font-display text-2xl font-semibold tracking-[-0.02em] text-navy">
                {t.noPostsTitle}
              </p>
              <p className="text-navy-soft">{t.noPostsDesc}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>

      <NewsletterBanner
        text={t.newsletterText}
        placeholder={t.newsletterPlaceholder}
        buttonLabel={t.newsletterButton}
      />
    </>
  );
}
