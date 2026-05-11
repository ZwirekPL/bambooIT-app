/**
 * BUG-5 unit tests: sort order + split safety for shopping list PDF rendering.
 * Full PDF rendering is integration-tested via scripts/render-test-pdf.ts.
 */

import { describe, it, expect } from 'vitest';
import { sortCategoriesForPacking } from '../../pdf/shopping-list';
import type { ShoppingCategory } from '../../pdf/types';

function cat(category: string, n: number): ShoppingCategory {
  return {
    category,
    items: Array.from({ length: n }, (_, i) => `${category}-${i}`),
  };
}

describe('sortCategoriesForPacking (BUG-5 D3)', () => {
  it('sorts by item count descending', () => {
    const input: ShoppingCategory[] = [
      cat('Napoje', 2),
      cat('Warzywa', 15),
      cat('Owoce', 8),
    ];
    const result = sortCategoriesForPacking(input);
    expect(result.map((c) => c.category)).toEqual(['Warzywa', 'Owoce', 'Napoje']);
  });

  it('preserves original order on ties (stable sort)', () => {
    const input: ShoppingCategory[] = [
      cat('Białko', 5),
      cat('Nabiał', 5),
      cat('Warzywa', 10),
      cat('Owoce', 5),
    ];
    const result = sortCategoriesForPacking(input);
    // Warzywa first (biggest), then 5-item categories in original order
    expect(result.map((c) => c.category)).toEqual(['Warzywa', 'Białko', 'Nabiał', 'Owoce']);
  });

  it('does not mutate input', () => {
    const input: ShoppingCategory[] = [cat('A', 1), cat('B', 2)];
    const inputCopy = JSON.parse(JSON.stringify(input));
    sortCategoriesForPacking(input);
    expect(input).toEqual(inputCopy);
  });

  it('handles empty list', () => {
    expect(sortCategoriesForPacking([])).toEqual([]);
  });

  it('handles single category', () => {
    const input: ShoppingCategory[] = [cat('Solo', 3)];
    expect(sortCategoriesForPacking(input).map((c) => c.category)).toEqual(['Solo']);
  });
});
