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
  const catLabel = t(CATEGORY_T_KEY[post.category] ?? 'catPoradyDietetyczne');

  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <article className="rounded-2xl overflow-hidden bg-white border border-border hover:shadow-lg transition-shadow duration-200 h-full flex flex-col">
        {/* Image */}
        <div className="relative h-44 w-full bg-gradient-to-br from-sage-100 to-sage-200 shrink-0 overflow-hidden">
          {post.imageSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={post.imageSrc}
              alt={post.imageAlt ?? post.title}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sage-300 text-6xl font-black select-none">
                {post.category[0]}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-2 flex-1">
          {/* Category badge */}
          <span
            className={`self-start text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
          >
            {catLabel}
          </span>

          {/* Title */}
          <h3 className="text-sm font-semibold leading-snug text-foreground group-hover:text-sage-600 transition-colors line-clamp-3">
            {post.title}
          </h3>

          {/* Read time */}
          <div className="mt-auto flex items-center gap-1 text-xs text-muted-foreground pt-1">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{t('readTime', { minutes: post.readTime })}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
