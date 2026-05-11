import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComparisonRow {
  label: string;
  values: [string, string, string, string];
}

interface ComparisonTableProps {
  title: string;
  headers: [string, string, string, string, string];
  rows: ComparisonRow[];
}

function CellValue({ value }: { value: string }) {
  if (value === '✓') {
    return <Check className="mx-auto h-4 w-4 text-brand-green" aria-label="tak" />;
  }
  if (value === '—') {
    return <Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-label="nie dotyczy" />;
  }
  return <span>{value}</span>;
}

export function ComparisonTable({ title, headers, rows }: ComparisonTableProps) {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">{title}</h2>
        <div className="overflow-x-auto max-w-5xl mx-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-3 pr-4 text-left font-semibold text-muted-foreground w-auto sm:w-1/4 whitespace-nowrap">{headers[0]}</th>
                {headers.slice(1).map((h, i) => (
                  <th
                    key={i}
                    className={cn(
                      'py-3 px-3 text-center font-semibold',
                      i === 1 && 'text-brand-orange',
                      i === 3 && 'text-ai-blue',
                      i !== 1 && i !== 3 && 'text-muted-foreground'
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={cn('border-b last:border-0', rowIdx % 2 === 0 && 'bg-muted/20')}
                >
                  <td className="py-3 pr-4 font-medium text-foreground">{row.label}</td>
                  {row.values.map((val, colIdx) => (
                    <td key={colIdx} className="py-3 px-3 text-center text-muted-foreground">
                      <CellValue value={val} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
