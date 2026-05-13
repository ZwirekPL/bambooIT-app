import type { MetadataRoute } from 'next';
import { BRAND } from '@config/brand';

const BASE_URL = `https://${BRAND.domain}`;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface PostItem {
  slug: string;
  publishedAt: string;
}

async function getBlogPosts(): Promise<PostItem[]> {
  try {
    const res = await fetch(`${API_URL}/posts?limit=1000`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.posts ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getBlogPosts();

  function bilingualEntry(
    path: string,
    changeFrequency: 'daily' | 'weekly' | 'monthly',
    priority: number,
    lastModified: Date = new Date(),
  ): MetadataRoute.Sitemap {
    return [
      {
        url: `${BASE_URL}/pl${path}`,
        lastModified,
        changeFrequency,
        priority,
        alternates: {
          languages: { pl: `${BASE_URL}/pl${path}`, en: `${BASE_URL}/en${path}` },
        },
      },
      {
        url: `${BASE_URL}/en${path}`,
        lastModified,
        changeFrequency,
        priority: Math.max(priority - 0.1, 0.1),
        alternates: {
          languages: { pl: `${BASE_URL}/pl${path}`, en: `${BASE_URL}/en${path}` },
        },
      },
    ];
  }

  // Only routes that actually exist today are listed. New routes (/pakiety,
  // /audyt, /kontakt, /o-nas, /pomoc-zdalna, /branze/*) get added to the
  // sitemap in the same commit that ships each page (W2.CC, W3.CC, W4.CC).
  // Listing routes that 404 is a SEO anti-pattern — crawlers de-prioritise
  // the whole sitemap when they hit broken entries.
  const staticPages: MetadataRoute.Sitemap = [
    ...bilingualEntry('',                  'weekly',  1.0),
    ...bilingualEntry('/blog',             'daily',   0.8),
    ...bilingualEntry('/dokumenty-prawne', 'monthly', 0.3),
  ];

  const blogPages: MetadataRoute.Sitemap = posts.flatMap((post) =>
    bilingualEntry(`/blog/${post.slug}`, 'monthly', 0.6, new Date(post.publishedAt)),
  );

  return [...staticPages, ...blogPages];
}
