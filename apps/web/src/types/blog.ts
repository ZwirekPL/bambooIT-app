import { BLOG_CATEGORY_LIST } from '@/config/blogCategories';

export const BLOG_CATEGORIES = BLOG_CATEGORY_LIST.map((c) => c.name);

/**
 * Category type — runtime values come from BLOG_CATEGORY_LIST (bambooIT 8)
 * but legacy DietetykDEV strings may still arrive from old DB rows, so we
 * widen to `string` and rely on category-styles + category-t-key fallbacks
 * to render unknown values sensibly.
 */
export type BlogCategory = string;

export interface BlogFaqItem {
  question: string;
  answer: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  contentEn?: string | null;
  category: string;
  author: string;
  publishedAt: string;
  readTime: number;
  /** Path relative to /public, e.g. "/blog/images/post-1.jpg" */
  imageSrc?: string | null;
  imageAlt?: string | null;
  imageAltEn?: string | null;
  faq?: BlogFaqItem[] | null;
}

export type BlogListItem = Omit<BlogPost, 'content'>;
