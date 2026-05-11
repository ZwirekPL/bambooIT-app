import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';

export interface ListPostsOptions {
  category?: string;
  page: number;
  limit: number;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface CreatePostData {
  slug: string;
  title: string;
  titleEn?: string;
  excerpt: string;
  excerptEn?: string;
  content: string;
  contentEn?: string;
  category: string;
  author: string;
  imageSrc?: string;
  imageAlt?: string;
  imageAltEn?: string;
  readTime: number;
  publishedAt: Date;
  published?: boolean;
  scheduledAt?: Date | null;
  faq?: FaqItem[];
}

export type UpdatePostData = Partial<CreatePostData>;

const postSelect = {
  id: true,
  slug: true,
  title: true,
  titleEn: true,
  excerpt: true,
  excerptEn: true,
  content: true,
  contentEn: true,
  category: true,
  author: true,
  imageSrc: true,
  imageAlt: true,
  imageAltEn: true,
  readTime: true,
  publishedAt: true,
  published: true,
  scheduledAt: true,
  faq: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
} as const;

const postListSelect = {
  id: true,
  slug: true,
  title: true,
  titleEn: true,
  excerpt: true,
  excerptEn: true,
  category: true,
  author: true,
  imageSrc: true,
  imageAlt: true,
  imageAltEn: true,
  readTime: true,
  publishedAt: true,
  published: true,
  scheduledAt: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listPublishedPosts(opts: ListPostsOptions) {
  const { category, page, limit } = opts;
  const skip = (page - 1) * limit;
  const now = new Date();

  const where: Prisma.PostWhereInput = {
    published: true,
    ...(category ? { category } : {}),
    OR: [
      { scheduledAt: null },
      { scheduledAt: { lte: now } },
    ],
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      select: postListSelect,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.post.count({ where }),
  ]);

  return { posts, total, page, limit };
}

export async function getPublishedPostBySlug(slug: string) {
  const now = new Date();
  const post = await prisma.post.findFirst({
    where: {
      slug,
      published: true,
      OR: [
        { scheduledAt: null },
        { scheduledAt: { lte: now } },
      ],
    },
    select: postSelect,
  });

  if (!post) {
    throw new AppError(404, 'NOT_FOUND', 'Post not found');
  }

  // Async increment view count (fire-and-forget)
  prisma.post.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  return post;
}

export async function listAllPosts(opts: Pick<ListPostsOptions, 'page' | 'limit'>) {
  const { page, limit } = opts;
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      select: postListSelect,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.post.count(),
  ]);

  return { posts, total, page, limit };
}

export async function createPost(data: CreatePostData) {
  const existing = await prisma.post.findUnique({ where: { slug: data.slug } });
  if (existing) {
    throw new AppError(409, 'SLUG_CONFLICT', 'A post with this slug already exists');
  }

  return prisma.post.create({
    data: {
      ...data,
      published: data.published ?? false,
      faq: data.faq as unknown as Prisma.InputJsonValue ?? undefined,
    },
    select: postSelect,
  });
}

export async function updatePost(id: string, data: UpdatePostData) {
  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Post not found');
  }

  if (data.slug && data.slug !== existing.slug) {
    const slugConflict = await prisma.post.findUnique({ where: { slug: data.slug } });
    if (slugConflict) {
      throw new AppError(409, 'SLUG_CONFLICT', 'A post with this slug already exists');
    }
  }

  const { faq, ...rest } = data;
  return prisma.post.update({
    where: { id },
    data: {
      ...rest,
      ...(faq !== undefined ? { faq: faq as unknown as Prisma.InputJsonValue } : {}),
    },
    select: postSelect,
  });
}

export async function getPostById(id: string) {
  const post = await prisma.post.findUnique({
    where: { id },
    select: postSelect,
  });

  if (!post) {
    throw new AppError(404, 'NOT_FOUND', 'Post not found');
  }

  return post;
}

export async function deletePost(id: string): Promise<{ slug: string }> {
  const existing = await prisma.post.findUnique({
    where: { id },
    select: { id: true, slug: true },
  });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Post not found');
  }

  await prisma.post.delete({ where: { id } });
  return { slug: existing.slug };
}

export async function getPostStats() {
  const [totalPosts, publishedCount, draftCount, viewsAgg, topPosts, postsByCategory] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({ where: { published: true } }),
    prisma.post.count({ where: { published: false } }),
    prisma.post.aggregate({ _sum: { viewCount: true } }),
    prisma.post.findMany({
      where: { published: true },
      select: { title: true, slug: true, viewCount: true },
      orderBy: { viewCount: 'desc' },
      take: 5,
    }),
    prisma.post.groupBy({
      by: ['category'],
      _count: true,
      orderBy: { _count: { category: 'desc' } },
    }),
  ]);

  return {
    totalPosts,
    publishedCount,
    draftCount,
    totalViews: viewsAgg._sum.viewCount ?? 0,
    topPosts: topPosts.map((p) => ({ title: p.title, slug: p.slug, viewCount: p.viewCount })),
    postsByCategory: postsByCategory.map((c) => ({ category: c.category, count: c._count })),
  };
}
