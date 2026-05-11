'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CleanProduct } from '@/types/api';

interface MicroField {
  key: string;
  label: string;
  unit: string;
  source: 'nutrients' | 'aminoAcids' | 'bioactives' | 'product';
}

const VITAMIN_FIELDS: MicroField[] = [
  { key: 'vitaminAUg', label: 'Wit. A', unit: 'µg', source: 'nutrients' },
  { key: 'vitaminDUg', label: 'Wit. D', unit: 'µg', source: 'nutrients' },
  { key: 'vitaminEMg', label: 'Wit. E', unit: 'mg', source: 'nutrients' },
  { key: 'vitaminKUg', label: 'Wit. K', unit: 'µg', source: 'nutrients' },
  { key: 'vitaminCMg', label: 'Wit. C', unit: 'mg', source: 'nutrients' },
  { key: 'vitaminB1Mg', label: 'B1 (tiamina)', unit: 'mg', source: 'nutrients' },
  { key: 'vitaminB2Mg', label: 'B2 (ryboflawina)', unit: 'mg', source: 'nutrients' },
  { key: 'vitaminB3Mg', label: 'B3 (niacyna)', unit: 'mg', source: 'nutrients' },
  { key: 'vitaminB5Mg', label: 'B5', unit: 'mg', source: 'nutrients' },
  { key: 'vitaminB6Mg', label: 'B6', unit: 'mg', source: 'nutrients' },
  { key: 'folateUg', label: 'Folian', unit: 'µg', source: 'nutrients' },
  { key: 'vitaminB12Ug', label: 'B12', unit: 'µg', source: 'nutrients' },
  { key: 'biotinUg', label: 'Biotyna', unit: 'µg', source: 'nutrients' },
  { key: 'cholineMg', label: 'Cholina', unit: 'mg', source: 'nutrients' },
];

const MINERAL_FIELDS: MicroField[] = [
  { key: 'sodiumMg', label: 'Sód (Na)', unit: 'mg', source: 'nutrients' },
  { key: 'potassiumMg', label: 'Potas (K)', unit: 'mg', source: 'nutrients' },
  { key: 'calciumMg', label: 'Wapń (Ca)', unit: 'mg', source: 'nutrients' },
  { key: 'magnesiumMg', label: 'Magnez (Mg)', unit: 'mg', source: 'nutrients' },
  { key: 'phosphorusMg', label: 'Fosfor (P)', unit: 'mg', source: 'nutrients' },
  { key: 'ironMg', label: 'Żelazo (Fe)', unit: 'mg', source: 'nutrients' },
  { key: 'zincMg', label: 'Cynk (Zn)', unit: 'mg', source: 'nutrients' },
  { key: 'copperMg', label: 'Miedź (Cu)', unit: 'mg', source: 'nutrients' },
  { key: 'manganeseMg', label: 'Mangan (Mn)', unit: 'mg', source: 'nutrients' },
  { key: 'iodineUg', label: 'Jod (I)', unit: 'µg', source: 'nutrients' },
  { key: 'seleniumUg', label: 'Selen (Se)', unit: 'µg', source: 'nutrients' },
  { key: 'chromiumUg', label: 'Chrom (Cr)', unit: 'µg', source: 'nutrients' },
  { key: 'molybdenumUg', label: 'Molibden (Mo)', unit: 'µg', source: 'nutrients' },
  { key: 'fluorideUg', label: 'Fluor (F)', unit: 'µg', source: 'nutrients' },
  { key: 'chlorideMg', label: 'Chlor (Cl)', unit: 'mg', source: 'nutrients' },
];

const FATTY_ACID_FIELDS: MicroField[] = [
  { key: 'monounsaturatedFatPer100g', label: 'MUFA', unit: 'g', source: 'nutrients' },
  { key: 'polyunsaturatedFatPer100g', label: 'PUFA', unit: 'g', source: 'nutrients' },
  { key: 'transFatPer100g', label: 'Trans', unit: 'g', source: 'nutrients' },
  { key: 'omega3Per100g', label: 'Omega-3', unit: 'g', source: 'nutrients' },
  { key: 'omega6Per100g', label: 'Omega-6', unit: 'g', source: 'nutrients' },
  { key: 'epaPer100g', label: 'EPA', unit: 'g', source: 'nutrients' },
  { key: 'dhaPer100g', label: 'DHA', unit: 'g', source: 'nutrients' },
  { key: 'alaPer100g', label: 'ALA', unit: 'g', source: 'nutrients' },
];

const AMINO_ACID_FIELDS: MicroField[] = [
  { key: 'tryptophanPer100g', label: 'Tryptofan', unit: 'g', source: 'aminoAcids' },
  { key: 'threoninePer100g', label: 'Treonina', unit: 'g', source: 'aminoAcids' },
  { key: 'isoleucinePer100g', label: 'Izoleucyna', unit: 'g', source: 'aminoAcids' },
  { key: 'leucinePer100g', label: 'Leucyna', unit: 'g', source: 'aminoAcids' },
  { key: 'lysinePer100g', label: 'Lizyna', unit: 'g', source: 'aminoAcids' },
  { key: 'methioninePer100g', label: 'Metionina', unit: 'g', source: 'aminoAcids' },
  { key: 'phenylalaninePer100g', label: 'Fenyloalanina', unit: 'g', source: 'aminoAcids' },
  { key: 'valinePer100g', label: 'Walina', unit: 'g', source: 'aminoAcids' },
  { key: 'histidinePer100g', label: 'Histydyna', unit: 'g', source: 'aminoAcids' },
];

