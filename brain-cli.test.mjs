// The brain's glue, end to end on throwaway directories: the real journal (persist.mjs through the real
// mind), real files in, the digest out, and the command line itself. Proves the wire, not just the law
// (brain.test.mjs has the law). The home directory is pointed at a throwaway too, so even a mutant that
// ignores the KAR_* settings can only ever touch a temp folder, never a real brain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'brain-cli.mjs');
const root = mkdtempSync(join(tmpdir(), 'kar-brain-'));
const home = join(root, 'home');
mkdirSync(home, { recursive: true });
process.env.HOME = home;
process.env.USERPROFILE = home;

function world(name) {
  const base = join(root, name);
  const dirs = { brain: join(base, 'brain'), memory: join(base, 'memory'), asks: join(base, 'asks.json') };
  mkdirSync(dirs.memory, { recursive: true });
  mkdirSync(dirs.brain, { recursive: true });
  return dirs;
}
const mem = (dirs, name, desc, ext = '.md') => writeFileSync(join(dirs.memory, name + ext), '---\nname: ' + name + '\ndescription: "' + desc + '"\n---\nbody\n');
const env = (dirs) => ({ ...process.env, KAR_BRAIN_DIR: dirs.brain, KAR_MEMORY_DIR: dirs.memory, KAR_ASKS: dirs.asks, HOME: home, USERPROFILE: home });
const run = (dirs, ...args) => spawnSync(process.execPath, [CLI, ...args], { env: env(dirs), encoding: 'utf8', timeout: 30000 });

const A = world('a');
mem(A, 'forge', 'the forge prints a seal');
mem(A, 'world', 'the world deals cards');
mem(A, 'notes', 'a text file is not a memory', '.txt');
writeFileSync(join(A.memory, 'MEMORY.md'), '---\nname: index\ndescription: "the index is not a memory file"\n---\n> ESTATE = 1,768 repos\n\n**Recent builds (newest first):**\n- [world](world.md) — LIVE 2d57105\n');
writeFileSync(A.asks, JSON.stringify({ asks: [{ id: 'd1', kind: 'decision', status: 'open', say: 'pick a name', at: '2026-10-01T00:00:00Z' }] }));
writeFileSync(join(A.brain, 'backlog.json'), JSON.stringify({ items: [{ id: 'one', n: 1, title: 'Build one', status: 'open' }, { id: 'two', n: 2, title: 'Build two', status: 'open', after: ['one'] }] }));

process.env.KAR_BRAIN_DIR = A.brain;
process.env.KAR_MEMORY_DIR = A.memory;
process.env.KAR_ASKS = A.asks;
const cli = await import('./brain-cli.mjs');

test('the paths come from the environment', () => {
  assert.deepEqual(cli.PATHS, { brain: A.brain, memory: A.memory, asks: A.asks });
});

test('ingest writes new facts to the journal once, and a change once more', async () => {
  const first = await cli.ingest();
  assert.deepEqual([first.read, first.wrote, first.events], [5, 5, 5], 'two memory files, one ask, two queue items — not the index, not the .txt');
  assert.equal(first.journal, join(A.brain, 'mind-journal.json'));
  assert.ok(existsSync(first.journal));
  const again = await cli.ingest();
  assert.deepEqual([again.wrote, again.events], [0, 5], 'an unchanged world writes nothing');
  mem(A, 'forge', 'the forge prints a seal, and reads U as V');
  const changed = await cli.ingest();
  assert.deepEqual([changed.wrote, changed.events], [1, 6]);
});

test('the journal survives: a fresh boot replays it to the same facts', async () => {
  const b = await cli.open();
  assert.equal(b.mind.events().length, 6);
  assert.equal(b.restoredFrom, join(A.brain, 'mind-journal.json'));
  const fresh = run(A, 'status');
  assert.equal(fresh.status, 0);
  assert.deepEqual(JSON.parse(fresh.stdout), { facts: 5, events: 6, journal: join(A.brain, 'mind-journal.json'), digest: join(A.brain, 'digest.txt') });
});

