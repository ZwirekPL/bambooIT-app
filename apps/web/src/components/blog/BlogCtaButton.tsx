'use client';

import { Link } from '@/i18n/navigation';

interface BlogCtaButtonProps {
  label: string;
}

export function BlogCtaButton({ label }: BlogCtaButtonProps) {
  return (
    <Link
      href="/audyt"
      className="inline-flex items-center justify-center gap-3 rounded-full bg-bamboo px-9 py-4 text-sm font-bold text-navy-deep transition-all hover:-translate-y-0.5 hover:bg-white"
    >
      {label}
    </Link>
  );
}
