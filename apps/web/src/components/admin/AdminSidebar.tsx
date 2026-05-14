'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { performFullLogout } from '@/lib/logout';
import { LayoutDashboard, Users, Building2, ScrollText, LogOut, PanelLeft, BookOpen, MessageSquareQuote, Apple, ChefHat, ShieldCheck, ClipboardList, Settings, Link2, Unlink, Cpu, Shield, Phone, CreditCard, Calculator, Repeat, Mail, Activity, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { BRAND } from '@config/brand';

const navItems = [
  { href: '/admin',              labelKey: 'nav.home',     icon: LayoutDashboard },
  { href: '/admin/leady',        labelKey: 'nav.leads',    icon: Inbox           },
  { href: '/admin/uzytkownicy',  labelKey: 'nav.users',    icon: Users           },
  // { href: '/admin/tenants',      labelKey: 'nav.tenants',  icon: Building2       },
  { href: '/admin/audit-log',    labelKey: 'nav.auditLog', icon: ScrollText      },
  { href: '/admin/blog',         labelKey: 'nav.blog',     icon: BookOpen        },
  { href: '/admin/opinie',       labelKey: 'nav.testimonials', icon: MessageSquareQuote },
  // { href: '/admin/produkty',     labelKey: 'nav.foodProducts', icon: Apple             },
  // { href: '/admin/przepisy',     labelKey: 'nav.recipes',      icon: ChefHat           },
  // { href: '/admin/scraper-stats', labelKey: 'nav.scraperStats', icon: Activity         },
  // { href: '/admin/solver-stats',  labelKey: 'nav.solverStats',  icon: Activity         },
  // { href: '/admin/reguly-kliniczne', labelKey: 'nav.clinicalRules', icon: ShieldCheck     },
  // { href: '/admin/protokoly',        labelKey: 'nav.protocols',     icon: ClipboardList   },
  // { href: '/admin/mapowania-protokolow', labelKey: 'nav.protocolTriggers', icon: Link2       },
  // { href: '/admin/konflikty-protokolow', labelKey: 'nav.protocolConflicts', icon: Unlink     },
  // { href: '/admin/konsultacje',       labelKey: 'nav.consultations',     icon: Phone      },
  { href: '/admin/subskrypcje',      labelKey: 'nav.subscriptions',     icon: Repeat    },
  { href: '/admin/platnosci',        labelKey: 'nav.payments',          icon: CreditCard },
  { href: '/admin/ksiegowosc',      labelKey: 'nav.accounting',        icon: Calculator },
  // { href: '/admin/koszty-ai',          labelKey: 'nav.aiCosts',           icon: Cpu        },
  { href: '/admin/email-kampanie',   labelKey: 'nav.emailCampaigns',    icon: Mail       },
  { href: '/admin/bezpieczenstwo',   labelKey: 'nav.security',          icon: Shield     },
  { href: '/admin/ustawienia',       labelKey: 'nav.settings',      icon: Settings        },
] as const;

interface AdminSidebarProps {
  email: string;
}

function NavLink({
  href,
  labelKey,
  icon: Icon,
  onClick,
}: {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  onClick?: () => void;
}) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const isActive =
    href === '/admin'
      ? pathname.endsWith('/admin')
      : pathname.includes(href.replace('/admin/', ''));

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-bamboo-deep/10 text-navy-deep'
          : 'text-navy-soft hover:bg-paper hover:text-navy-deep',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {t(labelKey)}
    </Link>
  );
}

function SidebarContent({ email, onLinkClick }: { email: string; onLinkClick?: () => void }) {
  const t = useTranslations('admin');

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-5 pb-3">
        <span className="font-display text-xl font-bold tracking-[-0.02em] text-navy-deep">
          bamboo
        </span>
        <span className="font-display text-xl font-bold tracking-[-0.02em] text-bamboo-deep">
          it
        </span>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-navy-soft">
          {t('title')}
        </p>
      </div>

      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {navItems.map(({ href, labelKey, icon }) => (
          <NavLink
            key={href}
            href={href}
            labelKey={labelKey}
            icon={icon}
            onClick={onLinkClick}
          />
        ))}
      </nav>

      <div className="border-t border-line px-3 py-4 space-y-2">
        <p className="truncate text-xs text-navy-soft px-1">{email}</p>
        <button
          type="button"
          onClick={() => performFullLogout('/')}
          className="flex w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-sm font-medium text-navy-soft transition-colors hover:bg-paper hover:text-navy-deep"
        >
          <LogOut className="h-4 w-4" />
          {t('logout')}
        </button>
      </div>
    </div>
  );
}

export function AdminSidebar({ email }: AdminSidebarProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('admin');

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-white">
        <SidebarContent email={email} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center border-b border-line bg-white px-2 py-2 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="ghost" aria-label={t('nav.menu')}>
              <PanelLeft className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-full max-w-64 p-0 overflow-y-auto">
            <SheetHeader className="sr-only">
              <SheetTitle>{BRAND.shortName}</SheetTitle>
            </SheetHeader>
            <SidebarContent email={email} onLinkClick={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
