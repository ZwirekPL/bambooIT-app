'use client';

import { List } from 'lucide-react';

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

interface TableOfContentsProps {
  items: TocItem[];
  title: string;
}

export function TableOfContents({ items, title }: TableOfContentsProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label={title}
      className="mb-10 rounded-2xl border border-sage-200 bg-sage-50/50 p-5"
    >
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sage-700">
        <List className="h-4 w-4" />
        {title}
      </h2>
      <ol className="list-none space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? 'pl-4' : ''}>
            <a
              href={`#${item.id}`}
              className="text-sm text-muted-foreground hover:text-sage-700 transition-colors"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
