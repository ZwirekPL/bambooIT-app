import { BRAND } from '@config/brand';
import { cn } from '@/lib/utils';

/**
 * bambooIT text wordmark with bamboo-green accents on `m` and `it`.
 * Used in the header and on the auth pages (login / register / reset / verify)
 * — a pure span so it renders in both server and client components and never
 * depends on a binary logo asset.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn('font-display font-black tracking-tight leading-none', className)}
      aria-label={BRAND.shortName}
    >
      ba<span className="text-bamboo">m</span>boo<span className="text-bamboo">it</span>
    </span>
  );
}
