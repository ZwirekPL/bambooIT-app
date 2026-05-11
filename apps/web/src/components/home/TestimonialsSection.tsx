'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import type { PublicTestimonial } from '@/types/api';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('');
}

export function TestimonialsSection() {
  const t = useTranslations('home.testimonials');
  const [dynamicItems, setDynamicItems] = useState<PublicTestimonial[]>([]);

  useEffect(() => {
    api.testimonials
      .getApproved()
      .then((res) => setDynamicItems(res.testimonials))
      .catch(() => {});
  }, []);

  // Static fallback items
  const staticItems = [1, 2, 3, 4, 5].map((n) => ({
    name: t(`item${n}Name` as Parameters<typeof t>[0]),
    role: t(`item${n}Role` as Parameters<typeof t>[0]),
    text: t(`item${n}Text` as Parameters<typeof t>[0]),
  }));

  const hasDynamic = dynamicItems.length > 0;

  function getDisplayName(item: PublicTestimonial): string {
    const first = item.user?.patient?.firstName;
    const last = item.user?.patient?.lastName;
    if (first && last) return `${first} ${last[0]}.`;
    if (first) return first;
    return t('anonymousUser');
  }

  return (
    <section className="bg-background py-24">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-12 text-center">
          <Badge variant="brand-green" className="mb-4">
            {t('badge')}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h2>
        </div>

        {/* Masonry-like grid */}
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {hasDynamic
            ? dynamicItems.map((item) => {
                const name = getDisplayName(item);
                return (
                  <Card key={item.id} className="mb-4 break-inside-avoid transition-shadow hover:shadow-md">
                    <CardContent className="p-6">
                      <div className="mb-4 flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${i < item.rating ? 'fill-brand-orange text-brand-orange' : 'text-muted-foreground'}`}
                          />
                        ))}
                      </div>
                      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                        &ldquo;{item.content}&rdquo;
                      </p>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-brand-green/10 text-brand-green text-xs">
                            {getInitials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold">{name}</p>
                          <p className="text-xs text-muted-foreground">{t('userRole')}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            : staticItems.map(({ name, role, text }, idx) => (
                <Card key={idx} className="mb-4 break-inside-avoid transition-shadow hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="mb-4 flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-brand-orange text-brand-orange" />
                      ))}
                    </div>
                    <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                      &ldquo;{text}&rdquo;
                    </p>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-brand-green/10 text-brand-green text-xs">
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">{name}</p>
                        <p className="text-xs text-muted-foreground">{role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Medical disclaimer */}
        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          {t('disclaimer')}
        </p>
      </div>
    </section>
  );
}
