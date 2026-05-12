// scripts/cleanup-helpers/k7-drop-dietitian.js
//
// K7 helper — drop DIETITIAN role + DietitianProfile + rename PATIENT → CLIENT
// in apps/backend/src/** + apps/web/src/**
//
// Usage:
//   node scripts/cleanup-helpers/k7-drop-dietitian.js          (dry-run)
//   node scripts/cleanup-helpers/k7-drop-dietitian.js --apply  (write)
//
// Groups:
//   A — UserRole enum value substitutions (PATIENT → CLIENT)
//   B — DIETITIAN role drop from arrays/checks
//   C — DietitianProfile model references (prisma.dietitianProfile.*)
//   D — User.companiesAsDietitian relation drop
//   E — Polish UI copy (Pacjent → Klient — should already be done by K6 helpers)
//   F — Specific orphans (patientRating field, dietitianCode param)
//
// SKIP rules:
//   - 6 orphan diet utils in apps/backend/src/utils/ (K9 drop)
//   - Lines inside TODO(*-cleanup) commented blocks

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const APPLY = process.argv.includes('--apply');

const ROOTS = [
  path.join(REPO_ROOT, 'apps', 'backend', 'src'),
  path.join(REPO_ROOT, 'apps', 'web', 'src'),
];

const SKIP_FILES = [
  'apps/backend/src/utils/cuisineMapping.ts',
  'apps/backend/src/utils/composeMealsFlag.ts',
  'apps/backend/src/utils/scaleRecipeSteps.ts',
  'apps/backend/src/utils/mealSchedule.ts',
  'apps/backend/src/utils/ingredientDisplayName.ts',
  'apps/backend/src/utils/templateRenderer.ts',
];

// Patterns applied IN ORDER — specific first, generic last
const PATTERNS = [
  // Group A: UserRole enum value substitutions
  // String literal 'PATIENT' → 'CLIENT' (covers role: 'PATIENT', === 'PATIENT', etc.)
  [/'PATIENT'/g, "'CLIENT'", "A. 'PATIENT' → 'CLIENT' (string literal)"],
  [/"PATIENT"/g, '"CLIENT"', 'A. "PATIENT" → "CLIENT" (double-quoted)'],
  // Property values containing PATIENT (e.g., username: 'PATIENT' in test data — keep generic literal rename)
  // (covered by above)

  // Group B: DIETITIAN drop from common contexts
  // Triple-role array: ['ADMIN', 'DIETITIAN', 'PATIENT'] → ['ADMIN', 'CLIENT'] (note: PATIENT already renamed by Group A)
  // After Group A above, arrays will be ['ADMIN', 'DIETITIAN', 'CLIENT']. Now strip DIETITIAN:
  [/'ADMIN',\s*'DIETITIAN',\s*'CLIENT'/g, "'ADMIN', 'CLIENT'", "B. requireAuth/enum triple ['ADMIN','DIETITIAN','CLIENT'] → ['ADMIN','CLIENT']"],
  // Dual-role array: ['ADMIN', 'DIETITIAN'] → ['ADMIN']
  [/'ADMIN',\s*'DIETITIAN'/g, "'ADMIN'", "B. requireAuth dual 'ADMIN', 'DIETITIAN' → 'ADMIN'"],
  // requireAuth multi-arg: requireAuth('ADMIN', 'DIETITIAN', 'CLIENT') → requireAuth('ADMIN', 'CLIENT')
  [/requireAuth\('ADMIN',\s*'DIETITIAN',\s*'CLIENT'\)/g, "requireAuth('ADMIN', 'CLIENT')", "B. requireAuth triple → ('ADMIN','CLIENT')"],
  [/requireAuth\('ADMIN',\s*'DIETITIAN'\)/g, "requireAuth('ADMIN')", "B. requireAuth dual → ('ADMIN')"],
  // Standalone 'DIETITIAN' literal (rare, e.g., user assignment) — flag for manual review (no auto-replace)

  // Group C: DietitianProfile type imports (rare in TS)
  [/import\s+\{\s*DietitianProfile\s*\}/g, 'import {}', "C. import { DietitianProfile } → import {} (will be cleaned)"],

  // Group D: companiesAsDietitian relation — usually nested in prisma includes/selects
  // Manual handling required (context-dependent), skip auto-replace

  // Group E: Polish UI copy
  [/'Pacjent'/g, "'Klient'", "E. 'Pacjent' → 'Klient'"],
  [/"Pacjent"/g, '"Klient"', 'E. "Pacjent" → "Klient"'],
  [/'Pacjenci'/g, "'Klienci'", "E. 'Pacjenci' → 'Klienci'"],
  [/"Pacjenci"/g, '"Klienci"', 'E. "Pacjenci" → "Klienci"'],

  // Group F: Specific identifiers
  // dietitianCode parameter — flag (manual drop preferred)
];

