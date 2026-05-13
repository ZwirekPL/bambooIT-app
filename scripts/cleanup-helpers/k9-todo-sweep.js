#!/usr/bin/env node
/**
 * K9 TODO sweep helper.
 *
 * Detects multi-line `// TODO(...-cleanup)` comment blocks across the
 * backend + web source trees and drops the entire block range
 * (TODO marker + every consecutive `//` line that follows, up to the
 * first non-comment / non-blank-then-comment line).
 *
 * Whitelisted (NEVER dropped):
 *   - `// TODO(...-deploy)` markers (production deployment guidance, e.g. K6a/K7/K8-deploy in middleware/auth.ts)
 *
 * Usage:
 *   node scripts/cleanup-helpers/k9-todo-sweep.js --dry-run
 *   node scripts/cleanup-helpers/k9-todo-sweep.js --apply
 */
const fs = require('fs');
const path = require('path');

const ROOTS = [
  path.resolve(__dirname, '..', '..', 'apps', 'backend', 'src'),
  path.resolve(__dirname, '..', '..', 'apps', 'web', 'src'),
];

const FILE_EXTS = new Set(['.ts', '.tsx']);

const TODO_CLEANUP_RE = /^\s*\/\/\s*TODO\([A-Za-z0-9._-]+-cleanup\)/;
const TODO_DEPLOY_RE = /^\s*\/\/\s*TODO\([A-Za-z0-9._-]+-deploy\)/;
const COMMENT_LINE_RE = /^\s*\/\//;
const BLANK_LINE_RE = /^\s*$/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      walk(full, out);
    } else if (entry.isFile() && FILE_EXTS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function findBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (TODO_CLEANUP_RE.test(line) && !TODO_DEPLOY_RE.test(line)) {
      const start = i;
      let j = i + 1;
      while (j < lines.length) {
        if (COMMENT_LINE_RE.test(lines[j])) {
          if (TODO_DEPLOY_RE.test(lines[j])) break;
          j += 1;
          continue;
        }
        break;
      }
      blocks.push({ start, end: j - 1 });
      i = j;
      continue;
    }
    i += 1;
  }
  return blocks;
}

function processFile(filePath, apply) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const blocks = findBlocks(lines);
  if (blocks.length === 0) return { changed: false, blocks: 0, locDropped: 0 };

  const drop = new Set();
  let loc = 0;
  for (const b of blocks) {
    for (let k = b.start; k <= b.end; k++) {
      drop.add(k);
      loc += 1;
    }
    if (b.end + 1 < lines.length && BLANK_LINE_RE.test(lines[b.end + 1])) {
      const after = b.end + 2;
      const isLastInFile = after >= lines.length;
      const nextIsBlank = !isLastInFile && BLANK_LINE_RE.test(lines[after]);
      if (isLastInFile || nextIsBlank) {
        drop.add(b.end + 1);
        loc += 1;
      }
    }
  }

  if (apply) {
    const kept = lines.filter((_, idx) => !drop.has(idx));
    let out = kept.join('\n');
    out = out.replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(filePath, out);
  }

  return { changed: true, blocks: blocks.length, locDropped: loc };
}

function main() {
  const mode = process.argv.includes('--apply') ? 'apply' : 'dry-run';
  const apply = mode === 'apply';

  const files = [];
  for (const root of ROOTS) walk(root, files);
  files.sort();

  let totalFiles = 0;
  let totalBlocks = 0;
  let totalLoc = 0;
  const fileResults = [];

  for (const f of files) {
    const result = processFile(f, apply);
    if (result.changed) {
      totalFiles += 1;
      totalBlocks += result.blocks;
      totalLoc += result.locDropped;
      fileResults.push({ file: path.relative(process.cwd(), f), ...result });
    }
  }

  console.log(`\n=== K9 TODO sweep [${mode}] ===`);
  console.log(`Scanned ${files.length} files`);
  console.log(`Affected files:   ${totalFiles}`);
  console.log(`TODO blocks:      ${totalBlocks}`);
  console.log(`Lines dropped:    ${totalLoc}\n`);

  fileResults.sort((a, b) => b.blocks - a.blocks);
  for (const r of fileResults) {
    console.log(`  ${r.file}: ${r.blocks} block(s), ${r.locDropped} LOC`);
  }

  if (!apply) console.log(`\n(dry-run — no files modified; re-run with --apply)`);
}

main();
