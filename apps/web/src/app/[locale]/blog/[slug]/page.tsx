import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';
import { CATEGORY_T_KEY } from '@/components/blog/category-t-key';
import { BRAND } from '@config/brand';
import { localeAlternates } from '@/lib/seo';
import type { BlogCategory, BlogFaqItem } from '@/types/blog';
import { BlogCTA } from '@/components/blog/BlogCTA';
import { RelatedPosts } from '@/components/blog/RelatedPosts';
import { LatestPosts } from '@/components/blog/LatestPosts';
import { FaqSection } from '@/components/blog/FaqSection';
import { TableOfContents, type TocItem } from '@/components/blog/TableOfContents';
import { AuthorBox } from '@/components/blog/AuthorBox';
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema';

export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  try {
    const { post } = await api.blog.getBySlug(slug);
    const title = locale === 'en' && post.titleEn ? post.titleEn : post.title;
    const description = locale === 'en' && post.excerptEn ? post.excerptEn : post.excerpt;
    const siteUrl = `https://${BRAND.domain}`;
    const imageUrl = post.imageSrc ? `${siteUrl}${post.imageSrc}` : undefined;
    return {
      title: `${title} — ${BRAND.name}`,
      description,
      alternates: localeAlternates(`/blog/${slug}`),
      openGraph: {
        title,
        description,
        type: 'article',
        publishedTime: post.publishedAt,
        modifiedTime: post.updatedAt,
        authors: [post.author],
        images: imageUrl ? [{ url: imageUrl, alt: title }] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: imageUrl ? [imageUrl] : [],
      },
    };
  } catch {
    return { title: `Blog — ${BRAND.name}` };
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('blog');

  let post;
  try {
    const result = await api.blog.getBySlug(slug);
    post = result.post;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    notFound();
  }

  const title = locale === 'en' && post.titleEn ? post.titleEn : post.title;
  const excerpt = locale === 'en' && post.excerptEn ? post.excerptEn : post.excerpt;
  const imageAlt = locale === 'en' && post.imageAltEn ? post.imageAltEn : (post.imageAlt ?? title);
  const category = post.category as BlogCategory;
  const content = locale === 'en' && post.contentEn ? post.contentEn : post.content;
  const faq = Array.isArray(post.faq) && post.faq.length > 0 ? (post.faq as BlogFaqItem[]) : null;

  const paragraphs = content.split('\n\n');

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/g, 'l')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  const tocItems: TocItem[] = paragraphs
    .filter((block) => block.startsWith('## ') || block.startsWith('### '))
    .map((block) => {
      const isH3 = block.startsWith('### ');
      const text = block.replace(/^#{2,3}\s/, '');
      return { id: slugify(text), text, level: (isH3 ? 3 : 2) as 2 | 3 };
    });

  const faqJsonLd = faq
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      }
    : null;

  const siteUrl = `https://${BRAND.domain}`;
  const postUrl = `${siteUrl}/${locale}/blog/${slug}`;

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: excerpt,
    author: {
      '@type': 'Person',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: BRAND.name,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/images/logo.png`,
      },
    },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': postUrl,
    },
    ...(post.imageSrc
      ? { image: `${siteUrl}${post.imageSrc}` }
      : {}),
  };

  return (
    <article className="py-16">
      <BreadcrumbSchema
        locale={locale}
        items={[
          { name: 'Blog', path: '/blog' },
          { name: title, path: `/blog/${slug}` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      {/* Hero + Content */}
      <div className="container mx-auto px-4 md:px-6 max-w-3xl">
        {/* Back link */}
        <Link
          href="/blog"
          className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-sage-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToBlog')}
        </Link>

        {/* Meta */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Badge variant="sage">{t(CATEGORY_T_KEY[category] ?? 'catPoradyDietetyczne')}</Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {t('readTime', { minutes: post.readTime })}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            {post.author}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(post.publishedAt).toLocaleDateString(locale, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>

        <h1 className="mb-8 text-3xl font-extrabold leading-snug tracking-tight sm:text-4xl">
          {title}
        </h1>

        <p className="mb-8 text-lg text-muted-foreground">{excerpt}</p>

        {/* Cover image */}
        <div className="mb-10 relative h-64 sm:h-80 rounded-3xl overflow-hidden bg-gradient-to-br from-sage-100 to-sage-300">
          {post.imageSrc ? (
            <Image
              src={post.imageSrc}
              alt={imageAlt}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sage-500 text-7xl font-black opacity-20">{category[0]}</span>
            </div>
          )}
        </div>

        {/* Table of Contents */}
        <TableOfContents items={tocItems} title={t('tocTitle')} />

        {/* Content */}
        <div className="prose prose-lg prose-sage max-w-none">
          {paragraphs.map((block, idx) => {
            if (block.startsWith('### ')) {
              const text = block.replace('### ', '');
              return (
                <h3 key={idx} id={slugify(text)} className="text-xl font-semibold text-foreground mt-6 mb-3">
                  {text}
                </h3>
              );
            }
            if (block.startsWith('## ')) {
              const text = block.replace('## ', '');
              return (
                <h2 key={idx} id={slugify(text)} className="text-2xl font-bold text-foreground mt-8 mb-4">
                  {text}
                </h2>
              );
            }
            return (
              <p key={idx} className="text-muted-foreground leading-relaxed mb-5">
                {block}
              </p>
            );
          })}
        </div>

        {/* FAQ */}
        {faq && <FaqSection faq={faq} />}

        {/* Author */}
        <AuthorBox name={post.author} locale={locale} aboutLabel={t('aboutAuthor')} />

        {/* CTA */}
        <BlogCTA />
      </div>

      {/* Related + Latest — wider container */}
      <div className="container mx-auto px-4 md:px-6 max-w-6xl">
        <RelatedPosts category={category} currentSlug={slug} />
        <LatestPosts currentSlug={slug} />
      </div>
    </article>
  );
}