test('the digest reads the working memory back, and marking moves the last look', async () => {
  const d = await cli.readDigest({ mark: true, now: Date.UTC(2026, 9, 1, 12) });
  assert.ok(d.startsWith('── KAR\'S BRAIN · working memory, read from the persistent journal (5 facts) ──'));
  assert.ok(d.includes('ESTATE: ESTATE = 1,768 repos'));
  assert.ok(d.includes('· world — LIVE 2d57105'));
  assert.ok(d.includes('NEXT BUILD (Simon\'s approved order): 1 · Build one'));
  assert.ok(d.includes('DECISIONS ONLY SIMON MAKES (1):\n· pick a name'));
  assert.ok(d.includes('· forge — the forge prints a seal, and reads U as V'));
  assert.ok(d.endsWith('(read 2026-10-01T12:00:00.000Z)'));
  assert.equal(readFileSync(join(A.brain, 'digest.txt'), 'utf8'), d + '\n');
  assert.deepEqual(JSON.parse(readFileSync(join(A.brain, 'look.json'), 'utf8')), { at: Date.UTC(2026, 9, 1, 12) });
  const later = await cli.readDigest({ mark: false, now: 0 });
  assert.ok(later.includes('CHANGED SINCE THE LAST LOOK (0): nothing'));
  assert.ok(!later.includes('(read '));
  assert.deepEqual(JSON.parse(readFileSync(join(A.brain, 'look.json'), 'utf8')), { at: Date.UTC(2026, 9, 1, 12) }, 'reading without a mark leaves the last look alone');
  const viaCli = run(A, 'digest');
  assert.equal(viaCli.status, 0);
  assert.ok(viaCli.stdout.includes('CHANGED SINCE THE LAST LOOK (0): nothing'));
  assert.ok(viaCli.stdout.includes('(read '), 'the command line stamps when it read');
  const t0 = Date.now();
  const marked = run(A, 'digest', '--mark');
  assert.equal(marked.status, 0);
  const at = JSON.parse(readFileSync(join(A.brain, 'look.json'), 'utf8')).at;
  assert.ok(at >= t0 && at <= Date.now(), 'the command line marks the look at the moment it read');
});

test('next, decisions and done, from the command line', () => {
  const n = run(A, 'next');
  assert.equal(n.status, 0);
  assert.deepEqual(JSON.parse(n.stdout).build.id, 'one');
  const d = run(A, 'decisions');
  assert.deepEqual(JSON.parse(d.stdout), [{ id: 'd1', say: 'pick a name', from: 'ask' }]);
  const done = run(A, 'done', 'one');
  assert.equal(done.status, 0);
  assert.deepEqual(JSON.parse(done.stdout).wrote, 1);
  const q = JSON.parse(readFileSync(join(A.brain, 'backlog.json'), 'utf8'));
  assert.equal(q.items[0].status, 'done');
  assert.ok(Number.isFinite(q.items[0].ts) && q.items[0].ts > 0);
  assert.equal(JSON.parse(run(A, 'next').stdout).build.id, 'two');
  const missing = run(A, 'done', 'nope');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /no queue item nope/);
  const ingest = run(A, 'ingest');
  assert.equal(ingest.status, 0);
  assert.equal(JSON.parse(ingest.stdout).wrote, 0);
  const usage = run(A);
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /usage: node brain-cli\.mjs ingest/);
});

test('a world with nothing in it, and a queue with no file', () => {
  const B = world('b');
  rmSync(B.memory, { recursive: true });
  const r = run(B, 'ingest');
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout).read, 0);
  const d = run(B, 'digest');
  assert.ok(d.stdout.includes('NEXT BUILD (Simon\'s approved order): the queue is empty'));
  assert.ok(!d.stdout.includes('ESTATE:'));
  const none = run(B, 'done', 'one');
  assert.equal(none.status, 1);
  assert.match(none.stderr, /^no queue item one/, 'a missing queue is "no such item", not a crash');
});

test('a damaged journal is refused loudly, never booted', () => {
  const C = world('c');
  writeFileSync(join(C.brain, 'mind-journal.json'), '{ not a journal');
  const r = run(C, 'ingest');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^brain: journal load failed/);
  rmSync(root, { recursive: true, force: true });
});
