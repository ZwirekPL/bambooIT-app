import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BlogPageClient } from '@/components/blog/BlogPageClient';
import { api } from '@/lib/api';
import { BRAND } from '@config/brand';
import { localeAlternates } from '@/lib/seo';
import type { BlogListItem } from '@/types/blog';
import type { BlogListItem as ApiBlogListItem } from '@/types/api';
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema';

export const revalidate = 60;

type Props = { params: Promise<{ locale: string }> };

function toLocalizedPost(post: ApiBlogListItem, locale: string): BlogListItem {
  return {
    id: post.id,
    slug: post.slug,
    title: locale === 'en' && post.titleEn ? post.titleEn : post.title,
    excerpt: locale === 'en' && post.excerptEn ? post.excerptEn : post.excerpt,
    category: post.category,
    author: post.author,
    publishedAt: post.publishedAt,
    readTime: post.readTime,
    imageSrc: post.imageSrc ?? undefined,
    imageAlt: locale === 'en' && post.imageAltEn ? post.imageAltEn : (post.imageAlt ?? undefined),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('blog');
  return {
    title: `${t('title')} — ${BRAND.name}`,
    description: t('heroSubtitle'),
    alternates: localeAlternates('/blog'),
  };
}

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('blog');

  let posts: BlogListItem[] = [];
  let categoryNames: string[] = [];
  try {
    const [postsResult, categoriesResult] = await Promise.all([
      api.blog.list({ limit: 50 }),
      api.blog.categories().catch(() => ({ categories: [] })),
    ]);
    posts = postsResult.posts.map((p) => toLocalizedPost(p, locale));
    categoryNames = categoriesResult.categories.map((c) => c.name);
  } catch {
    // Show empty state on error — blog is not critical
  }

  return (
    <>
    <BreadcrumbSchema locale={locale} items={[{ name: 'Blog', path: '/blog' }]} />
    <BlogPageClient
      posts={posts}
      categoryNames={categoryNames}
      translations={{
        heroTitle: t('heroTitle'),
        heroSubtitle: t('heroSubtitle'),
        searchPlaceholder: t('searchPlaceholder'),
        ctaLabel: t('ctaLabel'),
        noPostsTitle: t('noPostsTitle'),
        noPostsDesc: t('noPostsDesc'),
        newsletterText: t('newsletterText'),
        newsletterPlaceholder: t('newsletterPlaceholder'),
        newsletterButton: t('newsletterButton'),
      }}
    />
    </>
  );
}
