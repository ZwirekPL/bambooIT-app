/**
 * Polish-aware fuzzy matcher from parsed ingredient name → CleanProduct.
 *
 * Motivation:
 *   - pipeline/03-map-products.ts uses Dice coefficient at threshold 0.5 — too
 *     loose (matches "kurczak" to "kaczka" at ~0.55).
 *   - Polish plural and diacritics break naive string similarity:
 *       "cebule" vs "cebula" → 0.83 (should be ~1.0)
 *       "kurczak" vs "kurczaka" → 0.87 (inflected form)
 *   - This module normalizes both sides, applies a stronger similarity, and
 *     returns confidence so callers can choose thresholds per use case.
 */

// ─── Normalization ─────────────────────────────────────────────────────────────

/**
 * Lower-case + strip diacritics + remove non-alphanumerics + collapse whitespace.
 * "Cebula słodka" → "cebula slodka"
 * "Mąka pszenna" → "maka pszenna"
 */
export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')    // remove combining diacritics
    .replace(/ł/g, 'l')                 // ł is not covered by NFD
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Collapse common Polish plural/inflected endings to a coarse stem.
 * Not full morphology — just enough to unify "cebule"→"cebul", "kurczaka"→"kurczak".
 * Words shorter than 4 chars are returned unchanged.
 */
export function stem(word: string): string {
  if (word.length < 5) return word;
  // Polish inflection suffixes to strip. Order matters — longer suffixes come
  // first so greedy-match takes them. For each, ensure the resulting stem is
  // still ≥4 chars to avoid destroying short words.
  //
  // Added for S-7+: "ek" (genitive plural like "pieczarek" → "pieczar"),
  // "ku" (masculine genitive like "czosnku" → "czosn"), "ów"→"ow".
  const suffixes = [
    'aczego', 'owego', 'owej', 'owych',
    'ego', 'emu', 'ach', 'ami', 'iem',
    'em', 'ek', 'ku',
    'ow',
    'owy', 'owa', 'owe',
    'yj', 'ej', 'ie',
    'om', 'ch',
    'a', 'e', 'i', 'o', 'u', 'y',
  ];
  for (const suf of suffixes) {
    // Minimum stem length 4 — don't over-strip. This keeps words like "czosnek"
    // (7 chars) → "czosn" when "ek" is stripped, but leaves "ser" alone.
    if (word.length - suf.length >= 4 && word.endsWith(suf)) {
      return word.slice(0, word.length - suf.length);
    }
  }
  return word;
}

/**
 * Full normalization pipeline: diacritic strip + stem each word.
 */
export function canonicalize(name: string): string {
  const norm = normalizeProductName(name);
  if (!norm) return '';
  return norm.split(' ').filter(Boolean).map(stem).join(' ');
}

// ─── Similarity (Dice coefficient over character bigrams) ──────────────────────

function bigrams(s: string): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.substring(i, i + 2);
    map.set(bg, (map.get(bg) ?? 0) + 1);
  }
  return map;
}

export function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const ba = bigrams(a);
  const bb = bigrams(b);

  let intersection = 0;
  for (const [bg, ca] of ba) {
    const cb = bb.get(bg);
    if (cb) intersection += Math.min(ca, cb);
  }

  let sizeA = 0;
  for (const c of ba.values()) sizeA += c;
  let sizeB = 0;
  for (const c of bb.values()) sizeB += c;

  return (2 * intersection) / (sizeA + sizeB);
}

// ─── Matcher ───────────────────────────────────────────────────────────────────

export interface ProductCandidate {
  id: string;
  name: string;
}

export interface MatchResult {
  product: ProductCandidate;
  score: number;        // 0-1
  matchType: 'exact' | 'canonical-exact' | 'fuzzy';
}

/**
 * Find the best match for a query name against a list of candidates.
 * Returns null when nothing meets the threshold.
 *
 * Matching stages (best wins):
 *   1. Exact case-insensitive match → score 1.0 (type 'exact')
 *   2. Canonical (diacritic-stripped + stemmed) exact match → score 0.98
 *   3. Dice coefficient on canonical strings → fuzzy
 *
 * Default threshold 0.85 is calibrated for the ~16k CleanProduct corpus:
 *   - "cebula"          ≈ "cebuli"          → ~1.0   (stemmed equal)
 *   - "mąka pszenna"    ≈ "maka pszenna"    → ~1.0   (diacritics)
 *   - "oliwa z oliwek"  ≈ "Oliwa z oliwek"  → ~1.0
 *   - "kurczak"         ≈ "kaczka"          → ~0.4   (rejected)
 */
export function matchProduct(
  query: string,
  candidates: ProductCandidate[],
  threshold = 0.8,
): MatchResult | null {
  if (!query || candidates.length === 0) return null;

  const queryNorm = normalizeProductName(query);
  const queryCanon = canonicalize(query);
  if (!queryNorm) return null;

  let best: MatchResult | null = null;

  for (const c of candidates) {
    const cNorm = normalizeProductName(c.name);

    if (cNorm === queryNorm) {
      return { product: c, score: 1.0, matchType: 'exact' };
    }

    const cCanon = canonicalize(c.name);
    if (cCanon && cCanon === queryCanon) {
      best = { product: c, score: 0.98, matchType: 'canonical-exact' };
      continue;
    }

    // Position-weighted per-word score. The first candidate word carries the
    // product noun ("Oliwa z oliwek" — "Oliwa"), later words are modifiers.
    // Weighting 1/(i+1) heavily penalises matches that only land on a
    // non-leading word ("orzechy" vs "Kabanos z orzechem laskowym" → weak).
    const fullScore = diceCoefficient(queryCanon, cCanon);
    const qWords = queryCanon.split(' ').filter((w) => w.length >= 3);
    const cWords = cCanon.split(' ').filter((w) => w.length >= 3);

    let perWordScore = 0;
    if (qWords.length > 0 && cWords.length > 0 && (qWords.length > 1 || cWords.length > 1)) {
      // Score each candidate word against the best query word.
      const perCw: number[] = [];
      for (let i = 0; i < cWords.length; i++) {
        let bestForThisCw = 0;
        for (const qw of qWords) {
          const s = diceCoefficient(qw, cWords[i]);
          if (s > bestForThisCw) bestForThisCw = s;
        }
        perCw.push(bestForThisCw);
      }

      // Dominant-first-word rule: if the leading candidate word matches some
      // query word almost perfectly (≥0.92), take that as the score. Rewards
      // "orzechy" → "Orzechy włoskie" without letting "Kabanos z orzechem"
      // slip through (where the leading word has zero overlap with query).
      if (perCw[0] >= 0.92) {
        perWordScore = perCw[0];
      } else {
        let weightedSum = 0;
        let totalWeight = 0;
        for (let i = 0; i < perCw.length; i++) {
          const weight = 1 / (i + 1);
          totalWeight += weight;
          weightedSum += weight * perCw[i];
        }
        perWordScore = weightedSum / totalWeight;
      }
    }

    const score = Math.max(fullScore, perWordScore * 0.95);
    if (score >= threshold && (best == null || score > best.score)) {
      best = { product: c, score, matchType: 'fuzzy' };
    }
  }

  return best;
}
