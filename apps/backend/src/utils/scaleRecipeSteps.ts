// ─── Scale weight references in recipe instruction steps ──────────────────────
//
// When recipes are scaled to match patient caloric targets, the ingredient
// weights change but the instruction text still contains original amounts.
// This utility applies the same globalScaleFactor to weight references in text.
//
// Examples:
//   "Ugotuj 200g ryżu" × 0.75 → "Ugotuj 150g ryżu"
//   "Rozgrzej piekarnik do 180°C" → unchanged (temperature)
//   "Smaż 5 minut" → unchanged (time)

// ─── Rounding (matches recipeScaler logic) ───────────────────────────────────

function roundGrams(value: number): number {
  if (value >= 100) return Math.round(value / 10) * 10;
  if (value >= 10) return Math.round(value / 5) * 5;
  return Math.round(value);
}

function formatScaled(value: number, unit: string): string {
  const u = unit.toLowerCase();

  // kg / l — keep decimals
  if (u === 'kg' || u === 'l' || u.startsWith('litr')) {
    if (value >= 1) {
      const s = value.toFixed(1);
      return s.endsWith('.0') ? s.slice(0, -2) : s;
    }
    const s = value.toFixed(2);
    return s.endsWith('0') ? s.slice(0, -1) : s;
  }

  // g, ml, dag — integer rounding
  return String(roundGrams(value));
}

// ─── Count-based quantities (sztuki, łyżki etc.) ────────────────────────────

const COUNT_UNITS =
  /(\d+(?:[.,]\d+)?)\s*(sztuk[iay]?|szt\.?|łyż(?:k[iae]|eczk[iae])?|szklan(?:k[iae]|ek)?|porcj[iaei]+|plaster(?:k[iówa])?|ząbk[iówa]+)\b/gi;

function roundCount(value: number): string {
  if (value <= 0.5) return '0.5';
  // Round to nearest 0.5
  const rounded = Math.round(value * 2) / 2;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}

// ─── Weight/volume pattern ───────────────────────────────────────────────────
//
// Matches: "200g", "200 g", "0,5 kg", "150ml", "20 dag", "1.5 l", "2 litry"
// Does NOT match temperatures (checked via context before the number).

const WEIGHT_PATTERN =
  /(\d+(?:[.,]\d+)?)\s*(g|ml|dag|kg|l(?:itr[aówy]*)?)\b/gi;

// ─── Temperature guard ───────────────────────────────────────────────────────
// Check if the weight match is actually part of a temperature reference.
// E.g. "180 °C" — the °C comes AFTER the number, not before.
// We also protect "stopni/stopień" patterns.

function isTemperatureContext(text: string, matchStart: number, matchEnd: number): boolean {
  // Check what follows the match (°C, °F, °, stopni)
  const after = text.slice(matchEnd, matchEnd + 12).trimStart();
  if (/^°[CF]?\b/.test(after)) return true;
  if (/^stopni/i.test(after)) return true;

  // Check if preceded by "do " or "na " + this is a temperature (heuristic)
  // e.g. "rozgrzej do 200" — but this could also be "dodaj do 200g wody"
  // Only protect if followed by ° or stopni, which is handled above
  return false;
}

// ─── Main function ───────────────────────────────────────────────────────────

/**
 * Scale weight/volume references in recipe instruction steps.
 *
 * @param steps - array of instruction step strings
 * @param scaleFactor - globalScaleFactor from recipeScaler (e.g. 0.75)
 * @returns new array with scaled weight references
 */
export function scaleRecipeSteps(steps: string[], scaleFactor: number): string[] {
  // No scaling needed
  if (Math.abs(scaleFactor - 1.0) < 0.01) return steps;
  if (!steps || steps.length === 0) return steps;

  return steps.map(step => {
    // 1. Scale weight/volume units (g, ml, dag, kg, l)
    let result = step.replace(WEIGHT_PATTERN, (match, numStr: string, unit: string, offset: number) => {
      // Protect temperatures
      if (isTemperatureContext(step, offset, offset + match.length)) {
        return match;
      }

      const num = parseFloat(numStr.replace(',', '.'));
      if (isNaN(num) || num === 0) return match;

      const scaled = num * scaleFactor;
      const formatted = formatScaled(scaled, unit);

      return `${formatted} ${unit.toLowerCase()}`;
    });

    // 2. Scale count-based units (sztuki, łyżki, szklanki)
    result = result.replace(COUNT_UNITS, (match, numStr: string, unit: string) => {
      const num = parseFloat(numStr.replace(',', '.'));
      if (isNaN(num) || num === 0) return match;

      const scaled = num * scaleFactor;
      const formatted = roundCount(scaled);

      return `${formatted} ${unit}`;
    });

    return result;
  });
}
