import { Scale, Coffee, BarChart3, ShoppingCart, BookOpen, RefreshCw, CalendarDays } from 'lucide-react';

interface MealPlanContentsProps {
  title: string;
  items: [string, string, string, string, string, string, string];
}

const ICONS = [Scale, Coffee, BarChart3, ShoppingCart, BookOpen, RefreshCw, CalendarDays] as const;

export function MealPlanContents({ title, items }: MealPlanContentsProps) {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">{title}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-3xl mx-auto">
          {items.map((item, idx) => {
            const Icon = ICONS[idx];
            return (
              <div key={idx} className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-green/10 text-brand-green">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-foreground">{item}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
