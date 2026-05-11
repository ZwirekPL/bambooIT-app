'use client';

import { SmartCtaLink } from '@/components/shared/SmartCtaLink';

interface BlogCtaButtonProps {
  label: string;
}

export function BlogCtaButton({ label }: BlogCtaButtonProps) {
  return (
    <SmartCtaLink
      className="inline-flex items-center justify-center rounded-xl bg-sage-600 px-8 py-3 text-sm font-semibold text-white shadow hover:bg-sage-700 transition-colors"
    >
      {label}
    </SmartCtaLink>
  );
}
