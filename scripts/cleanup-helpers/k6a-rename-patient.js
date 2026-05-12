// scripts/cleanup-helpers/k6a-rename-patient.js
//
// K6a helper — bulk rename Patient → Company in apps/backend/src/**
// Mechanical pattern-based rename. Hot-spots require manual Edit afterwards.
//
// Usage:
//   node scripts/cleanup-helpers/k6a-rename-patient.js          (dry-run)
//   node scripts/cleanup-helpers/k6a-rename-patient.js --apply  (write changes)
//
// SKIP rules:
//   - 6 orphan diet utils (K9 will drop entirely): cuisineMapping, composeMealsFlag,
//     scaleRecipeSteps, mealSchedule, ingredientDisplayName, templateRenderer
//   - utils/email.ts — handled separately via smart drop+rename (§7 X2)
//   - Lines inside TODO(*-cleanup) commented blocks (K9 territory)
//
// FLAG (no auto-replace, manual review):
//   - patient.sex / .birthYear / .birthDate / .heightCm / .weightKg → DROP LINE
//   - SELECT { sex: true, birthYear: true, ... } → DROP LINES
//   - patientRating field (appSettings) → TODO(K9-cleanup) marker manual

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', 'apps', 'backend', 'src');
const REPO_ROOT = path.join(__dirname, '..', '..');
const APPLY = process.argv.includes('--apply');

const SKIP_FILES = [
  'utils/cuisineMapping.ts',
  'utils/composeMealsFlag.ts',
  'utils/scaleRecipeSteps.ts',
  'utils/mealSchedule.ts',
  'utils/ingredientDisplayName.ts',
  'utils/templateRenderer.ts',
  'utils/email.ts',
];

