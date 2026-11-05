#!/usr/bin/env node
// tools/gate-receipt.mjs — the gate receipt's file glue (the law is gatereceipt.mjs, witness-gated).
//   gh run download <run id> -R sjgant80-hub/kar-mind -D <dir>      the run's artifacts: witness-<kernel>/, test-counts/
//   node tools/gate-receipt.mjs --from <dir>                          → data/gate-receipt.json, each kernel hashed as the
//                                                                       run's commit holds it (git show <sha>:<file>)
//   node tools/gate-receipt.mjs --check                               the receipt against the workflow and the files now
//                                                                       (CI runs it; exit 1 when a gated kernel is missing)
// Every hash is of the file's text with line endings as git stores them (LF), so a Windows checkout and the runner agree.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { matrixOf, build, check } from '../gatereceipt.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RECEIPT = join(ROOT, 'data', 'gate-receipt.json');
const sha256 = (text) => createHash('sha256').update(String(text).replace(/\r\n/g, '\n'), 'utf8').digest('hex');
export const matrix = () => matrixOf(readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8'));
/** each gated kernel's hash as it is in the working tree now */
export const hashesNow = (m = matrix()) => Object.fromEntries(m.filter((k) => existsSync(join(ROOT, k.kernel))).map((k) => [k.kernel, sha256(readFileSync(join(ROOT, k.kernel), 'utf8'))]));
/** the committed receipt checked against the workflow and the files now: { ok, why, rows, changed } (rows empty if none) */
export function current() {
  if (!existsSync(RECEIPT)) return { ok: false, why: 'no gate receipt yet', rows: [], changed: [], receipt: null };
  const receipt = JSON.parse(readFileSync(RECEIPT, 'utf8')), m = matrix();
  return { ...check(receipt, m, hashesNow(m)), receipt };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  if (args[0] === '--from' && args[1]) {
    const dir = args[1], m = matrix();
    const verdicts = readdirSync(dir).filter((d) => d.startsWith('witness-')).map((d) => JSON.parse(readFileSync(join(dir, d, d.slice('witness-'.length) + '.json'), 'utf8')));
    const counts = JSON.parse(readFileSync(join(dir, 'test-counts', 'test-counts.json'), 'utf8'));
    const sha = verdicts.length ? verdicts[0].sha : '';
    const hashes = Object.fromEntries(m.map((k) => { try { return [k.kernel, sha256(execFileSync('git', ['show', sha + ':' + k.kernel], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }))]; } catch { return [k.kernel, null]; } }));
    const r = build({ verdicts, counts, matrix: m, hashes, witness: verdicts.length ? verdicts[0].witness : '' });
    if (!r.ok) { console.error('✗ ' + r.why); process.exit(1); }
    writeFileSync(RECEIPT, JSON.stringify(r.receipt, null, 1) + '\n');
    const t = r.receipt.totals;
    console.log('✓ data/gate-receipt.json · run ' + r.receipt.run + ' at ' + r.receipt.sha.slice(0, 7) + ' · ' + t.kernels + ' kernels · ' + t.caught + ' of ' + t.mutants + ' mutants caught · ' + t.testsPassed + ' tests passed, ' + t.testsFailed + ' failed · ' + (t.clean ? 'clean' : 'NOT clean'));
  } else if (args[0] === '--check') {
    const c = current();
    console.log((c.ok ? '✓ ' : '✗ ') + c.why);
    process.exit(c.ok ? 0 : 1);
  } else { console.log('usage: node tools/gate-receipt.mjs --from <downloaded artifacts dir> | --check'); process.exit(2); }
}
