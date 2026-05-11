// Export recipe steps from dev DB to JSON for prod import.
// Usage: node apps/backend/scripts/export-recipe-steps.js <output-path>

/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv/config');

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const outPath = process.argv[2] ?? 'c:/tmp/dev-recipe-steps.json';

  const recipes = await prisma.recipe.findMany({
    where: {
      instructionSteps: { some: {} },
    },
    select: {
      title: true,
      instructionSteps: {
        select: {
          stepNumber: true,
          instruction: true,
          phase: true,
          durationMinutes: true,
        },
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  const map = {};
  let duplicateTitles = 0;
  for (const r of recipes) {
    if (map[r.title]) {
      duplicateTitles++;
      continue;
    }
    map[r.title] = r.instructionSteps;
  }

  fs.writeFileSync(outPath, JSON.stringify(map, null, 2));
  console.log(`Exported ${Object.keys(map).length} unique recipe titles to ${outPath}`);
  if (duplicateTitles > 0) {
    console.log(`Skipped ${duplicateTitles} duplicate titles (used first match)`);
  }
  console.log(`File size: ${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
