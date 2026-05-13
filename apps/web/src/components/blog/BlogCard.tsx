'use client';

import { Link } from '@/i18n/navigation';
import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getCategoryStyle } from '@/components/blog/category-styles';
import { CATEGORY_T_KEY } from '@/components/blog/category-t-key';
import type { BlogListItem } from '@/types/blog';

interface BlogCardProps {
  post: BlogListItem;
}

export function BlogCard({ post }: BlogCardProps) {
  const t = useTranslations('blog');
  const badge = getCategoryStyle(post.category);
  const catLabel = t(CATEGORY_T_KEY[post.category] ?? 'catObslugaIt');

  return (
    <Link href={`/blog/${post.slug}`} className="group block h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition-all duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-xl">
        {/* Image */}
        <div className="relative h-44 w-full shrink-0 overflow-hidden bg-gradient-to-br from-paper to-bamboo-soft/60">
          {post.imageSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={post.imageSrc}
              alt={post.imageAlt ?? post.title}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="select-none font-display text-7xl font-black text-navy/10">
                {post.category[0]}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-3 p-5">
          <span
            className={`self-start rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.bg} ${badge.text}`}
          >
            {catLabel}
          </span>

          <h3 className="line-clamp-3 font-display text-base font-semibold leading-snug tracking-[-0.01em] text-navy transition-colors group-hover:text-bamboo-deep">
            {post.title}
          </h3>

          <div className="mt-auto flex items-center gap-1.5 pt-2 font-mono text-xs text-navy-soft">
            <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{t('readTime', { minutes: post.readTime })}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
