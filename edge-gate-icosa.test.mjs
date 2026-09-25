// edge-gate-icosa.test.mjs — proves the-dreamer's OWN state genuinely changes (a real dream cycle,
// real generalization) and that the loop genuinely closes back into a real crystal instance. Nothing
// mocked: real dreamer.mjs, real strand.mjs, real crystal.mjs throughout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyStore } from '../the-dreamer/dreamer.mjs';
import { createCrystal } from './crystal.mjs';
import { dreamAndPromote } from './wire-icosa.mjs';

test('EDGE GATE: a real dream cycle GENUINELY generates a new fact (the-dreamer\'s own state changes), and the loop closes into a real crystal', () => {
  const store = emptyStore();
  const crystal = createCrystal();
  assert.equal(store.facts.size, 0); // the real organ's own starting state

  const episodes = [
    { s: 'robin', p: 'isa', o: 'bird' },
    { s: 'sparrow', p: 'isa', o: 'bird' },
    { s: 'robin', p: 'can', o: 'fly' },
    { s: 'sparrow', p: 'can', o: 'fly' },
  ];
  const result = dreamAndPromote({ store, crystal, episodes, day: 1, minInstances: 2, source: 'kar-icosa-test' });

  assert.equal(result.ok, true);
  // THE REAL PROOF OF GENERATION: the-dreamer's OWN report and OWN store, independently observed
  // (checked by field values, not by guessing their internal, separator-less key() format)
  assert.ok(result.report.generalized >= 1, 'the-dreamer must have genuinely generalized at least one new rule');
  const generatedFact = [...store.facts.values()].find((f) => f.s === 'bird' && f.p === 'can' && f.o === 'fly');
  assert.ok(generatedFact, 'the new generated fact must genuinely exist in the-dreamer\'s own facts map');
  assert.equal(generatedFact.inferred, true);
  assert.ok(generatedFact.conf > 0);

  // THE REAL PROOF OF LOOP CLOSURE: crystal's own state, independently observed
  assert.ok(result.promotedCount >= 1, 'at least the high-confidence generalization must have promoted');
  const crystalFact = crystal.read('bird|can|fly', 'kar-icosa-test');
  assert.equal(crystalFact.ok, true, 'the generated fact must be genuinely retrievable from crystal\'s own read()');
  assert.equal(crystalFact.value, 'fly');
});

test('EDGE GATE: NO generalization support -> the-dreamer genuinely generates nothing, and nothing crosses into crystal', () => {
  const store = emptyStore();
  const crystal = createCrystal();
  // only ONE bird can fly -- below minInstances=2, dreamCycle's own logic must not generalize
  const episodes = [
    { s: 'robin', p: 'isa', o: 'bird' },
    { s: 'robin', p: 'can', o: 'fly' },
  ];
  const result = dreamAndPromote({ store, crystal, episodes, day: 1, minInstances: 2, source: 'kar-icosa-test' });

  assert.equal(result.ok, true);
  assert.equal(result.generatedCount, 0); // the-dreamer's own report says it did not generalize
  assert.equal(result.promotedCount, 0);
  assert.equal(crystal.has('bird|can|fly'), false); // genuinely never crossed
});

test('EDGE GATE: a specific counter-fact (penguin cannot fly) is honestly respected by the-dreamer\'s own logic -- the class rule still generates for the real fliers, but never overrides the specific denial', () => {
  const store = emptyStore();
  const crystal = createCrystal();
  const episodes = [
    { s: 'robin', p: 'isa', o: 'bird' }, { s: 'sparrow', p: 'isa', o: 'bird' }, { s: 'penguin', p: 'isa', o: 'bird' },
    { s: 'robin', p: 'can', o: 'fly' }, { s: 'sparrow', p: 'can', o: 'fly' },
    { s: 'penguin', p: 'cannot', o: 'fly' }, // explicit denial, the-dreamer's own NEG vocabulary
  ];
  const result = dreamAndPromote({ store, crystal, episodes, day: 1, minInstances: 2, source: 'kar-icosa-test' });
  assert.ok(result.generatedCount >= 1); // bird can fly still generalizes from 2 real supporters
  const denial = [...store.facts.values()].find((f) => f.s === 'penguin' && f.p === 'cannot' && f.o === 'fly');
  assert.ok(denial, 'the specific fact must survive untouched in the-dreamer\'s own store');
});

test('EDGE GATE: a second real dream cycle (day 2) genuinely accumulates on the SAME store -- state truly persists and grows, not reset', () => {
  const store = emptyStore();
  const crystal = createCrystal();
  dreamAndPromote({ store, crystal, episodes: [{ s: 'robin', p: 'isa', o: 'bird' }, { s: 'sparrow', p: 'isa', o: 'bird' }, { s: 'robin', p: 'can', o: 'fly' }, { s: 'sparrow', p: 'can', o: 'fly' }], day: 1, minInstances: 2, source: 'day1' });
  const factsAfterDay1 = store.facts.size;
  dreamAndPromote({ store, crystal, episodes: [{ s: 'trout', p: 'isa', o: 'fish' }, { s: 'salmon', p: 'isa', o: 'fish' }, { s: 'trout', p: 'lives', o: 'water' }, { s: 'salmon', p: 'lives', o: 'water' }], day: 2, minInstances: 2, source: 'day2' });
  assert.ok(store.facts.size > factsAfterDay1, 'the real store must have genuinely grown across two real cycles');
  assert.equal(crystal.has('fish|lives|water'), true);
  assert.equal(crystal.has('bird|can|fly'), true); // day 1's promotion is still there too -- nothing got wiped
});

test('EDGE GATE: garbage/missing inputs refuse cleanly, and leave both real organs untouched', () => {
  const store = emptyStore();
  const crystal = createCrystal();
  assert.equal(dreamAndPromote({ store, crystal: null, episodes: [], day: 1, source: 'x' }).ok, false);
  assert.equal(dreamAndPromote({ store, crystal, episodes: [], day: 1, source: '' }).ok, false);
  assert.equal(dreamAndPromote({ store, crystal, episodes: 'not-an-array', day: 1, source: 'x' }).ok, false);
  assert.equal(store.facts.size, 0);
  assert.equal(crystal.size(), 0);
});
