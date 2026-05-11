'use client';

import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { Search, ArrowRight } from 'lucide-react';

interface BlogHeroProps {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  ctaLabel: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export function BlogHero({
  title,
  subtitle,
  searchPlaceholder,
  ctaLabel,
  searchValue,
  onSearchChange,
}: BlogHeroProps) {
  return (
    <section className="relative overflow-hidden bg-[#F5F0E8]">
      {/* Background image */}
      <Image
        src="/blog/images/hero-blog.png"
        alt=""
        fill
        priority
        className="object-cover object-right"
        aria-hidden="true"
      />

      {/* Gradient overlay — opaque on left, transparent on right */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to right, #F5F0E8 45%, rgba(245,240,232,0.7) 65%, rgba(245,240,232,0) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 md:px-6">
        <div className="py-20 md:py-28 max-w-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-sage-600 mb-3">BLOG</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight text-foreground mb-4">
            {title}
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg mb-8">{subtitle}</p>

          {/* Search + CTA row */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-input bg-white/90 focus:outline-none focus:ring-2 focus:ring-sage-400"
              />
            </div>
            <Link
              href="/wywiad"
              className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 transition-colors shrink-0"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
