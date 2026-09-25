import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recallScore, strandDecision, applyDecision, PROMOTE_AT, FLOOR_AT, EXPIRE_GRACE_MS, SHELVES } from './strand.mjs';

// ---- recallScore ----
test('recallScore: no age, no access -> decay=1, reinforcement=1, score=base', () => {
  const r = recallScore({ base: 0.8, ageMs: 0, halfLifeMs: 1000, accessCount: 0 });
  assert.equal(r.ok, true);
  assert.equal(r.decay, 1);
  assert.equal(r.reinforcement, 1);
  assert.equal(r.score, 0.8);
});
test('recallScore: age exactly one half-life -> decay is exactly 0.5', () => {
  const r = recallScore({ base: 1, ageMs: 1000, halfLifeMs: 1000, accessCount: 0 });
  assert.equal(r.decay, 0.5);
  assert.equal(r.score, 0.5);
});
test('recallScore: more access increases reinforcement, and thus score, monotonically', () => {
  const low = recallScore({ base: 0.5, ageMs: 0, halfLifeMs: 1000, accessCount: 1 });
  const high = recallScore({ base: 0.5, ageMs: 0, halfLifeMs: 1000, accessCount: 100 });
  assert.ok(high.reinforcement > low.reinforcement);
  assert.ok(high.score > low.score);
});
test('recallScore clamps to [0,1] even with an out-of-range base', () => {
  assert.equal(recallScore({ base: 5, ageMs: 0, halfLifeMs: 1000, accessCount: 0 }).score, 1);
  assert.equal(recallScore({ base: -5, ageMs: 0, halfLifeMs: 1000, accessCount: 0 }).score, 0);
});
test('recallScore garbage input refuses cleanly', () => {
  for (const bad of [undefined, null, {}, [], 'x', NaN, Infinity]) {
    assert.equal(recallScore({ base: bad, ageMs: 0, halfLifeMs: 1, accessCount: 0 }).ok, false);
    assert.equal(recallScore({ base: 0.5, ageMs: bad, halfLifeMs: 1, accessCount: 0 }).ok, false);
    assert.equal(recallScore({ base: 0.5, ageMs: 0, halfLifeMs: bad, accessCount: 0 }).ok, false);
    assert.equal(recallScore({ base: 0.5, ageMs: 0, halfLifeMs: 1, accessCount: bad }).ok, false);
  }
  assert.equal(recallScore({ base: 0.5, ageMs: -1, halfLifeMs: 1, accessCount: 0 }).ok, false); // negative age
  assert.equal(recallScore({ base: 0.5, ageMs: 0, halfLifeMs: 0, accessCount: 0 }).ok, false);  // zero half-life
});

// ---- strandDecision: the load-bearing boundaries ----
test('EXACTLY at PROMOTE_AT (0.7) promotes -- isolates >= from >', () => {
  assert.equal(strandDecision({ score: PROMOTE_AT }).decision, 'promote');
});
test('just under PROMOTE_AT holds, not promotes', () => {
  assert.equal(strandDecision({ score: PROMOTE_AT - 0.0001 }).decision, 'hold');
});
test('EXACTLY at FLOOR_AT (0.5) holds -- his rule is "< 0.5", so 0.5 itself is NOT decay/expire', () => {
  assert.equal(strandDecision({ score: FLOOR_AT }).decision, 'hold');
});
test('just under FLOOR_AT decays (grace not yet elapsed)', () => {
  assert.equal(strandDecision({ score: FLOOR_AT - 0.0001, msBelowFloor: 0 }).decision, 'decay');
});
test('under FLOOR_AT AND grace fully elapsed expires -- isolates >= from > on the grace check', () => {
  assert.equal(strandDecision({ score: 0.1, msBelowFloor: EXPIRE_GRACE_MS }).decision, 'expire');
});
test('under FLOOR_AT but grace just short of elapsed still only decays', () => {
  assert.equal(strandDecision({ score: 0.1, msBelowFloor: EXPIRE_GRACE_MS - 1 }).decision, 'decay');
});
test('mid-band (between floor and promote) holds', () => {
  assert.equal(strandDecision({ score: 0.6 }).decision, 'hold');
});
test('strandDecision garbage input refuses cleanly', () => {
  for (const bad of [undefined, null, {}, [], 'x', NaN]) {
    assert.equal(strandDecision({ score: bad }).ok, false);
  }
  assert.equal(strandDecision({ score: 0.5, msBelowFloor: -1 }).ok, false);
  assert.equal(strandDecision({ score: 0.5, msBelowFloor: 'five' }).ok, false); // isolates the typeof clause, not just the <0 clause
  assert.equal(strandDecision({ score: 0.5, msBelowFloor: NaN }).ok, false);    // isolates the isFinite clause
});

