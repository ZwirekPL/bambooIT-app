import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface FaqItem {
  q: string;
  a: string;
}

interface OfertaFaqProps {
  title: string;
  items: FaqItem[];
}

export function OfertaFaq({ title, items }: OfertaFaqProps) {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">{title}</h2>
        <Accordion type="single" collapsible className="mx-auto max-w-2xl divide-y">
          {items.map((item, idx) => (
            <AccordionItem key={idx} value={`faq-${idx}`} className="border-0 py-1">
              <AccordionTrigger className="text-left font-medium hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
