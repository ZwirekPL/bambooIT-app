'use client';

import { Link } from '@/i18n/navigation';

// TODO(4-cleanup): SmartCtaLink dropped in K4 (logged-in users would route to /dashboard,
// removed in K4 — diet panel). Simplified to anonymous-only CTA pointing to /zaloguj.
// Re-add login-aware variant in K11 after /panel rebuild.

interface BlogCtaButtonProps {
  label: string;
}

export function BlogCtaButton({ label }: BlogCtaButtonProps) {
  return (
    <Link
      href="/zaloguj"
      className="inline-flex items-center justify-center rounded-xl bg-sage-600 px-8 py-3 text-sm font-semibold text-white shadow hover:bg-sage-700 transition-colors"
    >
      {label}
    </Link>
  );
}