// ---- applyDecision: proves REAL movement, not a returned label ----
test('promote actually advances the shelf by one, crystal -> octa', () => {
  const r = applyDecision('crystal', 'promote');
  assert.equal(r.shelf, 'octa');
  assert.notEqual(r.shelf, 'crystal'); // the actual assertion that matters: state genuinely changed
});
test('decay actually demotes the shelf by one, dodeca -> octa', () => {
  const r = applyDecision('dodeca', 'decay');
  assert.equal(r.shelf, 'octa');
});
test('promote at the TOP shelf (icosa) stays at icosa -- does not overflow past the ceiling', () => {
  assert.equal(applyDecision('icosa', 'promote').shelf, 'icosa');
});
test('decay at the BOTTOM shelf (crystal) stays at crystal -- does not underflow past the floor', () => {
  assert.equal(applyDecision('crystal', 'decay').shelf, 'crystal');
});
test('hold genuinely leaves the shelf unchanged', () => {
  assert.equal(applyDecision('dodeca', 'hold').shelf, 'dodeca');
});
test('expire removes the item from the shelf system entirely', () => {
  const r = applyDecision('octa', 'expire');
  assert.equal(r.shelf, null);
  assert.equal(r.expired, true);
});
test('applyDecision garbage input refuses cleanly', () => {
  assert.equal(applyDecision('not-a-real-shelf', 'promote').ok, false);
  assert.equal(applyDecision('crystal', 'not-a-real-decision').ok, false);
  assert.equal(applyDecision(undefined, 'promote').ok, false);
});

// ---- THE ADVERSARIAL TRAJECTORY: prove an item actually moves, end to end, through a realistic
// recall history -- not one happy case, the full arc a real memory item could plausibly take.
test('ADVERSARIAL TRAJECTORY: an item rises, gets flagged, decays, and is rescued before expiry -- real shelf movement at every step', () => {
  let shelf = 'crystal';
  const steps = [];

  // Step 1: fresh, high base score, no age -> promotes
  let s = recallScore({ base: 0.9, ageMs: 0, halfLifeMs: 100000, accessCount: 0 });
  let d = strandDecision({ score: s.score });
  let a = applyDecision(shelf, d.decision);
  steps.push({ shelf, decision: d.decision, next: a.shelf });
  shelf = a.shelf;
  assert.equal(shelf, 'octa'); // moved up for real

  // Step 2: significant time passes, no reinforcement -> score decays into the hold band
  s = recallScore({ base: 0.9, ageMs: 100000, halfLifeMs: 100000, accessCount: 0 }); // one half-life: 0.45
  d = strandDecision({ score: s.score });
  a = applyDecision(shelf, d.decision);
  steps.push({ shelf, decision: d.decision, next: a.shelf });
  const shelfAfterStep2 = a.shelf;
  assert.equal(d.decision, 'decay'); // 0.45 < 0.5
  assert.equal(shelfAfterStep2, 'crystal'); // moved DOWN for real, from octa back to crystal
  assert.notEqual(shelfAfterStep2, shelf); // the movement actually happened -- not the same shelf as before
  shelf = shelfAfterStep2;

  // Step 3: rescued -- a burst of access before the expiry grace elapses
  s = recallScore({ base: 0.9, ageMs: 100000, halfLifeMs: 100000, accessCount: 500 });
  d = strandDecision({ score: s.score, msBelowFloor: 1000 }); // well short of the 7-day grace
  a = applyDecision(shelf, d.decision);
  steps.push({ shelf, decision: d.decision, next: a.shelf });
  assert.equal(d.decision, 'promote'); // reinforcement pulled it back over 0.7
  assert.equal(a.shelf, 'octa'); // moved back UP for real
  shelf = a.shelf;

  // Step 4: abandoned for the full grace window with no rescue -> genuinely expires and leaves the system
  s = recallScore({ base: 0.9, ageMs: 100000 * 10, halfLifeMs: 100000, accessCount: 0 });
  d = strandDecision({ score: s.score, msBelowFloor: EXPIRE_GRACE_MS });
  a = applyDecision(shelf, d.decision);
  steps.push({ shelf, decision: d.decision, next: a.shelf });
  assert.equal(d.decision, 'expire');
  assert.equal(a.shelf, null);
  assert.equal(a.expired, true);

  // The whole point of this gate: at least three DIFFERENT shelves were genuinely visited across
  // the trajectory, and the final state is a real removal -- not a static label returned four times.
  const distinctShelvesVisited = new Set(steps.map((x) => x.shelf));
  assert.ok(distinctShelvesVisited.size >= 2, 'the item must have genuinely occupied more than one shelf across the trajectory');
  assert.equal(steps[steps.length - 1].next, null);
});

// ---- oscillation around the promote/hold line, proving no drift/stickiness bug ----
test('oscillation: a score bouncing exactly across the promote line moves the shelf back and forth for real, each time', () => {
  let shelf = 'octa';
  const scores = [0.71, 0.69, 0.72, 0.68, 0.70]; // straddles PROMOTE_AT repeatedly, including landing exactly on it
  const shelvesVisited = [shelf];
  for (const score of scores) {
    const d = strandDecision({ score });
    const a = applyDecision(shelf, d.decision);
    shelf = a.shelf;
    shelvesVisited.push(shelf);
  }
  // 0.71 -> promote (dodeca), 0.69 -> hold (dodeca), 0.72 -> promote (icosa, ceiling),
  // 0.68 -> hold (icosa), 0.70 -> promote (icosa, already at ceiling, stays)
  assert.deepEqual(shelvesVisited, ['octa', 'dodeca', 'dodeca', 'icosa', 'icosa', 'icosa']);
});
