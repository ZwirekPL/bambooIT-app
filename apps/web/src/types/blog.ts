import { BLOG_CATEGORY_LIST } from '@/config/blogCategories';

export const BLOG_CATEGORIES = BLOG_CATEGORY_LIST.map((c) => c.name) as unknown as readonly [
  'Porady dietetyczne',
  'Odchudzanie',
  'Zdrowie i choroby',
  'Przepisy',
  'AI i dietetyka',
  'Motywacja',
  'Subskrypcja',
  'Thermomix & Airfryer',
];

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

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