// Patterns are applied IN ORDER — specific first, generic last.
const PATTERNS = [
  // Group A: Prisma client refs
  [/\bprisma\.patient\b/g, 'prisma.company', 'A. prisma.patient → prisma.company'],
  [/\btx\.patient\b/g, 'tx.company', 'A. tx.patient → tx.company'],

  // Group B: Specific compound identifiers (BEFORE generic Patient/patient rename)
  [/\bassertPatientOwnership\b/g, 'assertCompanyOwnership', 'B. assertPatientOwnership → assertCompanyOwnership'],
  [/\bpatientIdParamSchema\b/g, 'companyIdParamSchema', 'B. patientIdParamSchema → companyIdParamSchema'],
  [/\bpatientsAsDietitian\b/g, 'companiesAsDietitian', 'B. patientsAsDietitian → companiesAsDietitian (K7 territory but consistent rename)'],
  [/\bgetDietitianPatients\b/g, 'getDietitianCompanies', 'B. getDietitianPatients → getDietitianCompanies (K7)'],
  [/\bpatientsCount\b/g, 'companiesCount', 'B. patientsCount → companiesCount (K7 sortBy)'],
  [/\btotalPatients\b/g, 'totalCompanies', 'B. totalPatients → totalCompanies'],

  // Group C: Specific field accesses with renamed target fields
  [/\bpatient(\??)\.firstName\b/g, 'company$1.contactFirstName', 'C. patient.firstName → company.contactFirstName'],
  [/\bpatient(\??)\.lastName\b/g, 'company$1.contactLastName', 'C. patient.lastName → company.contactLastName'],

  // Group D: ID field refs (word boundary so patientRating left alone)
  [/\bpatientIds\b/g, 'companyIds', 'D. patientIds → companyIds'],
  [/\bpatientId\b/g, 'companyId', 'D. patientId → companyId'],

  // Group E: Common variable declarations
  [/\bconst\s+patient\s*=/g, 'const company =', 'E. const patient = → const company ='],
  [/\blet\s+patient\s*=/g, 'let company =', 'E. let patient = → let company ='],

  // Group F: Type annotations + generics (TypeScript)
  [/:\s*Patient\b(?!\w)/g, ': Company', 'F. : Patient → : Company'],
  [/<Patient(\[\])?>/g, (_, arr) => `<Company${arr || ''}>`, 'F. <Patient> / <Patient[]> → <Company>'],

  // Group G: Error messages / user-facing strings
  [/(['"`])Patient not found\1/g, "$1Company not found$1", 'G. "Patient not found" → "Company not found"'],
  [/(['"`])Patient profile not found\1/g, "$1Company profile not found$1", 'G. "Patient profile not found" → "Company profile not found"'],
  [/(['"`])Invalid patient id\1/g, "$1Invalid company id$1", 'G. "Invalid patient id" → "Invalid company id"'],
  [/(['"`])You do not have access to this patient\1/g, "$1You do not have access to this company$1", 'G. access error message rename'],

  // Group H: Generic remaining lowercase patient refs (property access + standalone)
  // Property access: patient.something, patient?.something
  [/\bpatient(?=\??\.\w)/g, 'company', 'H. patient.xxx / patient?.xxx → company'],
  // Generic standalone patient as variable/arg (most flexible — catches remaining)
  [/\bpatient\b(?![A-Za-z_])/g, 'company', 'H. patient (standalone) → company'],

  // Group I: Generic Patient type refs (PascalCase, not part of compound name)
  // Match Patient not followed by a word char (so PatientUser, PatientDietitian etc. stay)
  [/\bPatient\b(?![A-Za-z_])/g, 'Company', 'I. Patient (standalone type) → Company'],

  // Group J: Comment renames (case-insensitive "pacjent" → "klient" in PL; "patient" lowercase already handled)
  // Skipped — comments updated by Group H/I via the patient/Patient rename above.
];

// FLAG patterns — no auto-replace, only report
const FLAG_PATTERNS = [
  [/\bpatient(\??)\.sex\b/g, 'DROP LINE — patient.sex (field removed)'],
  [/\bpatient(\??)\.birthYear\b/g, 'DROP LINE — patient.birthYear (field removed)'],
  [/\bpatient(\??)\.birthDate\b/g, 'DROP LINE — patient.birthDate (field removed)'],
  [/\bpatient(\??)\.heightCm\b/g, 'DROP LINE — patient.heightCm (field removed)'],
  [/\bpatient(\??)\.weightKg\b/g, 'DROP LINE — patient.weightKg (field removed)'],
  [/\bsex:\s*true\b/g, 'DROP LINE — sex: true in SELECT (field removed)'],
  [/\bbirthYear:\s*true\b/g, 'DROP LINE — birthYear: true in SELECT (field removed)'],
  [/\bbirthDate:\s*true\b/g, 'DROP LINE — birthDate: true in SELECT (field removed)'],
  [/\bheightCm:\s*true\b/g, 'DROP LINE — heightCm: true in SELECT (field removed)'],
  [/\bweightKg:\s*true\b/g, 'DROP LINE — weightKg: true in SELECT (field removed)'],
  [/\bpatientRating\b/g, 'TODO(K9-cleanup) marker — patientRating (diet residue, drop in K9)'],
];

// Detect if line is inside a TODO(*-cleanup) commented block.
// Heuristic: scan backwards up to 30 lines from current line. If we find a
// line `// TODO(X-cleanup)` AND every line between it and current is a // comment
// (or blank), we're inside the block.
function isInsideTODOBlock(lines, lineIdx) {
  for (let i = lineIdx; i >= Math.max(0, lineIdx - 30); i--) {
    const line = lines[i];
    const trimmed = line.trim();
    if (i < lineIdx) {
      if (trimmed === '') continue;
      if (!trimmed.startsWith('//')) return false; // hit non-comment code — block ended
    }
    if (/TODO\([A-Za-z0-9._]+-cleanup\)/.test(line)) {
      return true;
    }
  }
  return false;
}

function findFilesRecursive(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...findFilesRecursive(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      result.push(fullPath);
    }
  }
  return result;
}

const files = findFilesRecursive(ROOT);

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

  if (SKIP_FILES.some((skip) => relPath.endsWith(skip))) {
    report.filesSkipped.push(relPath);
    continue;
  }

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  let fileChanges = 0;
  const newLines = lines.map((line, idx) => {
    if (isInsideTODOBlock(lines, idx)) {
      return line;
    }
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

  // FLAG detection on ORIGINAL lines (pre-replacement) so patient.sex still matches
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
    if (APPLY) {
      fs.writeFileSync(file, newLines.join('\n'));
    }
  }
}

// Print report
const totalPatterns = Object.values(report.patternCounts).reduce((a, b) => a + b, 0);
const totalFlags = Object.values(report.flagsFound).reduce((a, b) => a + b, 0);

console.log('═════════════════════════════════════════════════════════');
console.log(`K6a Rename Patient → Company — ${APPLY ? 'APPLY (writes)' : 'DRY-RUN (read-only)'}`);
console.log('═════════════════════════════════════════════════════════');
console.log();
console.log(`Files scanned: ${report.filesScanned}`);
console.log(`Files modified: ${report.filesModified.length}`);
console.log(`Files skipped (orphans + email.ts): ${report.filesSkipped.length}`);
console.log(`Files with FLAGS (manual review): ${report.filesFlagged.length}`);
console.log(`Total patterns replaced: ${totalPatterns}`);
console.log(`Total flags found: ${totalFlags}`);
console.log();
console.log('--- Modified files (sorted by change count) ---');
report.filesModified
  .sort((a, b) => b.changes - a.changes)
  .forEach(({ path: p, changes }) => {
    console.log(`  ${String(changes).padStart(4, ' ')} changes  ${p}`);
  });
console.log();
console.log('--- Pattern counts ---');
Object.entries(report.patternCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([label, count]) => {
    console.log(`  ${String(count).padStart(4, ' ')}  ${label}`);
  });
console.log();
console.log('--- FLAGGED files (manual review REQUIRED) ---');
if (report.filesFlagged.length === 0) {
  console.log('  (none)');
} else {
  report.filesFlagged.forEach(({ path: p, lines }) => {
    console.log(`  ${p}`);
    lines.forEach(({ line, label }) => {
      console.log(`    L${line}: ${label}`);
    });
  });
}
console.log();
console.log('--- Skipped files ---');
report.filesSkipped.forEach((p) => console.log(`  ${p}`));
console.log();

if (!APPLY) {
  console.log('DRY-RUN complete. Re-run with --apply to write changes.');
} else {
  console.log('APPLY complete. Files written. Run `npm run typecheck` next.');
}
