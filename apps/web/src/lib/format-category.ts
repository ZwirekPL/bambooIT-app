/**
 * Format a product category slug for display.
 * E.g. "bakalie-i-nasiona" → "Bakalie i nasiona"
 */
export function formatCategory(slug: string): string {
  if (!slug) return '';
  return slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
