#!/usr/bin/env node
/**
 * Detects drift between the two vendored copies of `@devdigest/shared`
 * (`server/src/vendor/shared/` and `client/src/vendor/shared/`) — there is no
 * real shared package, so nothing else catches one side silently falling
 * behind the other (see the improvement plan, Tier 4 item 9).
 *
 * One-directional on purpose: the server is the contracts' source of truth
 * (every contract originates from a server-side feature), so this only flags
 * a symbol the server exports that the client is missing — not the reverse.
 * A client-only addition isn't drift this script needs to catch.
 *
 * Usage: node scripts/check-vendor-shared-drift.mjs
 * Exit code: 0 = no drift, 1 = drift found (suitable for a CI step).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SERVER_DIR = join(repoRoot, 'server/src/vendor/shared');
const CLIENT_DIR = join(repoRoot, 'client/src/vendor/shared');

/** Recursively list every `.ts` file under `dir`, as paths relative to `dir`. */
function listTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      for (const f of listTsFiles(full)) out.push(join(entry, f));
    } else if (entry.endsWith('.ts')) {
      out.push(entry);
    }
  }
  return out;
}

/** Extract top-level exported symbol names via a line-level regex — good
 *  enough for these contract files (one declaration per exported line),
 *  not a full TS parse. */
function exportedNames(source) {
  const names = new Set();
  const re = /^export\s+(?:const|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(source))) names.add(m[1]);
  return names;
}

function main() {
  const serverFiles = new Set(listTsFiles(SERVER_DIR));
  const clientFiles = new Set(listTsFiles(CLIENT_DIR));

  const missingFiles = [...serverFiles].filter((f) => !clientFiles.has(f));
  const perFileMissingSymbols = [];

  for (const file of serverFiles) {
    if (!clientFiles.has(file)) continue;
    const serverSrc = readFileSync(join(SERVER_DIR, file), 'utf8');
    const clientSrc = readFileSync(join(CLIENT_DIR, file), 'utf8');
    const serverNames = exportedNames(serverSrc);
    const clientNames = exportedNames(clientSrc);
    const missing = [...serverNames].filter((n) => !clientNames.has(n));
    if (missing.length > 0) perFileMissingSymbols.push({ file, missing });
  }

  if (missingFiles.length === 0 && perFileMissingSymbols.length === 0) {
    console.log('✓ client/src/vendor/shared is not missing anything server/src/vendor/shared exports.');
    return 0;
  }

  console.error('✗ client/src/vendor/shared has drifted from server/src/vendor/shared:\n');
  for (const file of missingFiles) {
    console.error(`  - missing file entirely: ${relative(repoRoot, join(SERVER_DIR, file))}`);
  }
  for (const { file, missing } of perFileMissingSymbols) {
    console.error(`  - ${file}: missing export(s) ${missing.join(', ')}`);
  }
  console.error(
    '\nIf this is intentional (a server-only type), note it in client/src/vendor/shared\'s INSIGHTS.md.\nOtherwise, copy the missing symbol(s) over from the server side (see each package\'s AGENTS.md — vendor/shared is edited at the source lesson, not ad hoc).',
  );
  return 1;
}

process.exit(main());
