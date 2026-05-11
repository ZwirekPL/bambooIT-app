import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline:        'text-foreground',
        sage:           'border-transparent bg-sage-100 text-sage-700 hover:bg-sage-200',
        'sage-outline': 'border-sage-300 text-sage-600 bg-transparent',
        /* ── Brand variants ── */
        'ai-blue':      'border-transparent bg-ai-blue/10 text-ai-blue',
        'brand-green':  'border-transparent bg-brand-green/10 text-brand-green',
        'brand-orange': 'border-transparent bg-brand-orange/10 text-brand-orange',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
