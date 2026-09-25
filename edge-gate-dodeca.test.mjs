// edge-gate-dodeca.test.mjs — THE LOAD-BEARING GATE: proves an item actually moves from crystal
// (exact facts) into DODECA (fall-remember, the real meaning organ) through the coupled pipeline —
// not the kernels in isolation, which are already separately gated (crystal: no-drift 20/22+2;
// strand: movement 33/33). Real imports throughout: the real FallRemember class, the real crystal,
// the real strand decision logic. Nothing here is simulated or mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCrystal } from './crystal.mjs';
import { FallRemember } from '../fall-remember/fall-remember.mjs';
import { promoteToDodeca } from './wire-dodeca.mjs';

test('EDGE GATE: a fresh, strong fact ACTUALLY crosses from crystal into a real FallRemember store, and is genuinely retrievable there by its own real search', () => {
  const crystal = createCrystal();
  const dodeca = new FallRemember();
  crystal.write('lesson-recurrence', 'seven independent nights converged on the same fix', 'kar-lessons-2026-09-22', Date.now());

  assert.equal(dodeca.size, 0); // nothing in the real organ yet — the honest starting state

  const result = promoteToDodeca({
    crystal, dodeca, key: 'lesson-recurrence', source: 'kar-lessons-2026-09-22',
    ageMs: 0, halfLifeMs: 100000, accessCount: 0, // fresh + no decay -> score=1 -> promotes
  });

  assert.equal(result.ok, true);
  assert.equal(result.decision, 'promote');
  assert.ok(result.dodecaRecord); // a real record came back from the real organ
  assert.equal(dodeca.size, 1); // THE REAL PROOF OF MOVEMENT: the organ's own count actually changed

  // retrieve it back out through fall-remember's OWN real cosine search — not our own bookkeeping
  const found = dodeca.retrieve('lesson-recurrence: "seven independent nights converged on the same fix" (source: kar-lessons-2026-09-22, ts: ' + result.crystalFact.ts + ')');
  assert.ok(found.center, 'fall-remember\'s own retrieve() must find a real center match');
  assert.equal(found.center.name, result.dodecaRecord.name);
  assert.equal(found.score > 0.99, true, 'querying with the exact stored text should score as a near-exact cosine match');
});

test('EDGE GATE: an old, unreinforced fact does NOT cross the edge — decays, and genuinely never appears in the real organ', () => {
  const crystal = createCrystal();
  const dodeca = new FallRemember();
  crystal.write('stale-fact', 'a fact nobody has looked at in a long time', 'some-source', Date.now() - 1_000_000);

  const result = promoteToDodeca({
    crystal, dodeca, key: 'stale-fact', source: 'some-source',
    ageMs: 1_000_000, halfLifeMs: 100000, accessCount: 0, // ten half-lives -> score ~0 -> decay, not promote
  });

  assert.equal(result.ok, true);
  assert.equal(result.decision, 'decay');
  assert.equal(result.dodecaRecord, null);
  assert.equal(dodeca.size, 0); // THE REAL PROOF OF NON-MOVEMENT: the real organ's count never changed

  const found = dodeca.retrieve('a fact nobody has looked at in a long time');
  assert.equal(found.center, null); // genuinely not there — not a stubbed "not found", the real organ has nothing
});

test('EDGE GATE: a rescued fact (heavy access pulls it back over the promote line) DOES cross, proving the movement direction reverses honestly when the inputs do', () => {
  const crystal = createCrystal();
  const dodeca = new FallRemember();
  crystal.write('rescued-fact', 'looked stale but got a burst of real attention', 'rescue-source', Date.now() - 120_000);

  // ageMs=1.2 half-lives -> decay ~0.435, alone that's a 'decay' (below FLOOR_AT=0.5)
  const stale = promoteToDodeca({ crystal, dodeca, key: 'rescued-fact', source: 'rescue-source', ageMs: 120_000, halfLifeMs: 100000, accessCount: 0 });
  assert.equal(stale.decision, 'decay');
  assert.equal(dodeca.size, 0);

  // same age, but 1000 real accesses pull reinforcement up enough that 0.435 * ~1.69 crosses 0.7
  const rescued = promoteToDodeca({ crystal, dodeca, key: 'rescued-fact', source: 'rescue-source', ageMs: 120_000, halfLifeMs: 100000, accessCount: 1000 });
  assert.equal(rescued.decision, 'promote');
  assert.equal(dodeca.size, 1); // it genuinely moved this time, once the real inputs justified it
});

test('EDGE GATE: multiple crystal facts promoted in sequence all genuinely accumulate in the real organ (no silent overwrite across the wire)', () => {
  const crystal = createCrystal();
  const dodeca = new FallRemember();
  crystal.write('fact-a', 'the first real fact', 'src-a', Date.now());
  crystal.write('fact-b', 'a second, different real fact', 'src-b', Date.now());

  promoteToDodeca({ crystal, dodeca, key: 'fact-a', source: 'src-a', ageMs: 0, halfLifeMs: 100000, accessCount: 0 });
  promoteToDodeca({ crystal, dodeca, key: 'fact-b', source: 'src-b', ageMs: 0, halfLifeMs: 100000, accessCount: 0 });

  assert.equal(dodeca.size, 2); // both genuinely present, real organ count proves it
});

test('EDGE GATE: garbage/missing inputs refuse cleanly, and never write to the real organ on a refusal', () => {
  const crystal = createCrystal();
  const dodeca = new FallRemember();
  crystal.write('k', 'v', 's', Date.now());

  assert.equal(promoteToDodeca({ crystal: null, dodeca, key: 'k', source: 's', ageMs: 0, halfLifeMs: 1, accessCount: 0 }).ok, false);
  assert.equal(promoteToDodeca({ crystal, dodeca: null, key: 'k', source: 's', ageMs: 0, halfLifeMs: 1, accessCount: 0 }).ok, false);
  assert.equal(promoteToDodeca({ crystal, dodeca, key: 'does-not-exist', source: 's', ageMs: 0, halfLifeMs: 1, accessCount: 0 }).ok, false);
  assert.equal(promoteToDodeca({ crystal, dodeca, key: 'k', source: 'wrong-source', ageMs: 0, halfLifeMs: 1, accessCount: 0 }).ok, false);
  assert.equal(dodeca.size, 0); // not one bad call left a trace in the real organ
});
