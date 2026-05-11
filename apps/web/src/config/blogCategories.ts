export interface BlogCategoryDef {
  /** Display name (Polish, stored in DB) */
  name: string;
  /** URL-safe slug */
  slug: string;
}

export const BLOG_CATEGORY_LIST: BlogCategoryDef[] = [
  { name: 'Porady dietetyczne', slug: 'porady-dietetyczne' },
  { name: 'Odchudzanie',        slug: 'odchudzanie' },
  { name: 'Zdrowie i choroby',  slug: 'zdrowie-i-choroby' },
  { name: 'Przepisy',           slug: 'przepisy' },
  { name: 'AI i dietetyka',     slug: 'ai-i-dietetyka' },
  { name: 'Motywacja',          slug: 'motywacja' },
  { name: 'Subskrypcja',        slug: 'subskrypcja' },
  { name: 'Thermomix & Airfryer', slug: 'thermomix-airfryer' },
];

/** Legacy category names stored in older DB records → canonical name mapping. */
const LEGACY_ALIASES: Record<string, string> = {
  Porady:  'Porady dietetyczne',
  Zdrowie: 'Zdrowie i choroby',
};

/**
 * Resolves any category string (canonical or legacy) to its definition.
 * Returns null for truly unknown/custom values — caller should display raw string.
 */
export function normalizeCategory(input: string): BlogCategoryDef | null {
  const canonical = LEGACY_ALIASES[input] ?? input;
  return BLOG_CATEGORY_LIST.find((c) => c.name === canonical) ?? null;
}
