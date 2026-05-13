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
      className="mb-10 rounded-2xl border border-line bg-paper p-6"
    >
      <h2 className="mb-4 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-bamboo-deep">
        <List className="h-4 w-4" aria-hidden="true" />
        {title}
      </h2>
      <ol className="list-none space-y-2">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? 'pl-5' : ''}>
            <a
              href={`#${item.id}`}
              className="text-sm text-navy-soft transition-colors hover:text-bamboo-deep"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
