/**
 * 3-level recipe deduplication (S-10).
 *
 * Signatures computed per recipe:
 *   1. title          — normalized + stemmed title (reuses productMatcher)
 *   2. ingredients    — sorted canonical ingredient names joined with '|'
 *   3. macros         — bucketed kcal/protein/fat/carbs fingerprint
 *
 * Two recipes are compared level-by-level; each level yields a boolean match.
 *
 *   3/3 match → AUTO_MERGE (very likely same recipe)
 *   2/3 match → REVIEW     (human admin should decide)
 *   ≤1/3      → UNIQUE     (treat as distinct)
 *
 * Signatures are string hashes so the full corpus can be indexed in O(n)
 * via buckets rather than O(n²).
 */

import { canonicalize, diceCoefficient } from './productMatcher';

// ─── Input type ────────────────────────────────────────────────────────────────

export interface DedupInput {
  id: string;
  title: string;
  /** Canonical product names or IDs — whatever the caller has. */
  ingredients: string[];
  /** Per-serving nutrition snapshot. */
  nutrition?: {
    calories?: number | null;
    protein?: number | null;
    fat?: number | null;
    carbs?: number | null;
  } | null;
}

// ─── Signatures ────────────────────────────────────────────────────────────────

/** Canonical title — lower-case, diacritic-stripped, stemmed per word. */
export function titleSignature(title: string): string {
  return canonicalize(title);
}

/**
 * Sort-then-join canonical ingredient list. Small-length words (<3) are
 * dropped to reduce noise from connectives like "z" / "i" / "do".
 */
export function ingredientSignature(ingredients: string[]): string {
  const tokens = ingredients
    .map((i) => canonicalize(i))
    .filter((s) => s.length >= 3)
    .sort();
  return tokens.join('|');
}

/** Round a positive number to the nearest `bucket`. Null stays null. */
function bucket(n: number | null | undefined, size: number): number | null {
  if (n == null || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n / size) * size;
}

/**
 * Macro fingerprint: kcal rounded to 50, macros rounded to 5g. "-" when a
 * field is missing, so two recipes with partial data still fingerprint
 * consistently.
 */
export function macroSignature(nutrition: DedupInput['nutrition']): string {
  if (!nutrition) return '-|-|-|-';
  const parts = [
    bucket(nutrition.calories, 50),
    bucket(nutrition.protein, 5),
    bucket(nutrition.fat, 5),
    bucket(nutrition.carbs, 5),
  ].map((v) => (v == null ? '-' : String(v)));
  return parts.join('|');
}

// ─── Pair comparison ───────────────────────────────────────────────────────────

export interface LevelFlags {
  title: boolean;
  ingredients: boolean;
  macros: boolean;
}

export type DedupDecision = 'AUTO_MERGE' | 'REVIEW' | 'UNIQUE';

export interface DedupMatch {
  other: DedupInput;
  levels: LevelFlags;
  matchCount: 0 | 1 | 2 | 3;
  decision: DedupDecision;
  titleSimilarity: number; // 0-1 Dice on canonical titles
}

const TITLE_SIM_THRESHOLD = 0.82;       // exact hash match is stricter than fuzzy
const INGREDIENT_OVERLAP_THRESHOLD = 0.7; // Jaccard

function titleMatch(a: DedupInput, b: DedupInput): { match: boolean; similarity: number } {
  const sigA = titleSignature(a.title);
  const sigB = titleSignature(b.title);
  if (!sigA || !sigB) return { match: false, similarity: 0 };
  if (sigA === sigB) return { match: true, similarity: 1 };
  const sim = diceCoefficient(sigA, sigB);
  return { match: sim >= TITLE_SIM_THRESHOLD, similarity: sim };
}

