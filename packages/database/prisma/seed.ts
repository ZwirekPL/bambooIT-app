/**
 * Seed: bambooIT blog categories.
 * Run: npx prisma db seed (from packages/database/)
 * Idempotent — categories upsert on slug.
 *
 * Note: legacy blog-post / food / meal / template-plan seeds were removed —
 * those models no longer exist in the schema.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Canonical bambooIT blog categories. Keep in sync with
// apps/web/src/config/blogCategories.ts (BLOG_CATEGORY_LIST).
const BLOG_CATEGORY_SEED = [
  { name: 'Obsługa IT',          slug: 'obsluga-it' },
  { name: 'Cyberbezpieczeństwo', slug: 'cyberbezpieczenstwo' },
  { name: 'Backup',              slug: 'backup' },
  { name: 'Microsoft 365',       slug: 'microsoft-365' },
  { name: 'Sprzęt i sieci',      slug: 'sprzet-i-sieci' },
  { name: 'Automatyzacje',       slug: 'automatyzacje' },
  { name: 'Strony i aplikacje',  slug: 'strony-i-aplikacje' },
  { name: 'Branże',              slug: 'branze' },
];

async function seedBlogCategories(): Promise<void> {
  let upserted = 0;
  for (const cat of BLOG_CATEGORY_SEED) {
    await prisma.blogCategoryConfig.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, isActive: true },
      create: { name: cat.name, slug: cat.slug, isActive: true },
    });
    upserted++;
  }
  console.log(`Seeded ${upserted} blog categories.`);
}

async function main(): Promise<void> {
  await seedBlogCategories();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
