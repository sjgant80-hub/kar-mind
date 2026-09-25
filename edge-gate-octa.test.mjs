// edge-gate-octa.test.mjs — proves real interaction against Veridia's own real adjudicate() logic:
// a consistent multi-source fact passes, a genuine contradiction gets caught and escalated (not
// silently accepted), a non-independent panel is refused by Veridia's own rule. Nothing mocked: the
// real crystal.mjs and the real fallforgecell/kernel.mjs throughout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCrystal } from './crystal.mjs';
import { verifyBeforePromote } from './wire-octa.mjs';

test('EDGE GATE: three independent sources agreeing -> Veridia\'s own adjudicate() returns UNANIMOUS and accepts the value', () => {
  const crystal = createCrystal();
  crystal.write('lesson-count', 7, 'kar-eyeball-read', Date.now());
  crystal.write('lesson-count', 7, 'lessonsfold-gated', Date.now());
  crystal.write('lesson-count', 7, 'peer-cross-check', Date.now());

  const result = verifyBeforePromote({ crystal, key: 'lesson-count' });
  assert.equal(result.ok, true);
  // THE REAL PROOF: Veridia's OWN verdict object, its own field-by-field adjudication, untouched
  assert.equal(result.verdict.verdict, 'UNANIMOUS');
  assert.equal(result.verdict.independent, true);
  assert.equal(result.verdict.accepted.value, 7);
  assert.deepEqual(result.verdict.escalate, []);
});

test('EDGE GATE: a genuine CONTRADICTION (three independent sources, no majority) is CAUGHT -- Veridia escalates, does not silently accept a value', () => {
  const crystal = createCrystal();
  crystal.write('recurrence-count', 6, 'source-a', Date.now());
  crystal.write('recurrence-count', 7, 'source-b', Date.now());
  crystal.write('recurrence-count', 8, 'source-c', Date.now());

  const result = verifyBeforePromote({ crystal, key: 'recurrence-count' });
  assert.equal(result.ok, true);
  assert.equal(result.verdict.verdict, 'SPLIT'); // Veridia's own real disagreement verdict
  assert.deepEqual(result.verdict.escalate, ['value']); // the contested field, named for human review
  assert.deepEqual(result.verdict.accepted, {}); // THE REAL CATCH: nothing was silently accepted
});

test('EDGE GATE: two-of-three agreement -> Veridia\'s own MAJORITY verdict, the dissenting source recorded not hidden', () => {
  const crystal = createCrystal();
  crystal.write('status', 'green', 'monitor-a', Date.now());
  crystal.write('status', 'green', 'monitor-b', Date.now());
  crystal.write('status', 'red', 'monitor-c', Date.now());

  const result = verifyBeforePromote({ crystal, key: 'status' });
  assert.equal(result.verdict.verdict, 'MAJORITY');
  assert.equal(result.verdict.accepted.value, 'green');
  assert.deepEqual(result.verdict.escalate, []);
});

test('EDGE GATE: a NON-INDEPENDENT panel (the same source claiming three times) is REFUSED by Veridia\'s own rule -- agreement among identical sources proves nothing', () => {
  const crystal = createCrystal();
  // same conceptual "source" asserting three times under slightly different labels would still be
  // independent in crystal's terms (different strings) -- to genuinely test Veridia's OWN
  // independence refusal we must feed it literally duplicate fingerprints, which only happens if
  // crystal's history legitimately contains a repeated source string. write() itself allows a source
  // to write to the same key more than once (re-asserting), so a real duplicate-source history is
  // itself a real, reachable case.
  crystal.write('duplicate-test', 'x', 'same-source', 1);
  crystal.write('duplicate-test', 'x', 'same-source', 2); // same source, re-asserting -- still only ONE real vote
  crystal.write('duplicate-test', 'x', 'same-source', 3);

  const result = verifyBeforePromote({ crystal, key: 'duplicate-test' });
  assert.equal(result.ok, true);
  assert.equal(result.verdict.independent, false); // Veridia's own real refusal, not ours
  assert.equal(result.verdict.verdict, 'REFUSED');
  assert.deepEqual(result.verdict.accepted, {});
});

test('EDGE GATE: fewer than 3 independent sources refuses cleanly before ever reaching Veridia', () => {
  const crystal = createCrystal();
  crystal.write('too-thin', 'v', 'only-source', Date.now());
  const result = verifyBeforePromote({ crystal, key: 'too-thin' });
  assert.equal(result.ok, false);
});

test('EDGE GATE: garbage/missing inputs refuse cleanly', () => {
  const crystal = createCrystal();
  assert.equal(verifyBeforePromote({ crystal: null, key: 'x' }).ok, false);
  assert.equal(verifyBeforePromote({ crystal, key: '' }).ok, false);
  assert.equal(verifyBeforePromote({ crystal, key: 'never-written' }).ok, false);
});
