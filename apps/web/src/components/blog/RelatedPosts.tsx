import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import { BlogCard } from './BlogCard';
import type { BlogCategory } from '@/types/blog';

interface RelatedPostsProps {
  category: BlogCategory;
  currentSlug: string;
}

export async function RelatedPosts({ category, currentSlug }: RelatedPostsProps) {
  const t = await getTranslations('blog');

  let posts: Awaited<ReturnType<typeof api.blog.list>>['posts'] = [];
  try {
    const result = await api.blog.list({ category, limit: 4 });
    posts = result.posts.filter((p) => p.slug !== currentSlug).slice(0, 3);
  } catch {
    return null;
  }

  if (posts.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="text-xl font-bold text-foreground mb-6">{t('relatedTitle')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <BlogCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
