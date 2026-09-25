// run-loop.test.mjs — gates AUTONOMY and its safety wall. Proves: from one run() call the loop drives
// many cascades on its own and moves real organ state; a dry source stops it loudly (no spin); and —
// the load-bearing safety property — a full autonomous run cannot reach the export door, so nothing
// irreversible leaves the machine unattended. Nothing mocked: a real mind, real organs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRunLoop, queueSource } from './run-loop.mjs';
import { createMind } from './mind.mjs';

const birdEpisodes = () => [
  { s: 'robin', p: 'isa', o: 'bird' }, { s: 'sparrow', p: 'isa', o: 'bird' },
  { s: 'robin', p: 'can', o: 'fly' }, { s: 'sparrow', p: 'can', o: 'fly' },
];

test('AUTONOMY: from ONE run() call the loop drives many cascades on its own and genuinely moves real organ state', () => {
  const mind = createMind({ tetraConfig: { noveltyThreshold: 2 } });
  const source = queueSource([
    { kind: 'fact', fact: { key: 'a', value: 1, source: 's1' }, recall: { ageMs: 0, halfLifeMs: 100000, accessCount: 0 } },
    { kind: 'fact', fact: { key: 'b', value: 2, source: 's2' } },
    { kind: 'episodes', episodes: birdEpisodes(), day: 1, source: 'loop' },
    { kind: 'signal', signal: 'new-domain' },
    { kind: 'signal', signal: 'new-domain' },
  ]);
  const loop = createRunLoop({ mind, source, now: () => 1000 });
  const out = loop.run({ maxTicks: 50 });
  assert.equal(out.ok, true);
  assert.equal(out.stopped, 'source-dry', 'it ran until its own work was spent, then stopped');
  assert.equal(out.ticksActed, 5);
  assert.ok(out.delta.crystalFacts >= 2, 'facts genuinely entered ground truth on the loop\'s own drive');
  assert.ok(out.delta.dodecaMemories >= 2, 'strong facts consolidated into the real meaning organ on their own');
  assert.ok(out.delta.dreamFacts >= 1, 'a dream cycle ran on its own');
  assert.equal(out.delta.bornDomains, 1, 'a new domain was born by the loop itself');
});

test('AUTONOMY: a dry source stops the loop immediately (dead air, not a 50-tick spin)', () => {
  const mind = createMind();
  const loop = createRunLoop({ mind, source: queueSource([]), now: () => 0 });
  const out = loop.run({ maxTicks: 50 });
  assert.equal(out.ticksActed, 0);
  assert.equal(out.stopped, 'source-dry');
  assert.equal(out.steps.length, 1, 'one dry pull and it stopped — it did not run 50 empty ticks');
});

test('SAFETY (the wall that is not a hedge): a full autonomous run touches NO irreversible outside-world action — the export door stays shut and no file is written, even with a root available', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'mind-loop-'));
  try {
    const mind = createMind({ exportRoots: [tmp], tetraConfig: { noveltyThreshold: 1 } });
    const source = queueSource([
      { kind: 'fact', fact: { key: 'a', value: 1, source: 's' } },
      { kind: 'episodes', episodes: birdEpisodes(), day: 1, source: 'loop' },
      { kind: 'signal', signal: 'd' },
    ]);
    const loop = createRunLoop({ mind, source, now: () => 0 });
    const out = loop.run({ maxTicks: 20 });
    assert.ok(out.ticksActed >= 3, 'the loop did real cognitive work');
    assert.equal(mind.pendingExport(), null, 'it never even STAGED an export');
    assert.equal(readdirSync(tmp).length, 0, 'and wrote nothing to the export root — publish/spend are unreachable from the loop by construction');
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('AUTONOMY caps: maxTicks is an honest cap — 1 tick runs, and a cap below the source count stops at the cap (not off-by-one)', () => {
  const mind = createMind();
  const one = createRunLoop({ mind, source: queueSource([{ kind: 'fact', fact: { key: 'a', value: 1, source: 's' } }]) }).run({ maxTicks: 1 });
  assert.equal(one.ok, true);
  assert.equal(one.ticksActed, 1, 'maxTicks:1 genuinely runs one tick — the boundary is inclusive of 1');

  const capped = createRunLoop({ mind: createMind(), source: queueSource([
    { kind: 'fact', fact: { key: 'a', value: 1, source: 's' } },
    { kind: 'fact', fact: { key: 'b', value: 2, source: 's' } },
    { kind: 'fact', fact: { key: 'c', value: 3, source: 's' } },
  ]) }).run({ maxTicks: 2 });
  assert.equal(capped.ticksActed, 2, 'a cap of 2 over a 3-item source runs exactly 2 — no extra iteration');
  assert.equal(capped.stopped, 'max-ticks');
});

test('run-loop episodes stimulus: minInstances and source genuinely flow into dream, and the receipt reports the REAL generated/promoted counts (not zeroed)', () => {
  // a high minInstances genuinely reaches dream and suppresses generalization (2 supporters < 5)
  const t1 = createRunLoop({ mind: createMind(), source: queueSource([{ kind: 'episodes', episodes: birdEpisodes(), day: 1, minInstances: 5, source: 'x' }]) }).tick();
  assert.equal(t1.generated, 0, 'minInstances:5 genuinely reached the real dream cycle');
  // a normal dream: the stimulus source reaches crystal, and the real counts are reported
  const m2 = createMind();
  const t2 = createRunLoop({ mind: m2, source: queueSource([{ kind: 'episodes', episodes: birdEpisodes(), day: 1, source: 'my-source' }]) }).tick();
  assert.ok(t2.generated >= 1, 'the receipt reports the REAL generated count, not a zeroed default');
  assert.ok(t2.promoted >= 1, 'the receipt reports the REAL promoted count');
  assert.equal(m2._crystal.read('bird|can|fly', 'my-source').ok, true, 'the stimulus source genuinely reached the crystal write');
});

test('run-loop fact stimulus honors a decay recall: a fact the caller marks stale does NOT get consolidated into the real organ', () => {
  const mind = createMind();
  const loop = createRunLoop({ mind, source: queueSource([
    { kind: 'fact', fact: { key: 'stale', value: 'v', source: 's' }, recall: { ageMs: 10_000_000, halfLifeMs: 100000, accessCount: 0 } },
  ]) });
  loop.tick();
  assert.equal(mind.snapshot().dodecaMemories, 0, 'the provided decay recall genuinely reached consolidate — nothing crossed into the meaning organ');
  assert.equal(mind.snapshot().crystalFacts, 1, 'but the fact was still perceived into ground truth');
});

test('run-loop refuses bad construction and bad stimuli cleanly (total, never throws mid-run)', () => {
  const mind = createMind();
  assert.throws(() => createRunLoop({ mind: {}, source: queueSource([]) }), /live mind/, 'a mind lacking think() is refused for the right reason');
  assert.throws(() => createRunLoop({ mind, source: {} }), /source/, 'a source lacking next() is refused for the right reason');
  assert.throws(() => createRunLoop({ mind, source: queueSource([]), now: 5 }), 'a non-function clock → throws');
  assert.equal(createRunLoop({ mind, source: queueSource([{ foo: 1 }]) }).tick().why.includes('object with a string kind'), true, 'a stimulus with no kind is refused with the shape error, not treated as an unknown kind');
  const loop = createRunLoop({ mind, source: queueSource([{ kind: 'nope' }]) });
  assert.equal(loop.tick().ok, false, 'an unknown stimulus kind refuses, does not throw');
  assert.equal(loop.run({ maxTicks: 0 }).ok, false, 'a bad maxTicks refuses');
});
