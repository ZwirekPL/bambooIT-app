/**
 * Full database backup for migration.
 * Exports: Recipes, CleanProducts, ClinicalRules, NutritionProtocols,
 * FeatureFlags, Blog posts.
 *
 * Does NOT export: encrypted health data, passwords, tokens, audit logs.
 *
 * Run: npx ts-node --esm scripts/backup-database.ts
 * Output: scripts/data/backup-YYYY-MM-DD/
 */
import { prisma } from '../packages/database/dist/index.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const outDir = path.join(process.cwd(), 'scripts', 'data', `backup-${date}`);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`Backup directory: ${outDir}`);

  const counts: Record<string, number> = {};

  // 1. Recipes (with relations)
  console.log('Exporting recipes...');
  const recipes = await prisma.recipe.findMany({
    where: { isActive: true },
    include: {
      ingredients: { orderBy: { sortOrder: 'asc' } },
      instructionSteps: { orderBy: { stepNumber: 'asc' } },
      nutritionSnapshot: true,
      allergens: true,
      dietFlags: true,
    },
  });
  counts.recipes = recipes.length;
  fs.writeFileSync(path.join(outDir, 'recipes.json'), JSON.stringify(recipes, null, 2));
  console.log(`  recipes: ${recipes.length}`);

  // 2. CleanProducts (with relations)
  console.log('Exporting clean products...');
  const products = await prisma.cleanProduct.findMany({
    where: { isActive: true },
    include: {
      nutrients: true,
      allergens: true,
      dietFlags: true,
      portions: true,
    },
  });
  counts.cleanProducts = products.length;
  fs.writeFileSync(path.join(outDir, 'clean-products.json'), JSON.stringify(products, null, 2));
  console.log(`  clean-products: ${products.length}`);

  // 3. Clinical Rules
  console.log('Exporting clinical rules...');
  const rules = await prisma.clinicalRule.findMany({
    where: { isActive: true },
  });
  counts.clinicalRules = rules.length;
  fs.writeFileSync(path.join(outDir, 'clinical-rules.json'), JSON.stringify(rules, null, 2));
  console.log(`  clinical-rules: ${rules.length}`);

  // 4. Nutrition Protocols
  console.log('Exporting nutrition protocols...');
  const protocols = await prisma.nutritionProtocol.findMany({
    where: { isActive: true },
  });
  counts.nutritionProtocols = protocols.length;
  fs.writeFileSync(path.join(outDir, 'nutrition-protocols.json'), JSON.stringify(protocols, null, 2));
  console.log(`  nutrition-protocols: ${protocols.length}`);

  // 5. Feature Flags
  console.log('Exporting feature flags...');
  const flags = await prisma.featureFlag.findMany();
  counts.featureFlags = flags.length;
  fs.writeFileSync(path.join(outDir, 'feature-flags.json'), JSON.stringify(flags, null, 2));
  console.log(`  feature-flags: ${flags.length}`);

  // 6. Blog posts
  console.log('Exporting blog posts...');
  const posts = await prisma.post.findMany({
    where: { published: true },
  });
  counts.blogPosts = posts.length;
  fs.writeFileSync(path.join(outDir, 'blog-posts.json'), JSON.stringify(posts, null, 2));
  console.log(`  blog-posts: ${posts.length}`);

  // 7. Manifest
  const manifest = {
    date,
    createdAt: new Date().toISOString(),
    counts,
    schemaVersion: 'prisma-6.19',
    note: 'Backup does NOT include encrypted patient data, passwords, tokens, or audit logs.',
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('\nBackup complete!');
  console.log(`Total files: ${Object.keys(counts).length + 1} (incl. manifest)`);

  const totalSize = fs.readdirSync(outDir)
    .reduce((sum, f) => sum + fs.statSync(path.join(outDir, f)).size, 0);
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
