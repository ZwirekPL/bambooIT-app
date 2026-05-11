/**
 * One-time migration: encrypt existing DietitianNote.content (RODO Phase 1.5).
 *
 * Iterates over all DietitianNote rows and encrypts content that is still
 * plaintext (does NOT start with "v1:" prefix). Idempotent — already-encrypted
 * rows are skipped.
 *
 * Usage (from apps/backend/ directory):
 *   npx ts-node -r tsconfig-paths/register ../../scripts/migrate-encrypt-dietitian-notes.ts
 *
 * IMPORTANT: Deploy the application code with encrypt/decrypt logic BEFORE
 * running this script, so fresh reads decrypt correctly.
 */
import { prisma } from '@db';
import { encryptString } from '../apps/backend/src/utils/encryption';

async function main() {
  const notes = await prisma.dietitianNote.findMany({
    select: { id: true, content: true },
  });

  let encrypted = 0;
  let skipped = 0;
  let failed = 0;

  for (const note of notes) {
    if (note.content.startsWith('v1:')) {
      skipped++;
      continue;
    }
    try {
      await prisma.dietitianNote.update({
        where: { id: note.id },
        data: { content: encryptString(note.content) },
      });
      encrypted++;
    } catch (err) {
      failed++;
      console.error(`[migrate] Failed to encrypt note ${note.id}:`, err);
    }
  }

  console.log(
    `[migrate] DietitianNote encryption complete — total: ${notes.length}, encrypted: ${encrypted}, skipped (already v1:): ${skipped}, failed: ${failed}`,
  );

  await prisma.$disconnect();

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[migrate] Fatal:', err);
  process.exit(1);
});
