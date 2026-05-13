import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, Clock, User } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { CATEGORY_T_KEY } from '@/components/blog/category-t-key';
import { getCategoryStyle } from '@/components/blog/category-styles';
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
  const categoryBadge = getCategoryStyle(category);

  const paragraphs = content.split('\n\n');

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
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
        url: `${siteUrl}/logo.png`,
      },
    },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': postUrl,
    },
    ...(post.imageSrc ? { image: `${siteUrl}${post.imageSrc}` } : {}),
  };

  return (
    <article className="bg-paper pb-24 pt-32 md:pt-40 lg:pt-48">
      <BreadcrumbSchema
        locale={locale}
        items={[
          { name: 'Blog', path: '/blog' },
          { name: title, path: `/blog/${slug}` },
        ]}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      {/* Hero + content column */}
      <div className="mx-auto w-full max-w-3xl px-5 md:px-8">
        {/* Back link */}
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-[0.15em] text-navy-soft transition-colors hover:text-bamboo-deep"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('backToBlog')}
        </Link>

        {/* Meta row */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${categoryBadge.bg} ${categoryBadge.text}`}
          >
            {t(CATEGORY_T_KEY[category] ?? 'catObslugaIt')}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-xs text-navy-soft">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {t('readTime', { minutes: post.readTime })}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-xs text-navy-soft">
            <User className="h-3 w-3" aria-hidden="true" />
            {post.author}
          </span>
          <span className="font-mono text-xs text-navy-soft">
            {new Date(post.publishedAt).toLocaleDateString(locale, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>

        <h1 className="mb-6 font-display text-4xl font-light leading-[1] tracking-[-0.035em] text-navy md:text-5xl lg:text-6xl">
          {title}
        </h1>

        <p className="mb-10 text-lg leading-[1.55] text-navy-soft md:text-xl">{excerpt}</p>

        {/* Cover image */}
        <div className="relative mb-12 h-64 overflow-hidden rounded-3xl bg-gradient-to-br from-paper to-bamboo-soft/60 sm:h-80">
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
              <span className="font-display text-8xl font-black text-navy/10">{category[0]}</span>
            </div>
          )}
        </div>

        {/* Table of Contents */}
        <TableOfContents items={tocItems} title={t('tocTitle')} />

        {/* Markdown content */}
        <div className="prose prose-lg max-w-none">
          {paragraphs.map((block, idx) => {
            if (block.startsWith('### ')) {
              const text = block.replace('### ', '');
              return (
                <h3
                  key={idx}
                  id={slugify(text)}
                  className="mb-3 mt-8 font-display text-xl font-semibold tracking-[-0.02em] text-navy md:text-2xl"
                >
                  {text}
                </h3>
              );
            }
            if (block.startsWith('## ')) {
              const text = block.replace('## ', '');
              return (
                <h2
                  key={idx}
                  id={slugify(text)}
                  className="mb-4 mt-10 font-display text-2xl font-semibold tracking-[-0.02em] text-navy md:text-3xl"
                >
                  {text}
                </h2>
              );
            }
            return (
              <p key={idx} className="mb-5 text-base leading-[1.7] text-navy-soft md:text-lg">
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
      <div className="mx-auto w-full max-w-[1440px] px-5 md:px-12">
        <RelatedPosts category={category} currentSlug={slug} />
        <LatestPosts currentSlug={slug} />
      </div>
    </article>
  );
}