const BIOACTIVE_FIELDS: MicroField[] = [
  { key: 'purinesMg', label: 'Puryny', unit: 'mg', source: 'bioactives' },
  { key: 'oxalateMg', label: 'Szczawiany', unit: 'mg', source: 'bioactives' },
  { key: 'caffeineMg', label: 'Kofeina', unit: 'mg', source: 'bioactives' },
  { key: 'polyphenolsMg', label: 'Polifenole', unit: 'mg', source: 'bioactives' },
  { key: 'betaCaroteneUg', label: 'Beta-karoten', unit: 'µg', source: 'bioactives' },
  { key: 'lycopeneUg', label: 'Likopen', unit: 'µg', source: 'bioactives' },
  { key: 'luteinZeaxanthinUg', label: 'Luteina+Zeaksantyna', unit: 'µg', source: 'bioactives' },
];

const GI_FIELDS: MicroField[] = [
  { key: 'glycemicIndex', label: 'Indeks glikemiczny (GI)', unit: '', source: 'product' },
  { key: 'glycemicLoadPer100g', label: 'Ładunek glikemiczny (GL)', unit: '', source: 'product' },
  { key: 'fodmapLevel', label: 'FODMAP', unit: '', source: 'product' },
];

interface SectionDef {
  id: string;
  title: string;
  fields: MicroField[];
}

const SECTIONS: SectionDef[] = [
  { id: 'vitamins', title: 'Witaminy', fields: VITAMIN_FIELDS },
  { id: 'minerals', title: 'Minerały', fields: MINERAL_FIELDS },
  { id: 'fattyAcids', title: 'Kwasy tłuszczowe', fields: FATTY_ACID_FIELDS },
  { id: 'aminoAcids', title: 'Aminokwasy', fields: AMINO_ACID_FIELDS },
  { id: 'bioactives', title: 'Związki bioaktywne', fields: BIOACTIVE_FIELDS },
  { id: 'gi', title: 'Indeks glikemiczny', fields: GI_FIELDS },
];

function getFieldValue(product: CleanProduct, field: MicroField): number | string | null | undefined {
  if (field.source === 'nutrients') {
    const n = product.nutrients;
    if (!n) return undefined;
    return (n as unknown as Record<string, unknown>)[field.key] as number | null | undefined;
  }
  if (field.source === 'aminoAcids') {
    const aa = product.aminoAcids;
    if (!aa) return undefined;
    return (aa as unknown as Record<string, unknown>)[field.key] as number | null | undefined;
  }
  if (field.source === 'bioactives') {
    const ba = product.bioactives;
    if (!ba) return undefined;
    return (ba as unknown as Record<string, unknown>)[field.key] as number | null | undefined;
  }
  if (field.source === 'product') {
    return (product as unknown as Record<string, unknown>)[field.key] as number | string | null | undefined;
  }
  return undefined;
}

function countFilled(product: CleanProduct, fields: MicroField[]): number {
  return fields.filter((f) => {
    const v = getFieldValue(product, f);
    return v !== null && v !== undefined;
  }).length;
}

function formatValue(value: number | string | null | undefined, unit: string): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (unit === '') return String(value);
  return `${Number(value).toFixed(unit === 'g' ? 2 : 1)} ${unit}`;
}

interface MicronutrientSectionsProps {
  product: CleanProduct;
}

export function MicronutrientSections({ product }: MicronutrientSectionsProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-1">
      {SECTIONS.map((section) => {
        const filled = countFilled(product, section.fields);
        const total = section.fields.length;
        const isOpen = expanded.has(section.id);

        return (
          <div key={section.id} className="rounded-md border">
            <button
              type="button"
              className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              onClick={() => toggle(section.id)}
            >
              <span className="text-sm font-medium">{section.title}</span>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-xs tabular-nums',
                  filled === 0 ? 'text-muted-foreground/40' : filled === total ? 'text-green-600' : 'text-amber-600'
                )}>
                  {filled}/{total}
                </span>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
              </div>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 pt-1">
                <div className="grid grid-cols-3 gap-1.5">
                  {section.fields.map((field) => {
                    const value = getFieldValue(product, field);
                    const hasData = value !== null && value !== undefined;
                    return (
                      <div
                        key={field.key}
                        className={cn(
                          'text-center p-1.5 rounded text-xs',
                          hasData ? 'bg-muted/40' : 'bg-muted/10'
                        )}
                      >
                        <p className={cn('truncate', !hasData && 'text-muted-foreground/40')}>
                          {field.label}
                        </p>
                        <p className={cn('font-semibold tabular-nums', !hasData && 'text-muted-foreground/40')}>
                          {formatValue(value, field.unit)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