const FLAG_PATTERNS = [
  // DIETITIAN literal in less common contexts (assignments, comparisons)
  [/'DIETITIAN'/g, "Standalone 'DIETITIAN' literal — manual review (auth function? audit action? array elem?)"],
  [/"DIETITIAN"/g, 'Standalone "DIETITIAN" literal — manual review'],
  // DietitianProfile model uses
  [/\bprisma\.dietitianProfile\b/g, 'prisma.dietitianProfile.* — drop entire call (manual)'],
  [/\btx\.dietitianProfile\b/g, 'tx.dietitianProfile.* — drop entire call (manual)'],
  [/\bDietitianProfile\b/g, 'DietitianProfile type/model — manual review'],
  // companiesAsDietitian relation
  [/\bcompaniesAsDietitian\b/g, 'companiesAsDietitian relation — drop from include/select (manual)'],
  // dietitianId field on Company
  [/\bdietitianId\b/g, 'dietitianId field — drop (Company column dropped in K7)'],
  // dietitianCode signup param
  [/\bdietitianCode\b/g, 'dietitianCode — drop param/block (auth.service signup)'],
  // patientRating
  [/\bpatientRating\b/g, 'patientRating — drop field (K7 cleanup)'],
];

function isInsideTODOBlock(lines, lineIdx) {
  const currentLine = lines[lineIdx].trim();
  if (currentLine !== '' && !currentLine.startsWith('//')) return false;
  for (let i = lineIdx; i >= Math.max(0, lineIdx - 30); i--) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') continue;
    if (!trimmed.startsWith('//')) return false;
    if (/TODO\([A-Za-z0-9._]+-cleanup\)/.test(line)) return true;
  }
  return false;
}

function findFilesRecursive(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...findFilesRecursive(fullPath));
    else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      result.push(fullPath);
    }
  }
  return result;
}

const files = ROOTS.flatMap(findFilesRecursive);

const report = {
  filesScanned: files.length,
  filesModified: [],
  filesSkipped: [],
  filesFlagged: [],
  patternCounts: {},
  flagsFound: {},
};

for (const file of files) {
  const relPath = path.relative(REPO_ROOT, file).replace(/\\/g, '/');

  if (SKIP_FILES.some((skip) => relPath === skip)) {
    report.filesSkipped.push(relPath);
    continue;
  }

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  let fileChanges = 0;
  const newLines = lines.map((line, idx) => {
    if (isInsideTODOBlock(lines, idx)) return line;
    let newLine = line;
    for (const [regex, replacement, label] of PATTERNS) {
      const before = newLine;
      newLine = newLine.replace(regex, replacement);
      if (newLine !== before) {
        const count = (before.match(regex) || []).length;
        report.patternCounts[label] = (report.patternCounts[label] || 0) + count;
        fileChanges += count;
      }
    }
    return newLine;
  });

  // FLAGS on ORIGINAL lines
  lines.forEach((line, idx) => {
    if (isInsideTODOBlock(lines, idx)) return;
    for (const [regex, label] of FLAG_PATTERNS) {
      if (regex.test(line)) {
        report.flagsFound[label] = (report.flagsFound[label] || 0) + 1;
        let entry = report.filesFlagged.find((f) => f.path === relPath);
        if (!entry) {
          entry = { path: relPath, lines: [] };
          report.filesFlagged.push(entry);
        }
        if (!entry.lines.some((l) => l.line === idx + 1 && l.label === label)) {
          entry.lines.push({ line: idx + 1, label });
        }
      }
    }
  });

  if (fileChanges > 0) {
    report.filesModified.push({ path: relPath, changes: fileChanges });
    if (APPLY) fs.writeFileSync(file, newLines.join('\n'));
  }
}

const totalPatterns = Object.values(report.patternCounts).reduce((a, b) => a + b, 0);
const totalFlags = Object.values(report.flagsFound).reduce((a, b) => a + b, 0);

console.log('═════════════════════════════════════════════════════════');
console.log(`K7 Drop DIETITIAN + Rename PATIENT→CLIENT — ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log('═════════════════════════════════════════════════════════\n');
console.log(`Files scanned: ${report.filesScanned}`);
console.log(`Files modified: ${report.filesModified.length}`);
console.log(`Files with FLAGS (manual review): ${report.filesFlagged.length}`);
console.log(`Total patterns replaced: ${totalPatterns}`);
console.log(`Total flags found: ${totalFlags}\n`);
console.log('--- Modified files ---');
report.filesModified.sort((a, b) => b.changes - a.changes).forEach(({ path: p, changes }) => {
  console.log(`  ${String(changes).padStart(4, ' ')} changes  ${p}`);
});
console.log('\n--- Pattern counts ---');
Object.entries(report.patternCounts).sort((a, b) => b[1] - a[1]).forEach(([label, count]) => {
  console.log(`  ${String(count).padStart(4, ' ')}  ${label}`);
});
console.log('\n--- FLAGGED files (manual review) ---');
if (report.filesFlagged.length === 0) console.log('  (none)');
else report.filesFlagged.forEach(({ path: p, lines }) => {
  console.log(`  ${p}`);
  lines.forEach(({ line, label }) => console.log(`    L${line}: ${label}`));
});
console.log('\n--- Skipped files ---');
report.filesSkipped.forEach((p) => console.log(`  ${p}`));
console.log();

if (!APPLY) console.log('DRY-RUN complete. Re-run with --apply to write changes.');
else console.log('APPLY complete. Run typecheck + manual hot-spots next.');
