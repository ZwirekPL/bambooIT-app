import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { PostForm } from '@/components/admin/blog/PostForm';

export const metadata: Metadata = { title: 'Nowy artykuł — Admin' };

export default async function AdminNewPostPage() {
  const session = await auth();
  const token = await getBackendToken() ?? '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nowy artykuł</h1>
        <p className="text-sm text-muted-foreground">Utwórz nowy artykuł na blog</p>
      </div>
      <PostForm token={token} />
    </div>
  );
}
