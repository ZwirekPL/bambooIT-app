/**
 * BUG-3 Session 2: generate repair proposals for problematic RecipeIngredient.displayName.
 *
 * Groups ingredients by displayName (so each unique bad value gets ONE proposal,
 * applicable to all its uses). Each proposal has:
 *
 *   action:     'update' | 'split' | 'keep-manual-review'
 *   confidence: 'high' | 'medium' | 'low'
 *   approved:   null  // reviewer fills: true | false | 'edit'
 *
 * Output: apps/backend/scripts/data/ingredient-repairs.json (gitignored).
 * Nothing is written to DB.
 *
 * Usage:
 *   cd apps/backend
 *   npm run diagnose:suggest-repairs            # writes JSON, prints summary
 *   npm run diagnose:suggest-repairs -- --top=50   # also prints top 50 for review
 */

import 'dotenv/config';
import { prisma } from '@db';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { normalizeIngredientName, isCanonicalProductName } from '../src/services/planValidation.service';

const TOP_ARG = process.argv.find((a) => a.startsWith('--top='));
const PRINT_TOP = TOP_ARG ? parseInt(TOP_ARG.split('=')[1], 10) : 0;

type Confidence = 'high' | 'medium' | 'low';
type Action = 'update' | 'split' | 'keep-manual-review';

interface Proposal {
  id: string;
  currentDisplayName: string;
  uses: number;                        // how many RecipeIngredient rows carry this name
  affectsRecipeCount: number;          // how many distinct recipes
  sampleRecipes: string[];             // up to 3 recipe titles, for context
  confidence: Confidence;
  pattern: string;                     // machine-readable classification
  action: Action;
  newDisplayName: string | null;       // null when action === 'keep-manual-review'
  splitInto: string[] | null;          // for action === 'split'
  rationale: string;                   // human-readable why
  approved: null | true | false | 'edit';
}

interface ProposalBundle {
  batchId: string;
  generatedAt: string;
  totalAnalyzed: number;
  stats: Record<Confidence, number>;
  proposals: Proposal[];
}

// ─── Classification + proposal logic ─────────────────────────────────────────

const JUNK_PREFIX_RE = /^(?:przyprawy|zioła|dekoracja|dodatki|orzechy|sery|bakali[ae]?|topping|kasze|mączne\s+przekąski|przetwory|marynat[ay]|mączne)\s*[:\-]/i;
const ALTERNATIVE_RE = /\s+(?:lub|albo)\s+/i;
const COMPOUND_DISH_RE = /\bw\s+(cieście|sosie|panier|panko|puszce|zalewie|oleju|syropie)\b/i;

// Size/quantity words that should NEVER be a final displayName (sanity check)
const BAD_FINAL_NAMES = new Set([
  'duże', 'duża', 'duży', 'mała', 'małe', 'mały',
  'średnie', 'średnia', 'średni', 'spore', 'spora',
  'sporej', 'sporych', 'mniejszy', 'większy',
]);

