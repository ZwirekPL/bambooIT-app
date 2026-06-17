export interface BlogCategoryDef {
  /** Display name (Polish, stored in DB) */
  name: string;
  /** URL-safe slug */
  slug: string;
}

/**
 * bambooIT blog categories. 8 buckets that cover the IT support business
 * (Obsługa IT, Cyberbezpieczeństwo, Backup, Microsoft 365, Sprzęt i sieci),
 * Wirgiliusz's adjacent specialties (Automatyzacje, Strony i aplikacje),
 * and industry-specific deep dives (Branże).
 *
 * If you add or rename categories, update both this list and
 * `apps/web/src/components/blog/category-styles.ts` with a matching colour.
 */
export const BLOG_CATEGORY_LIST: BlogCategoryDef[] = [
  { name: 'Obsługa IT',           slug: 'obsluga-it' },
  { name: 'Cyberbezpieczeństwo',  slug: 'cyberbezpieczenstwo' },
  { name: 'Backup',               slug: 'backup' },
  { name: 'Microsoft 365',        slug: 'microsoft-365' },
  { name: 'Sprzęt i sieci',       slug: 'sprzet-i-sieci' },
  { name: 'Automatyzacje',        slug: 'automatyzacje' },
  { name: 'Strony i aplikacje',   slug: 'strony-i-aplikacje' },
  { name: 'Branże',               slug: 'branze' },
];

/**
 * Resolves a category string to its definition.
 * Returns null for truly unknown/custom values — caller should display raw string.
 */
export function normalizeCategory(input: string): BlogCategoryDef | null {
  return BLOG_CATEGORY_LIST.find((c) => c.name === input) ?? null;
}
