'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Apple, ChefHat, Microscope, FlaskConical, Sparkles } from 'lucide-react';

interface DatabaseStats {
  products: number;
  recipes: number;
  verifiedRecipes: number;
  nutrientCoverage: {
    macro: { fields: number; avgCoveragePct: number };
    micro: { fields: number; avgCoveragePct: number };
    totalTrackedNutrients: number;
  };
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    const duration = 1500;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className="tabular-nums">
      {display.toLocaleString('pl-PL')}{suffix}
    </span>
  );
}

function StatCard({
  icon: Icon,
  iconClass,
  value,
  suffix,
  label,
  description,
}: {
  icon: React.ElementType;
  iconClass: string;
  value: number;
  suffix?: string;
  label: string;
  description: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className={`inline-flex items-center justify-center rounded-xl p-3 ${iconClass}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-4">
        <div className="text-3xl font-bold tracking-tight text-foreground">
          <AnimatedNumber value={value} suffix={suffix} />
        </div>
        <div className="mt-1 text-sm font-semibold text-foreground">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</div>
      </div>
    </div>
  );
}

function CoverageBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-bold text-primary tabular-nums">{pct}%</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function DatabaseStatsSection() {
  const t = useTranslations('home.stats');
  const [stats, setStats] = useState<DatabaseStats | null>(null);

  useEffect(() => {
    fetch('/api/proxy/stats/database')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setStats(data);
      })
      .catch(() => { /* silent */ });
  }, []);

  if (!stats) return null;

  const cards = [
    {
      icon: Apple,
      iconClass: 'bg-emerald-50 text-emerald-600',
      value: stats.products,
      label: t('productsLabel') ?? 'Produktów spożywczych',
      description: t('productsDesc') ?? 'Polska baza produktów z pełnym profilem odżywczym — makro, mikro, witaminy, minerały',
    },
    {
      icon: ChefHat,
      iconClass: 'bg-amber-50 text-amber-600',
      value: stats.recipes,
      label: t('recipesLabel') ?? 'Przepisów',
      description: t('recipesDesc') ?? 'Gotowe przepisy z instrukcjami, wartościami odżywczymi i ocenami pacjentów',
    },
    {
      icon: Microscope,
      iconClass: 'bg-blue-50 text-blue-600',
      value: stats.nutrientCoverage.totalTrackedNutrients,
      label: t('nutrientsLabel') ?? 'Śledzonych składników',
      description: t('nutrientsDesc') ?? 'Witaminy, minerały, aminokwasy, kwasy tłuszczowe — dla każdego produktu',
    },
  ];

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-sage-50/40 to-transparent">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              {t('badge') ?? 'Nasza baza danych'}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            {t('title') ?? 'Solidne fundamenty Twojej diety'}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t('subtitle') ?? 'Każdy plan diety opiera się na naukowych danych. Nasza baza jest stale rozbudowywana i weryfikowana przez dietetyków.'}
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-12">
          {cards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>

        {/* Nutrient coverage */}
        <div className="max-w-xl mx-auto">
          <div className="rounded-2xl border border-border bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="inline-flex items-center justify-center rounded-xl p-2.5 bg-primary/10">
                <FlaskConical className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {t('coverageTitle') ?? 'Pokrycie danych odżywczych'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t('coverageSubtitle') ?? 'Procent produktów z uzupełnionymi danymi'}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <CoverageBar
                label={t('macroCoverage') ?? `Makroskładniki (${stats.nutrientCoverage.macro.fields} pól)`}
                pct={stats.nutrientCoverage.macro.avgCoveragePct}
              />
              <CoverageBar
                label={t('microCoverage') ?? `Mikroskładniki (${stats.nutrientCoverage.micro.fields} pól)`}
                pct={stats.nutrientCoverage.micro.avgCoveragePct}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
