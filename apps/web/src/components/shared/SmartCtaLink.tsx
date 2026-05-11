'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface SmartCtaLinkProps {
  /** Where to go when not logged in */
  guestHref?: string;
  /** Where to go when logged in */
  authHref?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * A CTA button that navigates based on authentication status:
 * - Not logged in → guestHref (default: /zaloguj)
 * - Logged in → authHref (default: /dashboard/wywiad)
 */
export function SmartCtaLink({
  guestHref = '/zaloguj',
  authHref = '/dashboard/wywiad',
  className,
  children,
}: SmartCtaLinkProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const handleClick = () => {
    if (session?.user) {
      router.push(authHref);
    } else {
      router.push(guestHref);
    }
  };

  return (
    <button onClick={handleClick} className={cn(className)}>
      {children}
    </button>
  );
}
