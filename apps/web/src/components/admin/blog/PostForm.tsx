'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { BlogPost } from '@/types/api';
import { BLOG_CATEGORY_LIST } from '@/config/blogCategories';
import { BRAND } from '@config/brand';

const FALLBACK_CATEGORIES = BLOG_CATEGORY_LIST.map((c) => c.name);
const DEFAULT_CATEGORY = BLOG_CATEGORY_LIST[0]?.name ?? 'Obsługa IT';
const DEFAULT_AUTHOR = BRAND.author.name;

interface PostFormProps {
  post?: BlogPost;
  token: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Convert a Date to `YYYY-MM-DDTHH:MM` in the user's local timezone (for datetime-local inputs). */
function toLocalDatetimeString(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function Required() {
  return <span className="text-destructive font-semibold ml-0.5">*</span>;
}

export function PostForm({ post, token }: PostFormProps) {
  const router = useRouter();
  const isEdit = !!post;

  const [form, setForm] = useState({
    slug: post?.slug ?? '',
    title: post?.title ?? '',
    titleEn: post?.titleEn ?? '',
    excerpt: post?.excerpt ?? '',
    excerptEn: post?.excerptEn ?? '',
    content: post?.content ?? '',
    contentEn: post?.contentEn ?? '',
    category: post?.category ?? DEFAULT_CATEGORY,
    author: post?.author ?? DEFAULT_AUTHOR,
    imageSrc: post?.imageSrc ?? '',
    imageAlt: post?.imageAlt ?? '',
    imageAltEn: post?.imageAltEn ?? '',
    readTime: post?.readTime ?? 5,
    publishedAt: post?.publishedAt
      ? new Date(post.publishedAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    published: post?.published ?? false,
    scheduledAt: post?.scheduledAt
      ? toLocalDatetimeString(new Date(post.scheduledAt))
      : '',
  });

  const [faq, setFaq] = useState<{ question: string; answer: string }[]>(
    Array.isArray(post?.faq) ? (post.faq as { question: string; answer: string }[]) : []
  );

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLang, setPreviewLang] = useState<'pl' | 'en'>('pl');
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.admin.blogCategories
      .list(token)
      .then((res) => {
        const active = res.categories
          .filter((c) => c.isActive)
          .map((c) => c.name);
        if (active.length > 0) setCategories(active);
      })
      .catch(() => {
        // Keep fallback categories on error
      });
  }, [token]);

