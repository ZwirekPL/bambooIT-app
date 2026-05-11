'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Star, Loader2, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { Testimonial } from '@/types/api';

export function TestimonialForm() {
  const t = useTranslations('dashboard.testimonial');
  const { data: session } = useSession();
  const token = '';

  const [existing, setExisting] = useState<Testimonial | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [content, setContent] = useState('');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    if (!token) return;
    api.testimonials
      .getMy(token)
      .then((res) => {
        setExisting(res.testimonial);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || content.length < 10) return;

    setSubmitting(true);
    setSuccess(false);
    try {
      const res = await api.testimonials.create({ content, rating }, token);
      setExisting(res.testimonial);
      setSuccess(true);
    } catch {
      // error
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!token) return;
    setDeleting(true);
    try {
      await api.testimonials.deleteMy(token);
      setExisting(null);
      setContent('');
      setRating(5);
    } catch {
      // error
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Already submitted
  if (existing) {
    const statusLabel =
      existing.status === 'APPROVED'
        ? t('statusApproved')
        : existing.status === 'REJECTED'
          ? t('statusRejected')
          : t('statusPending');

    const statusColor =
      existing.status === 'APPROVED'
        ? 'text-green-600'
        : existing.status === 'REJECTED'
          ? 'text-red-600'
          : 'text-yellow-600';

    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('alreadySubmitted')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-0.5 mb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-5 w-5 ${i <= existing.rating ? 'fill-brand-orange text-brand-orange' : 'text-muted-foreground'}`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">&ldquo;{existing.content}&rdquo;</p>
          <p className="text-sm">
            {t('status')}: <span className={`font-medium ${statusColor}`}>{statusLabel}</span>
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
            {t('delete')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Form to submit new testimonial
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            {t('submitSuccess')}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating */}
          <div>
            <label className="text-sm font-medium mb-2 block">{t('ratingLabel')}</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  onMouseEnter={() => setHoverRating(i)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-0.5 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-7 w-7 ${
                      i <= (hoverRating || rating)
                        ? 'fill-brand-orange text-brand-orange'
                        : 'text-muted-foreground'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label htmlFor="testimonial-content" className="text-sm font-medium mb-2 block">
              {t('contentLabel')}
            </label>
            <Textarea
              id="testimonial-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('contentPlaceholder')}
              rows={4}
              maxLength={1000}
              required
              minLength={10}
            />
            <p className="mt-1 text-xs text-muted-foreground">{content.length}/1000</p>
          </div>

          <Button type="submit" variant="sage" disabled={submitting || content.length < 10}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                {t('submitting')}
              </>
            ) : (
              t('submit')
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
