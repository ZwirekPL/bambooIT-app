'use client';

import { useState } from 'react';
import { useRouter, Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import type { BlogPost } from '@/types/api';

interface AdminBlogListProps {
  posts: BlogPost[];
  total: number;
  token: string;
}

export function AdminBlogList({ posts: initialPosts, total, token }: AdminBlogListProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function togglePublished(post: BlogPost) {
    setLoading(post.id);
    setError('');
    try {
      const updated = await api.admin.blog.update(post.id, { published: !post.published }, token);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? updated.post : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zmiany widoczności');
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete(post: BlogPost) {
    if (!confirm(`Usunąć post "${post.title}"?`)) return;
    setLoading(post.id);
    setError('');
    try {
      await api.admin.blog.delete(post.id, token);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd usuwania posta');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Blog</h1>
          <p className="text-sm text-muted-foreground">{total} artykułów łącznie</p>
        </div>
        <Button asChild>
          <Link href="/admin/blog/nowy">
            <Plus className="h-4 w-4 mr-2" />
            Nowy artykuł
          </Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Brak artykułów. Utwórz pierwszy artykuł.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <Card key={post.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Status badge */}
                  <div className="pt-0.5">
                    <Badge variant={post.published ? 'sage' : 'outline'}>
                      {post.published ? 'Opublikowany' : 'Szkic'}
                    </Badge>
                  </div>

                  {/* Post info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{post.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {post.category} · {post.readTime} min · {post.viewCount} wyśw. ·{' '}
                      {new Date(post.publishedAt).toLocaleDateString('pl-PL')}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{post.slug}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={post.published ? 'Ukryj' : 'Opublikuj'}
                      disabled={loading === post.id}
                      onClick={() => togglePublished(post)}
                    >
                      {post.published ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" title="Edytuj" asChild>
                      <Link href={`/admin/blog/${post.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Usuń"
                      disabled={loading === post.id}
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(post)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
