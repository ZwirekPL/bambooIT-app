import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { CheckoutProductType } from '@/types/api';

export type PricingCardVariant = 'free' | 'popular' | 'premium' | 'one-time';

interface PricingCardProps {
  variant?: PricingCardVariant;
  name: string;
  price: string;
  period: string;
  description?: string;
  afterPrice?: string;
  features?: string[];
  ctaLabel: string;
  popularLabel?: string;
  badgeLabel?: string;
  productType?: CheckoutProductType;
  onCtaClick?: () => void;
  ctaLoading?: boolean;
  ctaHref?: string;
}

export function PricingCard({
  variant = 'free',
  name,
  price,
  period,
  description,
  afterPrice,
  features = [],
  ctaLabel,
  popularLabel,
  badgeLabel,
  productType,
  onCtaClick,
  ctaLoading,
  ctaHref: ctaHrefProp,
}: PricingCardProps) {
  const isPopular = variant === 'popular';
  const isPremium = variant === 'premium';
  const isOneTime = variant === 'one-time';

  const nameColor = isPopular
    ? 'text-brand-orange'
    : isPremium
      ? 'text-ai-blue'
      : isOneTime
        ? 'text-foreground'
        : 'text-muted-foreground';

  const checkColor = isPopular
    ? 'text-brand-orange'
    : isPremium
      ? 'text-ai-blue'
      : 'text-brand-green';

  const defaultHref = productType ? (`/zamow?product=${productType}` as const) : '/zaloguj';
  const ctaHref = ctaHrefProp ?? defaultHref;

  function renderCta() {
    const buttonVariant = isPopular
      ? 'orange' as const
      : isPremium
        ? undefined
        : 'sage-outline' as const;

    const premiumClass = isPremium ? 'bg-ai-blue text-white hover:bg-ai-blue/90' : '';

    // Interactive button (client-side checkout)
    if (onCtaClick) {
      return (
        <Button
          variant={buttonVariant}
          size="lg"
          className={cn('w-full mt-auto', premiumClass)}
          onClick={onCtaClick}
          disabled={ctaLoading}
        >
          {ctaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : ctaLabel}
        </Button>
      );
    }

    // Link button (navigation)
    return (
      <Button
        asChild
        variant={buttonVariant}
        size="lg"
        className={cn('w-full mt-auto', premiumClass)}
      >
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>
    );
  }

  return (
    <Card
      className={cn(
        'relative flex flex-col transition-shadow hover:shadow-lg',
        isPopular && 'border-brand-orange border-2 shadow-md',
        isPremium && 'border-ai-blue border-2'
      )}
    >
      {/* Badge row — always reserves same height so all cards align */}
      <div className="flex h-7 items-center justify-center pt-4">
        {isPopular && popularLabel && (
          <Badge variant="brand-orange" className="px-4 py-1 text-xs font-semibold">
            {popularLabel}
          </Badge>
        )}
        {isOneTime && badgeLabel && (
          <Badge variant="outline" className="px-4 py-1 text-xs font-semibold text-muted-foreground border-muted-foreground/40">
            {badgeLabel}
          </Badge>
        )}
      </div>

      <CardHeader className="px-7 pb-4 pt-2">
        <p className={cn('text-sm font-semibold uppercase tracking-wide', nameColor)}>{name}</p>
        <div className="mt-2 flex items-end gap-1">
          <span className="text-4xl font-extrabold text-foreground">{price}</span>
          <span className="mb-1 text-sm text-muted-foreground">{period}</span>
        </div>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        {afterPrice && <p className="mt-1 text-xs font-medium text-muted-foreground">{afterPrice}</p>}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col px-7 pb-7 pt-0">
        {features.length > 0 && (
          <ul className="flex-1 space-y-3 mb-7">
            {features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm">
                <Check className={cn('mt-0.5 h-4 w-4 shrink-0', checkColor)} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        {renderCta()}
      </CardContent>
    </Card>
  );
}
