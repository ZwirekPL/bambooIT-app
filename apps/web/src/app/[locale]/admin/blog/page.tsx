import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { api } from '@/lib/api';
import { AdminBlogList } from '@/components/admin/blog/AdminBlogList';
import { AdminBlogCategories } from '@/components/admin/blog/AdminBlogCategories';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Blog — Admin' };

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function AdminBlogPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const activeTab = tab === 'categories' ? 'categories' : 'posts';

  const session = await auth();
  const token = await getBackendToken() ?? '';

  if (!token) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
        Brak tokenu autoryzacji. Wyloguj się i zaloguj ponownie.
      </div>
    );
  }

  let posts: import('@/types/api').BlogPost[] = [];
  let total = 0;
  let categories: import('@/types/api').BlogCategoryConfig[] = [];
  let errorMsg = '';

  try {
    if (activeTab === 'posts') {
      const result = await api.admin.blog.list({ limit: 100 }, token);
      posts = result.posts;
      total = result.total;
    } else {
      const result = await api.admin.blogCategories.list(token);
      categories = result.categories;
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Błąd pobierania danych';
  }

  if (errorMsg) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
        Błąd: {errorMsg}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border">
        <a
          href="?tab=posts"
          className={[
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'posts'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          Artykuły
        </a>
        <a
          href="?tab=categories"
          className={[
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'categories'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          Kategorie
        </a>
      </div>

      {activeTab === 'posts' ? (
        <AdminBlogList posts={posts} total={total} token={token} />
      ) : (
        <AdminBlogCategories categories={categories} token={token} />
      )}
    </div>
  );
}
