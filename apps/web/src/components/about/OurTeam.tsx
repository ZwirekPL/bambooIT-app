'use client';

import { useTranslations } from 'next-intl';
import { GraduationCap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/** Gradient ring styles per team member (cycles through brand palette) */
const memberGradients = [
  { ring: 'from-brand-green to-ai-blue', bg: 'from-[hsl(138,64%,34%,0.15)] to-[hsl(220,100%,56%,0.15)]' },
  { ring: 'from-brand-orange to-brand-green', bg: 'from-[hsl(30,100%,48%,0.15)] to-[hsl(138,64%,34%,0.15)]' },
  { ring: 'from-ai-blue to-brand-orange', bg: 'from-[hsl(220,100%,56%,0.15)] to-[hsl(30,100%,48%,0.15)]' },
  { ring: 'from-brand-green to-brand-orange', bg: 'from-[hsl(138,64%,34%,0.15)] to-[hsl(30,100%,48%,0.15)]' },
  { ring: 'from-ai-blue to-brand-green', bg: 'from-[hsl(220,100%,56%,0.15)] to-[hsl(138,64%,34%,0.15)]' },
  { ring: 'from-brand-orange to-ai-blue', bg: 'from-[hsl(30,100%,48%,0.15)] to-[hsl(220,100%,56%,0.15)]' },
] as const;

/** Derive initials placeholder from a slot index */
const memberInitials = ['DJ', 'DK', 'AI', 'CT', 'DS', 'PM'];

export function OurTeam() {
  const t = useTranslations('about.team');

  const members = [1, 2, 3, 4, 5, 6].map((n, idx) => ({
    gradient: memberGradients[idx],
    initials: memberInitials[idx],
    name: t(`member${n}Name` as Parameters<typeof t>[0]),
    role: t(`member${n}Role` as Parameters<typeof t>[0]),
    spec: t(`member${n}Spec` as Parameters<typeof t>[0]),
    credentials: t(`member${n}Credentials` as Parameters<typeof t>[0]),
    education: t(`member${n}Education` as Parameters<typeof t>[0]),
  }));

  return (
    <section className="py-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {t('title')}
          </h2>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="mx-auto max-w-5xl grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {members.map(({ gradient, initials, name, role, spec, credentials, education }, idx) => (
            <Card
              key={idx}
              className="rounded-[20px] border border-border bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-4">
                  {/* Avatar with gradient ring */}
                  <div
                    className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full p-[3px] bg-gradient-to-br ${gradient.ring}`}
                  >
                    <div
                      className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ${gradient.bg} text-sm font-bold text-foreground/70`}
                    >
                      {initials}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-sm leading-tight">{name}</p>
                    <p className="truncate text-xs font-medium text-brand-green mt-0.5">{role}</p>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-muted-foreground">{spec}</p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/70">
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>{credentials} · {education}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
