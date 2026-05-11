'use client';

import { Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface GuideStep {
  instruction: string;
}

interface MeasurementEntry {
  id: string;
  label: string;
  unit: string;
  steps: GuideStep[];
  tip?: string;
}

const MEASUREMENTS: MeasurementEntry[] = [
  {
    id: 'waist',
    label: 'Talia (obwód pasa)',
    unit: 'cm',
    steps: [
      { instruction: 'Stań prosto, rozluźnij mięśnie brzucha — nie wciągaj.' },
      { instruction: 'Owiń taśmę mierniczą poziomo w najwęższym miejscu tułowia, zwykle w połowie między dolnym żebrem a wyrostkiem biodrowym.' },
      { instruction: 'Taśma powinna przylegać do ciała, ale nie uciskać.' },
      { instruction: 'Dokonaj pomiaru po normalnym wydechu.' },
    ],
    tip: 'Prawidłowy obwód pasa: kobiety < 80 cm (ryzyko przy ≥ 88 cm), mężczyźni < 94 cm (ryzyko przy ≥ 102 cm).',
  },
  {
    id: 'hip',
    label: 'Biodra (obwód bioder)',
    unit: 'cm',
    steps: [
      { instruction: 'Stań prosto ze stopami razem.' },
      { instruction: 'Owiń taśmę poziomo w najszerszym miejscu pośladków.' },
      { instruction: 'Taśma powinna być równoległa do podłogi.' },
    ],
    tip: 'WHR (talia÷biodra) < 0,85 dla kobiet i < 0,90 dla mężczyzn oznacza niskie ryzyko kardiometaboliczne.',
  },
  {
    id: 'chest',
    label: 'Klatka piersiowa',
    unit: 'cm',
    steps: [
      { instruction: 'Stań prosto z rękami lekko uniesionymi.' },
      { instruction: 'Owiń taśmę poziomo na poziomie linii sutkowej (brodawek piersiowych).' },
      { instruction: 'Opuść ręce i zmierz obwód po normalnym wydechu.' },
    ],
  },
  {
    id: 'thigh',
    label: 'Udo',
    unit: 'cm',
    steps: [
      { instruction: 'Stań prosto ze stopami na szerokość bioder.' },
      { instruction: 'Zmierz obwód uda w jego najszerszym miejscu, tuż poniżej pośladka.' },
      { instruction: 'Mierz zawsze to samo udo (zalecane: prawe) i w tej samej pozycji.' },
    ],
  },
  {
    id: 'arm',
    label: 'Ramię',
    unit: 'cm',
    steps: [
      { instruction: 'Unieś ramię poziomo (kąt 90°) i napiij mięsień bicepsa.' },
      { instruction: 'Owiń taśmę w najszerszym miejscu bicepsa.' },
      { instruction: 'Możesz mierzyć również rozluźnione ramię — zachowaj konsekwencję między pomiarami.' },
    ],
    tip: 'Mierz zawsze to samo ramię (zalecane: dominujące).',
  },
  {
    id: 'bodyFat',
    label: 'Tkanka tłuszczowa (%)',
    unit: '%',
    steps: [
      { instruction: 'Najdokładniejsza metoda domowa to analizator składu ciała (waga z funkcją BIA) lub fałdomierz.' },
      { instruction: 'Pomiar wykonuj rano, na czczo, po oddaniu moczu, przed ćwiczeniami.' },
      { instruction: 'Wyniki wahają się w zależności od nawodnienia — mierz zawsze w tych samych warunkach.' },
    ],
    tip: undefined,
  },
];

// Body fat reference ranges (approximate, based on ACSM / Gallagher 2000)
const BODY_FAT_REFERENCE = [
  { category: 'Niedobór', women: '< 10%', men: '< 3%', color: 'text-red-700' },
  { category: 'Niezbędny minimum', women: '10–13%', men: '3–5%', color: 'text-amber-700' },
  { category: 'Sportowcy', women: '14–20%', men: '6–13%', color: 'text-green-700' },
  { category: 'Sprawni', women: '21–24%', men: '14–17%', color: 'text-green-600' },
  { category: 'Przeciętny', women: '25–31%', men: '18–24%', color: 'text-amber-600' },
  { category: 'Otyłość', women: '≥ 32%', men: '≥ 25%', color: 'text-red-600' },
];

const WHR_REFERENCE = [
  { label: 'Niskie ryzyko (brzuszne)', women: '< 0,80', men: '< 0,90' },
  { label: 'Umiarkowane ryzyko', women: '0,80–0,85', men: '0,90–0,99' },
  { label: 'Wysokie ryzyko', women: '≥ 0,85', men: '≥ 1,00' },
];

export function MeasurementGuide() {
  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          Jak poprawnie mierzyć?
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="multiple" className="w-full">
          {MEASUREMENTS.map((m) => (
            <AccordionItem key={m.id} value={m.id}>
              <AccordionTrigger className="text-sm py-3">
                {m.label}
              </AccordionTrigger>
              <AccordionContent>
                <ol className="space-y-1.5 list-decimal list-inside">
                  {m.steps.map((step, i) => (
                    <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                      {step.instruction}
                    </li>
                  ))}
                </ol>
                {m.tip && (
                  <p className="mt-2 text-xs text-brand-green bg-green-50 rounded px-2 py-1.5">
                    {m.tip}
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}

          <AccordionItem value="whr-table">
            <AccordionTrigger className="text-sm py-3">
              Tabela WHR (talia÷biodra)
            </AccordionTrigger>
            <AccordionContent>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 pr-2 text-muted-foreground font-medium">Poziom ryzyka</th>
                    <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">Kobiety</th>
                    <th className="text-center py-1.5 pl-2 text-muted-foreground font-medium">Mężczyźni</th>
                  </tr>
                </thead>
                <tbody>
                  {WHR_REFERENCE.map((row) => (
                    <tr key={row.label} className="border-b border-border/50 last:border-0">
                      <td className="py-1.5 pr-2">{row.label}</td>
                      <td className="text-center py-1.5 px-2">{row.women}</td>
                      <td className="text-center py-1.5 pl-2">{row.men}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="bodyfat-table">
            <AccordionTrigger className="text-sm py-3">
              Normy tkanki tłuszczowej
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-xs text-muted-foreground mb-2">
                Wartości orientacyjne wg ACSM (dla dorosłych, niezależnie od wieku).
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 pr-2 text-muted-foreground font-medium">Kategoria</th>
                    <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">Kobiety</th>
                    <th className="text-center py-1.5 pl-2 text-muted-foreground font-medium">Mężczyźni</th>
                  </tr>
                </thead>
                <tbody>
                  {BODY_FAT_REFERENCE.map((row) => (
                    <tr key={row.category} className="border-b border-border/50 last:border-0">
                      <td className={`py-1.5 pr-2 font-medium ${row.color}`}>{row.category}</td>
                      <td className="text-center py-1.5 px-2">{row.women}</td>
                      <td className="text-center py-1.5 pl-2">{row.men}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
