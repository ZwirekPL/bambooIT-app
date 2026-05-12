// scripts/cleanup-helpers/k6b-rename-patient-frontend.js
//
// K6b helper — bulk rename Patient → Company in apps/web/src/**
// Frontend follow-up to K6a backend rename. Mirrors backend types,
// NextAuth Session/JWT shape, and api client method names.
//
// Usage:
//   node scripts/cleanup-helpers/k6b-rename-patient-frontend.js          (dry-run)
//   node scripts/cleanup-helpers/k6b-rename-patient-frontend.js --apply  (write)
//
// Differences from K6a helper:
//   - Targets apps/web/src/** (TS + TSX)
//   - Adds NextAuth-specific patterns (Session.user, JWT module augmentation)
//   - Adds URL path patterns for API client (/patients → /companies)
//   - Adds Polish UI string patterns (Pacjent → Klient)
//
// SKIP rules:
//   - Lines inside TODO(*-cleanup) commented blocks (K9 territory)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', 'apps', 'web', 'src');
const REPO_ROOT = path.join(__dirname, '..', '..');
const APPLY = process.argv.includes('--apply');

const PATTERNS = [
  // Group A: Type imports (specific known constructs first)
  [/import\s+\{\s*Patient\s*\}/g, 'import { Company }', 'A. import { Patient } → import { Company }'],
  [/import\s+type\s+\{\s*Patient\s*\}/g, 'import type { Company }', 'A. import type { Patient } → import type { Company }'],

  // Group B: Compound identifier renames (before generic patient/Patient)
  [/\bpatientId\b/g, 'companyId', 'B. patientId → companyId (word boundary)'],
  [/\bpatientIds\b/g, 'companyIds', 'B. patientIds → companyIds'],

  // Group C: Field accesses with renamed target (firstName/lastName → contactFirstName/contactLastName)
  [/\bpatient(\??)\.firstName\b/g, 'company$1.contactFirstName', 'C. patient.firstName → company.contactFirstName'],
  [/\bpatient(\??)\.lastName\b/g, 'company$1.contactLastName', 'C. patient.lastName → company.contactLastName'],

  // Group D: Common variable declarations
  [/\bconst\s+patient\s*=/g, 'const company =', 'D. const patient = → const company ='],
  [/\blet\s+patient\s*=/g, 'let company =', 'D. let patient = → let company ='],

  // Group E: TypeScript type annotations
  [/:\s*Patient\b(?!\w)/g, ': Company', 'E. : Patient → : Company'],
  [/<Patient(\[\])?>/g, (_, arr) => `<Company${arr || ''}>`, 'E. <Patient> / <Patient[]> → <Company>'],

  // Group F: Object property keys
  [/\bpatient(\??):\s*\{/g, 'company$1: {', 'F. patient: { → company: {'],
  [/\bpatient(\??):\s*Patient\b/g, 'company$1: Company', 'F. patient: Patient → company: Company'],

  // Group G: URL paths in api calls (Hard rename consequence)
  [/(['"`])\/patients\b/g, "$1/companies", 'G. "/patients" → "/companies" (URL path)'],
  [/(['"`])\/patients\//g, "$1/companies/", 'G. "/patients/" → "/companies/" (URL path)'],

  // Group H: NextAuth Session/JWT specific
  [/session\.user\.patientId/g, 'session.user.companyId', 'H. session.user.patientId → session.user.companyId'],
  [/token\.patientId/g, 'token.companyId', 'H. token.patientId → token.companyId (JWT callback)'],

  // Group I: Generic property access patterns (after specific ones)
  [/\bpatient(?=\??\.\w)/g, 'company', 'I. patient.xxx / patient?.xxx → company'],

  // Group J: Standalone identifiers (most flexible, after specific)
  [/\bpatient\b(?![A-Za-z_])/g, 'company', 'J. patient (standalone) → company'],

  // Group K: Generic Patient type (PascalCase, not part of compound name)
  [/\bPatient\b(?![A-Za-z_])/g, 'Company', 'K. Patient (standalone type) → Company'],

  // Group L: Polish UI strings
  [/'Pacjent'/g, "'Klient'", 'L. \'Pacjent\' → \'Klient\''],
  [/"Pacjent"/g, '"Klient"', 'L. "Pacjent" → "Klient"'],
  [/'Pacjenci'/g, "'Klienci'", 'L. \'Pacjenci\' → \'Klienci\''],
  [/"Pacjenci"/g, '"Klienci"', 'L. "Pacjenci" → "Klienci"'],
];

const FLAG_PATTERNS = [
  // Bare firstName/lastName: in SELECT/data clauses (K6a missed-rename hot-spot lesson)
  [/\bfirstName:\s*true\b/g, 'BARE firstName: true (verify if Company.contactFirstName context)'],
  [/\blastName:\s*true\b/g, 'BARE lastName: true (verify if Company.contactLastName context)'],
];

function isInsideTODOBlock(lines, lineIdx) {
  // Improved heuristic (vs K6a bug):
  // - Current line must itself be a comment for us to be "inside" a block.
  const currentLine = lines[lineIdx].trim();
  if (currentLine !== '' && !currentLine.startsWith('//')) {
    return false;
  }
  for (let i = lineIdx; i >= Math.max(0, lineIdx - 30); i--) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') continue;
    if (!trimmed.startsWith('//')) return false;
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
  filesFlagged: [],
  patternCounts: {},
  flagsFound: {},
};

for (const file of files) {
  const relPath = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
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

const totalPatterns = Object.values(report.patternCounts).reduce((a, b) => a + b, 0);
const totalFlags = Object.values(report.flagsFound).reduce((a, b) => a + b, 0);

console.log('═════════════════════════════════════════════════════════');
console.log(`K6b Rename Patient → Company (frontend) — ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log('═════════════════════════════════════════════════════════');
console.log();
console.log(`Files scanned: ${report.filesScanned}`);
console.log(`Files modified: ${report.filesModified.length}`);
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
console.log('--- FLAGGED files (manual review) ---');
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

if (!APPLY) {
  console.log('DRY-RUN complete. Re-run with --apply to write changes.');
} else {
  console.log('APPLY complete. Run `npm run typecheck` next.');
}
