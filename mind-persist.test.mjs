// mind-persist.test.mjs — THE HEADLINE PROOF: the mind survives a real restart, AND runs autonomously
// while it does. Built state → persisted to a real durable file each tick by the mind's own loop →
// reloaded into a brand-new mind object from disk with every organ's OWN count intact. This is the
// the durable-memory kernel proof shape (build → persist → the live organs are gone → reload → intact)
// applied to the whole cognitive stack. Nothing mocked: real journal, real gzip, real organs, real files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootMind, runAutonomous, persistMind } from './mind-persistent.mjs';
import { queueSource } from './run-loop.mjs';

const birdEpisodes = () => [
  { s: 'robin', p: 'isa', o: 'bird' }, { s: 'sparrow', p: 'isa', o: 'bird' },
  { s: 'robin', p: 'can', o: 'fly' }, { s: 'sparrow', p: 'can', o: 'fly' },
];

test('PERSISTENT + AUTONOMOUS: a cold mind builds state through its own loop, persists itself each tick, then a real restart reloads every organ count intact from disk', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mind-boot-'));
  try {
    // ── boot 1: cold start ──
    const b1 = await bootMind({ dir, tetraConfig: { noveltyThreshold: 2 } });
    assert.equal(b1.ok, true);
    assert.equal(b1.restoredFrom, null, 'cold start: nothing on disk to restore yet');
    assert.deepEqual(b1.snapshot, { crystalFacts: 0, dodecaMemories: 0, dreamFacts: 0, bornDomains: 0, shelves: ['crystal', 'octa', 'dodeca', 'icosa'] });

    // ── the mind runs its OWN loop and persists itself, no caller per step ──
    const source = queueSource([
      { kind: 'fact', fact: { key: 'lesson', value: 'seven nights converged', source: 'kar' }, recall: { ageMs: 0, halfLifeMs: 100000, accessCount: 3 } },
      { kind: 'episodes', episodes: birdEpisodes(), day: 1, source: 'dream' },
      { kind: 'signal', signal: 'domain-x' },
      { kind: 'signal', signal: 'domain-x' },
    ]);
    const run = await runAutonomous({ mind: b1.mind, journal: b1.journal, source, maxTicks: 20 });
    assert.equal(run.ok, true);
    assert.equal(run.persistedEveryActedTick, true, 'the mind persisted itself on its own cadence, every acted tick');
    const live = b1.mind.snapshot();
    assert.ok(live.crystalFacts >= 2 && live.dodecaMemories >= 1 && live.dreamFacts >= 1 && live.bornDomains === 1, 'real state was built: ' + JSON.stringify(live));

    // ── THE RESTART: a brand-new mind object, same dir, nothing shared in memory ──
    const b2 = await bootMind({ dir, tetraConfig: { noveltyThreshold: 2 } });
    assert.equal(b2.ok, true);
    assert.equal(b2.restoredFrom, b1.journal.path, 'it genuinely restored from the durable file on disk');
    assert.ok(b2.replayed >= 4, 'it replayed the real event log');
    // THE PROOF: every organ's OWN count matches the pre-restart live mind
    assert.deepEqual(b2.mind.snapshot(), live, 'state intact across a real restart — checked against each organ\'s own count');

    // and it is genuinely usable, not frozen: it keeps journaling from where it left off
    b2.mind.perceive({ key: 'after-restart', value: 'still alive', source: 'kar' });
    assert.equal(b2.mind.snapshot().crystalFacts, live.crystalFacts + 1, 'the restored mind is live, not a read-only snapshot');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('PERSISTENCE is real, not cosmetic: a wiped journal boots to a genuinely empty mind (the durable file, not memory, is the source of truth)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mind-boot-'));
  try {
    const b1 = await bootMind({ dir });
    b1.mind.perceive({ key: 'k', value: 'v', source: 's' });
    assert.equal((await persistMind(b1.journal, b1.mind)).ok, true);
    assert.equal((await bootMind({ dir })).mind.snapshot().crystalFacts, 1, 'the fact survived one restart');
    b1.journal.wipe(); // a REAL wipe of the durable file
    assert.equal((await bootMind({ dir })).mind.snapshot().crystalFacts, 0, 'after a real wipe the mind boots empty — proof it reloads from disk, not from a lingering object');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('boot refuses a bad dir cleanly (never throws out of the async boot path)', async () => {
  const roots = mkdtempSync(join(tmpdir(), 'mind-root-'));
  try {
    const bad = await bootMind({ dir: join(tmpdir(), 'escape-' + Date.now()), roots: [roots] });
    assert.equal(bad.ok, false, 'a walled-off dir returns {ok:false}, not an uncaught throw');
  } finally { rmSync(roots, { recursive: true, force: true }); }
});
