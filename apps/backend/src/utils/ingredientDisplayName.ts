/**
 * Strip a leading quantity+unit from a legacy ingredient displayName.
 *
 * Mirrors the frontend helper (apps/web/src/lib/ingredient-display.ts) and
 * is used when serializing DietPlan.content so new plans never carry the
 * duplicated "60 g chałki — 60g" pattern to the patient.
 *
 * Passthrough when no known unit matches, so clean names like "Szpinak" or
 * overrides like "2 ząbki czosnku" → "Czosnku" behave predictably and never
 * collapse to an empty string.
 */

export const LEADING_QUANTITY_RE =
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