function ingredientMatch(a: DedupInput, b: DedupInput): boolean {
  const sigA = ingredientSignature(a.ingredients);
  const sigB = ingredientSignature(b.ingredients);
  if (sigA === sigB && sigA !== '') return true;

  const tokensA = new Set(sigA.split('|').filter(Boolean));
  const tokensB = new Set(sigB.split('|').filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return false;
  let shared = 0;
  for (const t of tokensA) if (tokensB.has(t)) shared++;
  const denom = Math.max(tokensA.size, tokensB.size);
  return shared / denom >= INGREDIENT_OVERLAP_THRESHOLD;
}

function macroMatch(a: DedupInput, b: DedupInput): boolean {
  const sigA = macroSignature(a.nutrition);
  const sigB = macroSignature(b.nutrition);
  if (sigA === '-|-|-|-' || sigB === '-|-|-|-') return false;
  return sigA === sigB;
}

export function classifyDedup(levels: LevelFlags): { count: 0 | 1 | 2 | 3; decision: DedupDecision } {
  const count = (Number(levels.title) + Number(levels.ingredients) + Number(levels.macros)) as 0 | 1 | 2 | 3;
  if (count === 3) return { count, decision: 'AUTO_MERGE' };
  if (count === 2) return { count, decision: 'REVIEW' };
  return { count, decision: 'UNIQUE' };
}

export function compareRecipes(a: DedupInput, b: DedupInput): DedupMatch {
  const title = titleMatch(a, b);
  const levels: LevelFlags = {
    title: title.match,
    ingredients: ingredientMatch(a, b),
    macros: macroMatch(a, b),
  };
  const { count, decision } = classifyDedup(levels);
  return { other: b, levels, matchCount: count, decision, titleSimilarity: title.similarity };
}

// ─── Corpus dedup (O(n) via signature buckets) ─────────────────────────────────

export interface CorpusDedupReport {
  autoMerge: Array<{ recipes: DedupInput[]; signature: string }>;
  review: Array<{ pair: [DedupInput, DedupInput]; levels: LevelFlags }>;
  unique: DedupInput[];
}

/**
 * Find duplicate clusters in a corpus. Two phases:
 *   1. Group by (title, ingredients, macros) exact triple → AUTO_MERGE cluster
 *   2. For recipes not yet in a cluster, find pairs matching 2/3 levels →
 *      REVIEW list. Uses title bucket to keep complexity near-linear.
 *
 * Returns three disjoint sets; any recipe appears at most once across them.
 */
export function findDuplicatesInCorpus(corpus: DedupInput[]): CorpusDedupReport {
  // Phase 1 — exact 3/3 clusters
  const tripleBuckets = new Map<string, DedupInput[]>();
  for (const r of corpus) {
    const key = [titleSignature(r.title), ingredientSignature(r.ingredients), macroSignature(r.nutrition)].join('##');
    // Skip recipes with no real macro signature — they can't match on 3/3
    if (!key.includes('-|-|-|-')) {
      const list = tripleBuckets.get(key) ?? [];
      list.push(r);
      tripleBuckets.set(key, list);
    }
  }
  const autoMergeClusters: CorpusDedupReport['autoMerge'] = [];
  const claimed = new Set<string>();
  for (const [key, list] of tripleBuckets) {
    if (list.length >= 2) {
      autoMergeClusters.push({ recipes: list, signature: key });
      for (const r of list) claimed.add(r.id);
    }
  }

  // Phase 2 — 2/3 pairs among remaining recipes. Group by title signature to
  // limit pairwise comparisons.
  const remaining = corpus.filter((r) => !claimed.has(r.id));
  const titleBuckets = new Map<string, DedupInput[]>();
  for (const r of remaining) {
    const sig = titleSignature(r.title);
    const list = titleBuckets.get(sig) ?? [];
    list.push(r);
    titleBuckets.set(sig, list);
  }

  const reviewPairs: CorpusDedupReport['review'] = [];
  const reviewedIds = new Set<string>();

  // Within each title-sig bucket, all entries share the title signature;
  // any pair needs just ingredients OR macros to hit 2/3.
  for (const list of titleBuckets.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const match = compareRecipes(list[i], list[j]);
        if (match.matchCount === 2) {
          reviewPairs.push({ pair: [list[i], list[j]], levels: match.levels });
          reviewedIds.add(list[i].id);
          reviewedIds.add(list[j].id);
        }
      }
    }
  }

  // Also check cross-bucket pairs where ingredients+macros match even if
  // title doesn't — rare but happens with rename'd recipes. Group by
  // ingredient signature for those.
  const ingBuckets = new Map<string, DedupInput[]>();
  for (const r of remaining) {
    const sig = ingredientSignature(r.ingredients);
    if (sig === '') continue;
    const list = ingBuckets.get(sig) ?? [];
    list.push(r);
    ingBuckets.set(sig, list);
  }
  for (const list of ingBuckets.values()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const match = compareRecipes(list[i], list[j]);
        if (match.matchCount === 2 && !match.levels.title) {
          // not already captured via title bucket
          reviewPairs.push({ pair: [list[i], list[j]], levels: match.levels });
          reviewedIds.add(list[i].id);
          reviewedIds.add(list[j].id);
        }
      }
    }
  }

  const unique = remaining.filter((r) => !reviewedIds.has(r.id));

  return {
    autoMerge: autoMergeClusters,
    review: reviewPairs,
    unique,
  };
}
