/**
 * Diagnostic: find RecipeIngredient rows whose displayName is not a single product
 * but a compound/truncated string that leaked in during recipe import.
 *
 * Categories of problems:
 *   1. "przyprawy: X, Y, Z" — spice lists recorded as a single ingredient
 *   2. "dekoracja: ...", "orzechy: ...", "sery: ..." — category bags
 *   3. "X lub Y" / "X i Y" — alternatives/combos
 *   4. "X w cieście/sosie/panierce" — compound dish names (Łosoś w cieście)
 *   5. Truncated tokens ("BIAŁA", "Mrożone") — lost context
 *   6. Very long names (>60 chars) without known canonical match
 *
 * Usage (local):
 *   cd apps/backend && npx ts-node -r dotenv/config -r tsconfig-paths/register \
 *     scripts/diagnose-compound-ingredients.ts
 *
 * Flags:
 *   --csv       Write a CSV report to apps/backend/scripts/data/compound-ingredients.csv
 *   --limit=N   Print top N per category (default 20)
 */

import 'dotenv/config';
import { prisma } from '@db';
import { promises as fs } from 'fs';
import path from 'path';
import { normalizeIngredientName } from '../src/services/planValidation.service';

const WRITE_CSV = process.argv.includes('--csv');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 20;

interface Row {
  displayName: string;
  uses: number;
  recipes: string[];
  category: string;
  afterNormalize: string;
}

async function main() {
  console.log('Loading RecipeIngredient rows…');
  const rows = await prisma.recipeIngredient.groupBy({
    by: ['displayName'],
    _count: { displayName: true },
    where: { displayName: { not: null } },
  });
  console.log(`Total distinct displayName values: ${rows.length}\n`);

  const categorized: Record<string, Row[]> = {
    'spice-lists (zawierają ":")': [],
    'compound dishes (X w cieście/sosie)': [],
    'alternatives (X lub Y)': [],
    'truncated (ALL-CAPS)': [],
    'standalone adjective': [],
    'very long (>60 chars)': [],
    'colon-prefix categories (orzechy:, sery:)': [],
  };

  const STANDALONE = new Set([
    'mrożone', 'mrożony', 'mrożona', 'surowe', 'surowy', 'surowa',
    'świeże', 'świeży', 'świeża', 'suszone', 'biała', 'biały', 'białe',
  ]);

  for (const r of rows) {
    const name = (r.displayName ?? '').trim();
    if (!name) continue;
    const uses = r._count.displayName;
    const norm = normalizeIngredientName(name);
    const row: Row = {
      displayName: name,
      uses,
      recipes: [],
      category: 'unknown',
      afterNormalize: norm.displayName,
    };

    const lower = name.toLowerCase();
    if (/^(?:przyprawy|zioła|dekoracja|dodatki|orzechy|sery|bakalia|topping)[:\-]/i.test(name)) {
      row.category = 'colon-prefix';
      categorized['colon-prefix categories (orzechy:, sery:)'].push(row);
    } else if (/[:;]/.test(name) && name.length > 30) {
      row.category = 'spice-list';
      categorized['spice-lists (zawierają ":")'].push(row);
    } else if (/\s+w\s+(ciescie|cieście|sosie|panier|panko|panierc)/i.test(name)) {
      row.category = 'compound-dish';
      categorized['compound dishes (X w cieście/sosie)'].push(row);
    } else if (/\s+(?:lub|albo)\s+/i.test(name) && name.length > 20) {
      row.category = 'alternatives';
      categorized['alternatives (X lub Y)'].push(row);
    } else if (/^[A-ZĄĘŁŻŚĆŃÓŹ]{3,}$/.test(name)) {
      row.category = 'all-caps';
      categorized['truncated (ALL-CAPS)'].push(row);
    } else if (STANDALONE.has(lower)) {
      row.category = 'standalone-adj';
      categorized['standalone adjective'].push(row);
    } else if (name.length > 60) {
      row.category = 'very-long';
      categorized['very long (>60 chars)'].push(row);
    }
  }

  // Summary
  let totalAffected = 0;
  let totalUses = 0;
  for (const [cat, items] of Object.entries(categorized)) {
    const uses = items.reduce((s, r) => s + r.uses, 0);
    totalAffected += items.length;
    totalUses += uses;
    console.log(`[${cat}]: ${items.length} distinct names, ${uses} total uses across recipes`);
  }
  console.log(`\nTOTAL: ${totalAffected} distinct problematic names, ${totalUses} total uses.\n`);

  // Top N per category
  for (const [cat, items] of Object.entries(categorized)) {
    if (items.length === 0) continue;
    console.log(`\n==== ${cat} (top ${Math.min(LIMIT, items.length)}) ====`);
    const sorted = items.sort((a, b) => b.uses - a.uses).slice(0, LIMIT);
    for (const r of sorted) {
      const truncName = r.displayName.length > 90 ? r.displayName.slice(0, 87) + '…' : r.displayName;
      console.log(`  ${r.uses}× "${truncName}"`);
      if (r.afterNormalize !== r.displayName && r.afterNormalize.length < 50) {
        console.log(`       → normalize: "${r.afterNormalize}"`);
      }
    }
  }

  if (WRITE_CSV) {
    const allRows = Object.values(categorized).flat();
    const header = 'category,uses,displayName,afterNormalize\n';
    const lines = allRows.map((r) => {
      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
      return `${r.category},${r.uses},${esc(r.displayName)},${esc(r.afterNormalize)}`;
    }).join('\n');
    const outDir = path.join(__dirname, 'data');
    await fs.mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, 'compound-ingredients.csv');
    await fs.writeFile(outPath, header + lines, 'utf8');
    console.log(`\nCSV report: ${outPath}`);
  }

  await prisma.$disconnect();
}
main();
