// Import recipe steps from JSON dump into current DB.
// For each prod Recipe without instructionSteps, matches by title and inserts.
//
// Usage: node /app/import-recipe-steps.js /path/to/dev-recipe-steps.json [--dry-run]

/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv/config');

const fs = require('fs');
const { prisma } = require('/app/packages/database/dist/index.js');

async function main() {
  const jsonPath = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!jsonPath) {
    console.error('Usage: node import-recipe-steps.js <json-path> [--dry-run]');
    process.exit(1);
  }

  const map = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Loaded ${Object.keys(map).length} recipe titles with steps`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'APPLY'}`);

  // Find prod recipes without steps
  const recipes = await prisma.recipe.findMany({
    where: { instructionSteps: { none: {} } },
    select: { id: true, title: true },
  });
  console.log(`Found ${recipes.length} recipes without steps on this DB`);

  let matched = 0;
  let notMatched = 0;
  let totalStepsInserted = 0;
  const unmatchedSample = [];

  for (const recipe of recipes) {
    const steps = map[recipe.title];
    if (!steps || steps.length === 0) {
      notMatched++;
      if (unmatchedSample.length < 10) unmatchedSample.push(recipe.title);
      continue;
    }

    matched++;
    totalStepsInserted += steps.length;

    if (!dryRun) {
      await prisma.recipeInstructionStep.createMany({
        data: steps.map((s) => ({
          recipeId: recipe.id,
          stepNumber: s.stepNumber,
          instruction: s.instruction,
          phase: s.phase ?? 'cook',
          durationMinutes: s.durationMinutes ?? null,
        })),
        skipDuplicates: true,
      });
    }

    if (matched % 100 === 0) {
      console.log(`  progress: ${matched} matched, ${notMatched} unmatched`);
    }
  }

  console.log('');
  console.log(`Summary:`);
  console.log(`  Matched titles:  ${matched} recipes`);
  console.log(`  Steps inserted:  ${totalStepsInserted} rows`);
  console.log(`  Unmatched:       ${notMatched} recipes (no dev counterpart by title)`);
  if (unmatchedSample.length > 0) {
    console.log('');
    console.log(`Sample unmatched titles (first 10):`);
    for (const t of unmatchedSample) console.log(`  - ${t}`);
  }
  if (dryRun) console.log('\n(DRY RUN — nothing was written)');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
