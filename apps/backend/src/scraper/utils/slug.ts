/**
 * Slugify recipe titles for unique slug generation.
 */

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics: ą→a, ś→s, etc.
    .replace(/ł/g, 'l')             // special case: ł→l (not caught by NFD)
    .replace(/[^a-z0-9\s-]/g, '')   // strip non-alphanumeric
    .replace(/\s+/g, '-')           // spaces → hyphens
    .replace(/-+/g, '-')            // collapse multiple hyphens
    .replace(/^-|-$/g, '')          // trim leading/trailing hyphens
    .slice(0, 100);                 // max length
}

/**
 * Generate a unique slug by appending a suffix if needed.
 */
export function uniqueSlug(title: string, existingSlugs: Set<string>): string {
  let base = slugify(title);
  if (!base) base = 'recipe';

  if (!existingSlugs.has(base)) {
    existingSlugs.add(base);
    return base;
  }

  let counter = 2;
  while (existingSlugs.has(`${base}-${counter}`)) {
    counter++;
  }

  const slug = `${base}-${counter}`;
  existingSlugs.add(slug);
  return slug;
}