  async function handleImageUpload(file: File) {
    setUploading(true);
    setError('');
    try {
      const { url } = await api.admin.blog.uploadImage(file, token);
      set('imageSrc', url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setUploading(false);
    }
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const data = {
        ...form,
        titleEn: form.titleEn || undefined,
        excerptEn: form.excerptEn || undefined,
        contentEn: form.contentEn || undefined,
        imageSrc: form.imageSrc || undefined,
        imageAlt: form.imageAlt || undefined,
        imageAltEn: form.imageAltEn || undefined,
        readTime: Number(form.readTime),
        publishedAt: new Date(form.publishedAt).toISOString(),
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        faq: faq.length > 0 ? faq : undefined,
      };

      if (isEdit) {
        await api.admin.blog.update(post.id, data, token);
      } else {
        await api.admin.blog.create(data, token);
      }

      router.push('/admin/blog');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd. Spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <p className="text-xs text-muted-foreground">
        Pola oznaczone <span className="text-destructive font-semibold">*</span> są wymagane.
      </p>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Podstawowe informacje
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Tytuł (PL)<Required /></Label>
              <Input
                id="title"
                value={form.title}
                required
                onChange={(e) => {
                  set('title', e.target.value);
                  if (!isEdit) set('slug', slugify(e.target.value));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="titleEn">Tytuł (EN)</Label>
              <Input
                id="titleEn"
                value={form.titleEn}
                onChange={(e) => set('titleEn', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug<Required /></Label>
            <Input
              id="slug"
              value={form.slug}
              required
              pattern="[a-z0-9-]+"
              onChange={(e) => set('slug', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Małe litery, cyfry i myślniki. URL artykułu: /blog/{form.slug || '...'}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="excerpt">Opis skrócony (PL)<Required /></Label>
              <textarea
                id="excerpt"
                value={form.excerpt}
                required
                rows={3}
                className={cn('flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring')}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('excerpt', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="excerptEn">Opis skrócony (EN)</Label>
              <textarea
                id="excerptEn"
                value={form.excerptEn}
                rows={3}
                className={cn('flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring')}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('excerptEn', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Treść PL (Markdown)<Required />
          </h2>
          <textarea
            id="content"
            value={form.content}
            required
            rows={20}
            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('content', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Używaj ## dla nagłówków, akapity oddziela pusta linia.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Treść EN (Markdown)
          </h2>
          <textarea
            id="contentEn"
            value={form.contentEn}
            rows={20}
            placeholder="English version of the article content (optional)"
            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('contentEn', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Optional. Use ## for headings, separate paragraphs with blank lines.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Metadane
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="category">Kategoria<Required /></Label>
              <select
                id="category"
                value={form.category}
                required
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('category', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="author">Autor<Required /></Label>
              <Input
                id="author"
                value={form.author}
                required
                onChange={(e) => set('author', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="readTime">Czas czytania (min)<Required /></Label>
              <Input
                id="readTime"
                type="number"
                min={1}
                max={120}
                value={form.readTime}
                required
                onChange={(e) => set('readTime', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="publishedAt">Data publikacji<Required /></Label>
              <Input
                id="publishedAt"
                type="date"
                value={form.publishedAt}
                required
                onChange={(e) => set('publishedAt', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scheduledAt">Zaplanowana publikacja</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => {
                  set('scheduledAt', e.target.value);
                  if (e.target.value) set('published', true);
                }}
              />
              <p className="text-xs text-muted-foreground">
                {form.scheduledAt
                  ? `Post pojawi si\u0119 publicznie ${new Date(form.scheduledAt).toLocaleString('pl-PL')}`
                  : 'Brak \u2014 post widoczny natychmiast po opublikowaniu'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Obraz hero</Label>
            <div className="flex items-start gap-4">
              {form.imageSrc && (
                <div className="relative h-24 w-40 rounded-md overflow-hidden border border-border shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.imageSrc}
                    alt={form.imageAlt || 'Hero'}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="space-y-2 flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? 'Przesyłanie...' : form.imageSrc ? 'Zmień obraz' : 'Wybierz obraz'}
                </Button>
                {form.imageSrc && (
                  <p className="text-xs text-muted-foreground truncate">{form.imageSrc}</p>
                )}
                <p className="text-xs text-muted-foreground">JPEG, PNG, WebP lub AVIF. Maks. 5 MB.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="imageAlt">Alt obrazu (PL)</Label>
              <Input
                id="imageAlt"
                value={form.imageAlt}
                onChange={(e) => set('imageAlt', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imageAltEn">Alt obrazu (EN)</Label>
              <Input
                id="imageAltEn"
                value={form.imageAltEn}
                onChange={(e) => set('imageAltEn', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="published"
              checked={form.published}
              className="h-4 w-4 rounded border-input accent-sage-600"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('published', e.target.checked)}
            />
            <Label htmlFor="published">Opublikowany (widoczny na blogu)</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              FAQ — Najczęściej zadawane pytania
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFaq((prev) => [...prev, { question: '', answer: '' }])}
            >
              + Dodaj pytanie
            </Button>
          </div>
          {faq.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Brak pytań. Dodaj FAQ, aby wzbogacić artykuł o strukturalne dane SEO.
            </p>
          )}
          {faq.map((item, idx) => (
            <div key={idx} className="rounded-lg border border-border p-4 space-y-3 relative">
              <button
                type="button"
                aria-label="Usuń pytanie"
                className="absolute top-3 right-3 text-muted-foreground hover:text-destructive text-xs"
                onClick={() => setFaq((prev) => prev.filter((_, i) => i !== idx))}
              >
                ✕
              </button>
              <div className="space-y-1.5">
                <Label htmlFor={`faq-q-${idx}`}>Pytanie {idx + 1}</Label>
                <Input
                  id={`faq-q-${idx}`}
                  value={item.question}
                  placeholder="Jakie pytanie zadają czytelnicy?"
                  onChange={(e) =>
                    setFaq((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, question: e.target.value } : it))
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`faq-a-${idx}`}>Odpowiedź</Label>
                <textarea
                  id={`faq-a-${idx}`}
                  value={item.answer}
                  rows={3}
                  placeholder="Krótka, konkretna odpowiedź..."
                  className={cn('flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring')}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFaq((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, answer: e.target.value } : it))
                    )
                  }
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Zapisywanie…' : isEdit ? 'Zapisz zmiany' : 'Utwórz artykuł'}
        </Button>
        <Button type="button" variant="outline" onClick={() => setShowPreview(true)} className="gap-1.5">
          <Eye className="h-4 w-4" />
          Podgląd
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/blog')}>
          Anuluj
        </Button>
      </div>

      {/* Preview drawer (50.1) */}
      <Sheet open={showPreview} onOpenChange={setShowPreview}>
        <SheetContent className="w-[600px] sm:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Podgląd artykułu</SheetTitle>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant={previewLang === 'pl' ? 'default' : 'outline'}
                onClick={() => setPreviewLang('pl')}
                className="text-xs"
              >
                PL
              </Button>
              {form.contentEn && (
                <Button
                  size="sm"
                  variant={previewLang === 'en' ? 'default' : 'outline'}
                  onClick={() => setPreviewLang('en')}
                  className="text-xs"
                >
                  EN
                </Button>
              )}
            </div>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {/* Hero image */}
            {form.imageSrc && (
              <div className="relative w-full h-48 rounded-lg overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imageSrc} alt={previewLang === 'en' && form.imageAltEn ? form.imageAltEn : form.imageAlt || form.title} className="absolute inset-0 w-full h-full object-cover" />
              </div>
            )}

            {/* Meta */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {form.category && <span>{form.category}</span>}
              {form.readTime > 0 && <span>· {form.readTime} min czytania</span>}
              {form.publishedAt && <span>· {new Date(form.publishedAt).toLocaleDateString('pl-PL')}</span>}
              {form.author && <span>· {form.author}</span>}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold tracking-tight">
              {previewLang === 'en' && form.titleEn ? form.titleEn : form.title || 'Brak tytułu'}
            </h1>

            {/* Excerpt */}
            <p className="text-muted-foreground text-lg leading-relaxed">
              {previewLang === 'en' && form.excerptEn ? form.excerptEn : form.excerpt}
            </p>

            {/* Content */}
            <div className="prose prose-sage max-w-none">
              {(() => {
                const raw = previewLang === 'en' && form.contentEn ? form.contentEn : form.content;
                if (!raw) return <p className="text-muted-foreground italic">Brak treści</p>;
                return raw.split('\n\n').map((block: string, idx: number) => {
                  const trimmed = block.trim();
                  if (!trimmed) return null;
                  if (trimmed.startsWith('### ')) {
                    return <h3 key={idx} className="text-xl font-semibold mt-6 mb-2">{trimmed.replace('### ', '')}</h3>;
                  }
                  if (trimmed.startsWith('## ')) {
                    return <h2 key={idx} className="text-2xl font-bold mt-8 mb-3">{trimmed.replace('## ', '')}</h2>;
                  }
                  return <p key={idx} className="text-muted-foreground leading-relaxed mb-4">{trimmed}</p>;
                });
              })()}
            </div>

            {/* FAQ */}
            {faq.length > 0 && faq[0].question && (
              <div className="border-t border-border pt-6">
                <h2 className="text-xl font-bold mb-4">FAQ</h2>
                <div className="space-y-4">
                  {faq.filter((f) => f.question).map((f, idx) => (
                    <div key={idx}>
                      <h3 className="font-semibold">{f.question}</h3>
                      <p className="text-muted-foreground mt-1">{f.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </form>
  );
}
