// The brain's glue, end to end on a throwaway directory: the real journal (persist.mjs through the real
// mind), real files in, the digest out. Proves the wire, not just the law (brain.test.mjs has the law).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = mkdtempSync(join(tmpdir(), 'kar-brain-'));
const dirs = { brain: join(root, 'brain'), memory: join(root, 'memory') };
mkdirSync(dirs.memory, { recursive: true });
mkdirSync(dirs.brain, { recursive: true });
process.env.KAR_BRAIN_DIR = dirs.brain;
process.env.KAR_MEMORY_DIR = dirs.memory;
process.env.KAR_ASKS = join(root, 'asks.json');
const mem = (name, desc) => writeFileSync(join(dirs.memory, name + '.md'), '---\nname: ' + name + '\ndescription: "' + desc + '"\n---\nbody\n');
mem('forge', 'the forge prints a seal');
mem('world', 'the world deals cards');
writeFileSync(join(dirs.memory, 'MEMORY.md'), '> ESTATE = 1,768 repos\n\n**Recent builds (newest first):**\n- [world](world.md) — LIVE 2d57105\n');
writeFileSync(process.env.KAR_ASKS, JSON.stringify({ asks: [{ id: 'd1', kind: 'decision', status: 'open', say: 'pick a name', at: '2026-10-01T00:00:00Z' }] }));
writeFileSync(join(dirs.brain, 'backlog.json'), JSON.stringify({ items: [{ id: 'one', n: 1, title: 'Build one', status: 'open' }, { id: 'two', n: 2, title: 'Build two', status: 'open', after: ['one'] }] }));

const cli = await import('./brain-cli.mjs');

test('ingest writes new facts to the journal once, and a change once more', async () => {
  const first = await cli.ingest();
  assert.deepEqual([first.read, first.wrote, first.events], [5, 5, 5]);
  assert.ok(existsSync(first.journal));
  const again = await cli.ingest();
  assert.deepEqual([again.wrote, again.events], [0, 5], 'an unchanged world writes nothing');
  mem('forge', 'the forge prints a seal, and reads U as V');
  const changed = await cli.ingest();
  assert.deepEqual([changed.wrote, changed.events], [1, 6]);
});

test('the journal survives: a fresh boot replays it to the same facts', async () => {
  const b = await cli.open();
  assert.equal(b.mind.events().length, 6);
  assert.equal(b.restoredFrom, join(dirs.brain, 'mind-journal.json'));
});

test('the digest reads the working memory back, and marking moves the last look', async () => {
  const d = await cli.readDigest({ mark: true, now: Date.UTC(2026, 9, 1, 12) });
  assert.ok(d.startsWith('── KAR\'S BRAIN · working memory, read from the persistent journal (5 facts) ──'));
  assert.ok(d.includes('ESTATE: ESTATE = 1,768 repos'));
  assert.ok(d.includes('· world — LIVE 2d57105'));
  assert.ok(d.includes('NEXT BUILD (Simon\'s approved order): 1 · Build one'));
  assert.ok(d.includes('DECISIONS ONLY SIMON MAKES (1):\n· pick a name'));
  assert.ok(d.includes('· forge — the forge prints a seal, and reads U as V'));
  assert.equal(readFileSync(join(dirs.brain, 'digest.txt'), 'utf8'), d + '\n');
  assert.deepEqual(JSON.parse(readFileSync(join(dirs.brain, 'look.json'), 'utf8')), { at: Date.UTC(2026, 9, 1, 12) });
  const later = await cli.readDigest({ mark: false, now: 0 });
  assert.ok(later.includes('CHANGED SINCE THE LAST LOOK (0): nothing'));
  assert.ok(!later.includes('(read '));
});

test('a missing MEMORY.md and missing sources still give a digest', async () => {
  rmSync(join(dirs.memory, 'MEMORY.md'));
  const d = await cli.readDigest({ mark: false, now: 0 });
  assert.ok(d.includes('NEXT BUILD'));
  assert.ok(!d.includes('ESTATE:'));
  rmSync(root, { recursive: true, force: true });
});
