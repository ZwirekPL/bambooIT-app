import { Search, Heart, Activity, ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ForWhomItem {
  label: string;
  plan: string;
}

interface ForWhomSectionProps {
  title: string;
  items: [ForWhomItem, ForWhomItem, ForWhomItem, ForWhomItem];
}

const ICONS = [Search, Heart, Activity, ShoppingBag] as const;

export function ForWhomSection({ title, items }: ForWhomSectionProps) {
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">{title}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
          {items.map((item, idx) => {
            const Icon = ICONS[idx];
            return (
              <Card
                key={idx}
                className="group transition-all duration-200 hover:shadow-md hover:-translate-y-1 cursor-default"
              >
                <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-green/10 text-brand-green group-hover:bg-brand-green group-hover:text-white transition-colors duration-200">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="font-semibold text-foreground">{item.label}</p>
                  <span className="rounded-full bg-brand-orange/10 px-3 py-1 text-xs font-medium text-brand-orange">
                    {item.plan}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
