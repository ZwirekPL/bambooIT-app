/**
 * Strip a leading quantity+unit from a legacy ingredient displayName.
 *
 * Background: RecipeIngredient.displayName was historically populated from the
 * raw HTML line from the scraper (e.g. "60 g chałki"). The UI renders the
 * quantity separately as "{name} — {grams}g", which produced duplicates like
 * "60 g chałki — 60g". The numeric gram value lives in RecipeIngredient.grams
 * and is the source of truth for all calculations — this helper only touches
 * the label string.
 *
 * Passthrough when the input doesn't match a known unit, so clean names like
 * "Szpinak" or manual overrides like "2 ząbki czosnku" → "Czosnku" work
 * predictably and never collapse to an empty string.
 */

const LEADING_QUANTITY_RE =
  /^\s*\d+(?:[.,]\d+)?\s*(?:g|kg|dag|mg|ml|l|szt\.?|sztuk[ai]?|łyżk[ai]|łyżek|łyżeczk[ai]|łyżeczek|szklank[ai]|szklanek|ząbk[ai]?|ząbków|plaster|plastry|plastrów|garś[ćc]|garści)\b\s+/i;

export function cleanIngredientName(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const stripped = trimmed.replace(LEADING_QUANTITY_RE, '').trim();
  if (!stripped) return trimmed;

  return stripped.charAt(0).toLocaleUpperCase('pl-PL') + stripped.slice(1);
}
