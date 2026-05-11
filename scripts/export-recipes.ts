/**
 * Export complete recipe database to JSON for production migration.
 *
 * Usage:
 *   npx ts-node -e "require('./scripts/export-recipes.ts')"
 *   -- or via npm script --
 *   npm run db:export:recipes
 *
 * Output: scripts/data/recipes-export.json
 *
 * Exports only non-AI active recipes (origin != 'ai_generated' OR aiApproved = true).
 */
import { prisma } from '../packages/database/dist/index.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const includeAi = process.argv.includes('--include-ai');

  console.log('Exporting recipes...');
  if (includeAi) {
    console.log('  Mode: ALL recipes (including unapproved AI)');
  } else {
    console.log('  Mode: production-ready only (manual/scraped + approved AI)');
  }

  const where = includeAi
    ? { isActive: true }
    : {
        isActive: true,
        OR: [
          { origin: { not: 'ai_generated' } },
          { origin: 'ai_generated', aiApproved: true },
        ],
      };

  const total = await prisma.recipe.count({ where });
  console.log(`Found ${total} recipes — fetching...`);

  const recipes = await prisma.recipe.findMany({
    where,
    include: {
      ingredients: { orderBy: { sortOrder: 'asc' } },
      instructionSteps: { orderBy: { stepNumber: 'asc' } },
      nutritionSnapshot: true,
      allergens: true,
      dietFlags: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const outDir = path.join(process.cwd(), 'scripts', 'data');
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'recipes-export.json');
  fs.writeFileSync(outPath, JSON.stringify(recipes, null, 2));

  const sizeMb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
  console.log(`\nDone: ${recipes.length} recipes exported`);
  console.log(`Output: ${outPath} (${sizeMb} MB)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