function classify(name: string): { pattern: string; confidence: Confidence; action: Action } {
  const trimmed = name.trim();
  const norm = normalizeIngredientName(trimmed).displayName;
  const canonicalWasApplied = norm !== trimmed && norm.length > 0 && norm.length <= 40;
  // For HIGH confidence we require norm to be a known canonical product —
  // guards against cases like "biały wino" → "białego" or "jajka" → "lub 6 jajek".
  const normIsKnownCanonical = canonicalWasApplied && isCanonicalProductName(norm);
  const normIsSane =
    normIsKnownCanonical &&
    !BAD_FINAL_NAMES.has(norm.toLowerCase()) &&
    norm.length >= 3;
  const hasComma = /,/.test(trimmed);  // presence of comma = likely a list → don't collapse to 1 name

  // 1. Alternatives "X lub Y"
  //    HIGH only when: no list commas AND canonical maps to a single short product name.
  //    "2 łyżki oliwy lub oleju" → HIGH (both map to 'oliwa z oliwek')
  //    "sól, pieprz, X lub Y" → MEDIUM (contains commas = list, risky to collapse)
  if (ALTERNATIVE_RE.test(trimmed) && !trimmed.includes(':')) {
    if (hasComma) {
      return { pattern: 'alternative-in-list', confidence: 'medium', action: 'keep-manual-review' };
    }
    if (normIsSane && norm.split(/\s+/).length <= 4) {
      return { pattern: 'alternative-with-canonical', confidence: 'high', action: 'update' };
    }
    return { pattern: 'alternative-no-canonical', confidence: 'low', action: 'keep-manual-review' };
  }

  // 2. Compound dish "X w sosie/cieście"
  //    Always MEDIUM — changing "1 puszka tuńczyka w sosie własnym" to "tuńczyk" loses
  //    the canned-in-own-juice distinction (different nutrition).
  if (COMPOUND_DISH_RE.test(trimmed)) {
    if (normIsSane && norm.split(/\s+/).length <= 3) {
      return { pattern: 'compound-dish-canonical', confidence: 'medium', action: 'update' };
    }
    return { pattern: 'compound-dish-manual', confidence: 'low', action: 'keep-manual-review' };
  }

  // 3. Colon-prefix category bags
  if (JUNK_PREFIX_RE.test(trimmed)) {
    return { pattern: 'category-bag', confidence: 'medium', action: 'split' };
  }

  // 4. Spice/ingredient lists with colon
  if (/[:;]/.test(trimmed) && trimmed.length > 30) {
    return { pattern: 'spice-list-with-colon', confidence: 'medium', action: 'split' };
  }

  // 5. Very long.
  //    HIGH only when NO comma (meaning no embedded list) AND canonical produces a sane name.
  //    "proszek do pieczenia i soda oczyszczona po 1 płaskiej łyżeczce" → canonical picks
  //       "proszek do pieczenia", but "i soda oczyszczona" is lost — medium, not high.
  //    Only truly safe: long because of prep notes, no comma (e.g. "łosoś wędzony z Norwegii w plastrach")
  if (trimmed.length > 60) {
    if (!hasComma && normIsSane && norm.split(/\s+/).length <= 4) {
      return { pattern: 'long-prep-notes', confidence: 'high', action: 'update' };
    }
    return { pattern: 'long-with-list-or-unknown', confidence: 'low', action: 'keep-manual-review' };
  }

  // 6. ALL-CAPS short names (BIAŁA)
  if (/^[A-ZĄĘŁŻŚĆŃÓŹ]{3,8}$/.test(trimmed)) {
    return { pattern: 'truncated-allcaps', confidence: 'low', action: 'keep-manual-review' };
  }

  return { pattern: 'unknown', confidence: 'low', action: 'keep-manual-review' };
}

