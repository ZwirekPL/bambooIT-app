// Import/sync blog posts from a JSON export into the current DATABASE_URL.
// Idempotent: upserts each post on its unique `slug` (safe to re-run).
//
// Usage (inside a container that has @prisma/client + DATABASE_URL set to prod):
//   docker cp scripts/import-blog-posts.mjs   bambooit_backend:/tmp/
//   docker cp scripts/blog-posts-export.json  bambooit_backend:/tmp/
//   docker exec bambooit_backend node /tmp/import-blog-posts.mjs /tmp/blog-posts-export.json
//
// DB-managed fields (id, viewCount, createdAt, updatedAt) are intentionally
// absent from the export — the DB assigns them. publishedAt is preserved.
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const jsonPath = process.argv[2] ?? new URL('./blog-posts-export.json', import.meta.url).pathname;
const posts = JSON.parse(readFileSync(jsonPath, 'utf8'));

if (!Array.isArray(posts) || posts.length === 0) {
  console.error(`No posts found in ${jsonPath}`);
  process.exit(1);
}

const prisma = new PrismaClient();

// Normalize date strings -> Date so Prisma accepts them regardless of input shape.
function toData(p) {
  return {
    ...p,
    publishedAt: new Date(p.publishedAt),
    scheduledAt: p.scheduledAt ? new Date(p.scheduledAt) : null,
    faq: p.faq ?? undefined, // Json? — leave untouched if absent
  };
}

async function main() {
  let created = 0;
  let updated = 0;
  for (const p of posts) {
    const data = toData(p);
    const existing = await prisma.post.findUnique({ where: { slug: p.slug }, select: { id: true } });
    await prisma.post.upsert({
      where: { slug: p.slug },
      update: data,
      create: data,
    });
    if (existing) updated++;
    else created++;
    console.log(`${existing ? 'updated' : 'created'}: ${p.slug}`);
  }
  console.log(`\nDone. ${created} created, ${updated} updated, ${posts.length} total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
