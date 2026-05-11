import { ShieldCheck } from 'lucide-react';

interface NoRiskSectionProps {
  title: string;
  text: string;
}

export function NoRiskSection({ title, text }: NoRiskSectionProps) {
  return (
    <section className="py-16 bg-brand-green/5">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mx-auto max-w-xl text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-green/15 text-brand-green">
              <ShieldCheck className="h-7 w-7" />
            </div>
          </div>
          <h2 className="mb-3 text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-muted-foreground">{text}</p>
        </div>
      </div>
    </section>
  );
}
