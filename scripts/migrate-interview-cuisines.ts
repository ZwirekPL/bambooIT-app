/**
 * Migrate Interview.answers.cuisinePreferences from the legacy 16-option
 * taxonomy to the post-P0.4 9-option set (Recipe Overhaul Master Plan
 * 2026-04-29). Seven sub-cuisines collapse to broader buckets:
 *
 *   greek, turkish, lebanese, middle_eastern  →  mediterranean
 *   thai, japanese, vietnamese                →  asian_general
 *
 * Why migrate at all (BASE_MAP keeps the legacy codes for back-compat):
 *   • The interview form will stop offering these 7 options. When a patient
 *     re-opens their stored interview, CheckboxGroup renders only the
 *     options it knows — saved values like 'greek' would silently disappear
 *     from the UI and be lost on next save.
 *   • Migrating in place fixes the rendering hole and dedupes (e.g. a patient
 *     who picked both 'greek' and 'mediterranean' ends up with one entry).
 *
 * Idempotent: re-running on already-migrated rows is a no-op.
 *
 * Usage:
 *   npx ts-node --esm scripts/migrate-interview-cuisines.ts            # dry-run
 *   npx ts-node --esm scripts/migrate-interview-cuisines.ts --apply    # write
 *
 * Prereq: backend dist must be built so the AES-GCM encryption helpers in
 * apps/backend/dist/utils/encryption.js are available.
 */

import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import { prisma } from '../packages/database/dist/index.js';

// Load backend env (ENCRYPTION_KEY) before importing the encryption module —
// otherwise process.env.ENCRYPTION_KEY is undefined and decryptJson throws.
dotenvConfig({ path: path.resolve(process.cwd(), 'apps/backend/.env') });

import { decryptJson, encryptJson } from '../apps/backend/dist/utils/encryption.js';

const APPLY = process.argv.includes('--apply');
const BATCH_ID = '2026-04-29-cuisine-collapse-p04';

const COLLAPSE_MAP: Record<string, string> = {
  greek: 'mediterranean',
  turkish: 'mediterranean',
  lebanese: 'mediterranean',
  middle_eastern: 'mediterranean',
  thai: 'asian_general',
  japanese: 'asian_general',
  vietnamese: 'asian_general',
};

interface Migration {
  id: string;
  patientEmail: string | null;
  before: string[];
  after: string[];
  collapsed: string[];
}

function migratePrefs(prefs: unknown): { changed: boolean; before: string[]; after: string[]; collapsed: string[] } {
  if (!Array.isArray(prefs)) {
    return { changed: false, before: [], after: [], collapsed: [] };
  }
  const before = prefs.filter((p): p is string => typeof p === 'string');
  const collapsed: string[] = [];
  const mapped = before.map((p) => {
    const target = COLLAPSE_MAP[p];
    if (target) {
      collapsed.push(p);
      return target;
    }
    return p;
  });
  const after = [...new Set(mapped)];
  const changed =
    collapsed.length > 0 || after.length !== before.length || after.some((v, i) => v !== before[i]);
  return { changed, before, after, collapsed };
}

async function main(): Promise<void> {
  console.log('=== Migrate Interview.answers.cuisinePreferences (P0.4) ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Mode: ${APPLY ? 'APPLY (writes to DB)' : 'DRY-RUN (no writes)'}`);
  console.log(`Batch: ${BATCH_ID}\n`);

  const interviews = await prisma.interview.findMany({
    select: {
      id: true,
      answers: true,
      patient: { select: { user: { select: { email: true } } } },
    },
  });
  console.log(`Interviews scanned: ${interviews.length}\n`);

  const migrations: Migration[] = [];
  let decryptFailures = 0;

  for (const iv of interviews) {
    let answers: Record<string, unknown>;
    try {
      answers = decryptJson(iv.answers as unknown as Parameters<typeof decryptJson>[0]) as Record<string, unknown>;
    } catch (err) {
      decryptFailures++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  [decrypt-fail] ${iv.id} — ${msg.split('\n')[0].slice(0, 80)}`);
      continue;
    }

    const result = migratePrefs(answers.cuisinePreferences);
    if (!result.changed) continue;

    migrations.push({
      id: iv.id,
      patientEmail: iv.patient?.user?.email ?? null,
      before: result.before,
      after: result.after,
      collapsed: result.collapsed,
    });

    console.log(`  [${APPLY ? 'apply' : 'plan '}] ${iv.id} | ${iv.patient?.user?.email ?? '(no email)'}`);
    console.log(`         before: [${result.before.join(', ')}]`);
    console.log(`         after:  [${result.after.join(', ')}]`);
    console.log(`         collapsed: ${result.collapsed.join(', ')}`);

    if (APPLY) {
      const newAnswers = { ...answers, cuisinePreferences: result.after };
      await prisma.$transaction([
        prisma.interview.update({
          where: { id: iv.id },
          data: { answers: encryptJson(newAnswers) },
        }),
        prisma.auditLog.create({
          data: {
            action: 'MIGRATE_INTERVIEW_CUISINES',
            resourceType: 'INTERVIEW',
            resourceId: iv.id,
            metadata: {
              before: result.before,
              after: result.after,
              collapsed: result.collapsed,
              batchId: BATCH_ID,
            },
          },
        }),
      ]);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Decrypt failures (skipped): ${decryptFailures}`);
  console.log(`Interviews migrated: ${migrations.length}`);
  console.log(`Total collapsed cuisine codes: ${migrations.reduce((s, m) => s + m.collapsed.length, 0)}`);
  if (!APPLY) console.log('\n(dry-run — re-run with --apply to write)');
}

main()
  .catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
