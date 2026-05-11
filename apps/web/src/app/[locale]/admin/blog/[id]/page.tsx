import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { api, ApiError } from '@/lib/api';
import { PostForm } from '@/components/admin/blog/PostForm';

export const metadata: Metadata = { title: 'Edytuj artykuł — Admin' };

type Props = { params: Promise<{ id: string }> };

export default async function AdminEditPostPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const token = await getBackendToken() ?? '';

  let post;
  try {
    const result = await api.admin.blog.getById(id, token);
    post = result.post;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edytuj artykuł</h1>
        <p className="text-sm text-muted-foreground font-mono">{post.slug}</p>
      </div>
      <PostForm post={post} token={token} />
    </div>
  );
}