function splitCategoryBag(name: string): string[] {
  // "orzechy: pekan, nerkowce, włoskie, laskowe, migdały, brazylijskie"
  // → ["pekan", "nerkowce", "włoskie", "laskowe", "migdały", "brazylijskie"]
  const colonIdx = name.indexOf(':');
  if (colonIdx < 0) return [];
  const after = name.slice(colonIdx + 1).trim();
  // Drop leading descriptors like "po 50 g:"
  const parts = after
    .split(/[,;]|\s+lub\s+|\s+albo\s+/i)
    .map((p) => p.trim())
    .map((p) => p.replace(/^(?:po\s+\d+\s*g\s+|np\.?\s+|oraz\s+|np\s+|dowolnie\s+)/i, '').trim())
    .filter((p) => p.length > 0 && p.length <= 30);  // drop sub-fragments too long to be products
  return [...new Set(parts)];  // dedupe
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Loading RecipeIngredient rows with recipe titles…');
  // Group by displayName — we only need one proposal per unique displayName
  const rows = await prisma.recipeIngredient.findMany({
    where: { displayName: { not: null } },
    select: {
      displayName: true,
      recipeId: true,
      recipe: { select: { title: true } },
    },
  });
  console.log(`Loaded ${rows.length} rows.`);

  const byName = new Map<string, { uses: number; recipeIds: Set<string>; titles: string[] }>();
  for (const r of rows) {
    const name = r.displayName!.trim();
    if (!name) continue;
    const entry = byName.get(name) ?? { uses: 0, recipeIds: new Set(), titles: [] };
    entry.uses += 1;
    entry.recipeIds.add(r.recipeId);
    if (entry.titles.length < 3 && r.recipe?.title) entry.titles.push(r.recipe.title);
    byName.set(name, entry);
  }

  const proposals: Proposal[] = [];
  const stats: Record<Confidence, number> = { high: 0, medium: 0, low: 0 };

  for (const [name, entry] of byName.entries()) {
    const hasColon = /[:;]/.test(name);
    const hasJunkPrefix = JUNK_PREFIX_RE.test(name);
    const isAlternative = ALTERNATIVE_RE.test(name);
    const isCompound = COMPOUND_DISH_RE.test(name);
    const isAllCaps = /^[A-ZĄĘŁŻŚĆŃÓŹ]{3,8}$/.test(name);
    const tooLong = name.length > 60;

    if (!hasColon && !hasJunkPrefix && !isAlternative && !isCompound && !isAllCaps && !tooLong) {
      continue;  // name is clean, skip
    }

    const { pattern, confidence, action } = classify(name);
    let newDisplayName: string | null = null;
    let splitInto: string[] | null = null;
    let rationale = '';

    if (action === 'update') {
      newDisplayName = normalizeIngredientName(name).displayName;
      rationale = `canonical normalization → "${newDisplayName}"`;
    } else if (action === 'split') {
      splitInto = splitCategoryBag(name);
      if (splitInto.length === 0) {
        // fallback: couldn't split, downgrade to manual
        rationale = 'split requested but split produced no items; treat as manual';
        proposals.push({
          id: randomUUID(),
          currentDisplayName: name,
          uses: entry.uses,
          affectsRecipeCount: entry.recipeIds.size,
          sampleRecipes: entry.titles,
          confidence: 'low',
          pattern: `${pattern}-split-failed`,
          action: 'keep-manual-review',
          newDisplayName: null,
          splitInto: null,
          rationale,
          approved: null,
        });
        stats.low += 1;
        continue;
      }
      rationale = `split "${name}" into ${splitInto.length} ingredients (each grams/${splitInto.length}, taste-only)`;
    } else {
      rationale = `cannot auto-recover — needs manual decision in admin panel`;
    }

    proposals.push({
      id: randomUUID(),
      currentDisplayName: name,
      uses: entry.uses,
      affectsRecipeCount: entry.recipeIds.size,
      sampleRecipes: entry.titles,
      confidence,
      pattern,
      action,
      newDisplayName,
      splitInto,
      rationale,
      approved: null,
    });
    stats[confidence] += 1;
  }

  // Sort: HIGH first (safe to auto-apply), then MEDIUM, then LOW; within each, most uses first
  const confOrder: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };
  proposals.sort((a, b) => {
    const c = confOrder[a.confidence] - confOrder[b.confidence];
    return c !== 0 ? c : b.uses - a.uses;
  });

  const bundle: ProposalBundle = {
    batchId: randomUUID(),
    generatedAt: new Date().toISOString(),
    totalAnalyzed: byName.size,
    stats,
    proposals,
  };

  const outDir = path.join(__dirname, 'data');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'ingredient-repairs.json');
  await fs.writeFile(outPath, JSON.stringify(bundle, null, 2), 'utf8');

  console.log(`\n=== Proposal bundle ===`);
  console.log(`  Batch ID:        ${bundle.batchId}`);
  console.log(`  Generated at:    ${bundle.generatedAt}`);
  console.log(`  Unique names:    ${bundle.totalAnalyzed}`);
  console.log(`  Proposals:       ${proposals.length} (HIGH: ${stats.high}, MEDIUM: ${stats.medium}, LOW: ${stats.low})`);
  console.log(`  Written to:      ${outPath}`);

  if (PRINT_TOP > 0) {
    console.log(`\n=== Top ${PRINT_TOP} proposals ===`);
    for (const p of proposals.slice(0, PRINT_TOP)) {
      const flag = p.confidence === 'high' ? '🟢' : p.confidence === 'medium' ? '🟡' : '🔴';
      const truncName = p.currentDisplayName.length > 80
        ? p.currentDisplayName.slice(0, 77) + '…'
        : p.currentDisplayName;
      console.log(`\n${flag} [${p.confidence.toUpperCase()}] ${p.uses}× "${truncName}"`);
      console.log(`   pattern: ${p.pattern} | action: ${p.action}`);
      if (p.newDisplayName) console.log(`   → update to: "${p.newDisplayName}"`);
      if (p.splitInto) console.log(`   → split into: [${p.splitInto.map((s) => `"${s}"`).join(', ')}]`);
      console.log(`   reason:  ${p.rationale}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
