'use client';

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
    <section className="relative overflow-hidden bg-paper px-5 pb-16 pt-32 md:px-12 md:pb-20 md:pt-44 lg:pt-52">
      {/* Decorative grid background — same pattern as homepage hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          maskImage: 'radial-gradient(ellipse at 30% 50%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 30% 50%, black 30%, transparent 75%)',
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[1440px]">
        <div className="mb-8 flex items-center gap-3.5 font-mono text-xs uppercase tracking-[0.2em] text-bamboo-deep">
          <span aria-hidden="true" className="h-px w-8 bg-bamboo-deep" />
          Blog
        </div>

        <h1 className="max-w-[20ch] whitespace-pre-line font-display text-4xl font-light leading-[0.95] tracking-[-0.04em] text-navy md:text-6xl lg:text-7xl xl:text-8xl">
          {title}
        </h1>

        <p className="mt-8 max-w-[60ch] text-base leading-[1.6] text-navy-soft md:text-lg">
          {subtitle}
        </p>

        {/* Search + CTA row */}
        <div className="mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-soft"
            />
            <input
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-full border border-line-strong bg-white/80 py-3.5 pl-11 pr-5 text-sm text-navy placeholder:text-navy-soft/60 outline-none transition-colors focus:border-bamboo-deep"
            />
          </div>
          <Link
            href="/audyt"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-bamboo px-7 py-3.5 text-sm font-semibold text-navy-deep transition-all hover:-translate-y-0.5 hover:bg-bamboo-deep"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
