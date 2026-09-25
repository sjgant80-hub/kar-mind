import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTetra } from './tetra.mjs';

test('factory refuses bad config', () => {
  assert.throws(() => createTetra({ maxDomains: 0 }));
  assert.throws(() => createTetra({ maxDomains: -1 }));
  assert.throws(() => createTetra({ maxDomains: 1.5 }));
  assert.throws(() => createTetra({ noveltyThreshold: 0 }));
});

test('EXACT boundary: maxDomains=1 is a VALID config, does not throw -- isolates < from <= on the factory guard', () => {
  assert.doesNotThrow(() => createTetra({ maxDomains: 1 }));
});

test('a signature matching a CALLER-SUPPLIED existing domain never births', () => {
  const t = createTetra({ noveltyThreshold: 1 });
  const r = t.observe('physics', { existingDomains: ['physics', 'chemistry'] });
  assert.equal(r.ok, true);
  assert.equal(r.matched, true);
  assert.equal(r.birthed, false);
  assert.equal(t.domainCount(), 0);
});

test('a genuinely novel signature seen ONCE does not birth when threshold is 3', () => {
  const t = createTetra({ noveltyThreshold: 3 });
  const r = t.observe('quantum-biology');
  assert.equal(r.birthed, false);
  assert.equal(r.matched, false);
  assert.equal(r.pendingCount, 1);
  assert.equal(t.domainCount(), 0);
});

test('EXACT boundary: seen (threshold-1) times still does not birth -- isolates < from <=', () => {
  const t = createTetra({ noveltyThreshold: 3 });
  t.observe('quantum-biology');
  const r = t.observe('quantum-biology'); // 2nd sighting, threshold is 3
  assert.equal(r.birthed, false);
  assert.equal(r.pendingCount, 2);
  assert.equal(t.domainCount(), 0);
});

test('EXACT boundary: seen threshold times DOES birth -- isolates the boundary the other way', () => {
  const t = createTetra({ noveltyThreshold: 3 });
  t.observe('quantum-biology');
  t.observe('quantum-biology');
  const r = t.observe('quantum-biology'); // 3rd sighting, threshold met exactly
  assert.equal(r.birthed, true);
  assert.equal(r.domain, 'quantum-biology');
  assert.equal(t.domainCount(), 1);
  assert.deepEqual(t.knownDomains(), ['quantum-biology']);
});

test('once birthed, the SAME domain no longer births again -- it now matches, and membership grows', () => {
  const t = createTetra({ noveltyThreshold: 1 });
  const first = t.observe('quantum-biology');
  assert.equal(first.birthed, true);
  const second = t.observe('quantum-biology');
  assert.equal(second.birthed, false);
  assert.equal(second.matched, true);
  assert.equal(t.domainCount(), 1); // still just one domain, not a second birth
});

test('THE STRUCTURAL BOUND: birth is refused at capacity, domainCount NEVER exceeds maxDomains', () => {
  const t = createTetra({ maxDomains: 2, noveltyThreshold: 1 });
  assert.equal(t.observe('a').birthed, true);
  assert.equal(t.observe('b').birthed, true);
  assert.equal(t.domainCount(), 2);
  const refused = t.observe('c'); // a genuinely new, threshold-met signature, but the cap is full
  assert.equal(refused.birthed, false);
  assert.equal(refused.refused, 'at-capacity');
  assert.equal(t.domainCount(), 2); // THE PROOF: never exceeds the cap, by construction
  // hammer it — many more novel signatures, capacity still never breached
  for (let i = 0; i < 20; i++) t.observe('novel-' + i);
  assert.equal(t.domainCount(), 2);
});

test('two different novel signatures are tracked independently -- one\'s sightings never count toward the other', () => {
  const t = createTetra({ noveltyThreshold: 3 });
  t.observe('alpha'); t.observe('alpha');
  t.observe('beta'); // beta's first sighting, not alpha's third
  const r = t.observe('alpha'); // alpha's genuine third sighting
  assert.equal(r.birthed, true);
  assert.equal(t.domainCount(), 1);
  assert.equal(t.knownDomains()[0], 'alpha'); // beta hasn't birthed yet, only one sighting
});

test('garbage input refuses cleanly, never throws, and never births on garbage', () => {
  const t = createTetra();
  for (const bad of [undefined, null, 123, {}, [], () => {}, '']) {
    assert.doesNotThrow(() => { const r = t.observe(bad); assert.equal(r.ok, false); });
  }
  assert.doesNotThrow(() => { const r = t.observe('x', { existingDomains: 'not-an-array' }); assert.equal(r.ok, false); });
  assert.equal(t.domainCount(), 0);
});

test('a caller-supplied `now` is honestly recorded on birth -- isolates the actual value used, not just that birth happened', () => {
  const t = createTetra({ noveltyThreshold: 1 });
  t.observe('epoch-test', { now: 12345 });
  const rec = t.getDomain('epoch-test');
  assert.ok(rec);
  assert.equal(rec.createdAt, 12345); // the exact injected clock value, not Date.now()
});

test('when `now` is omitted, a real wall-clock timestamp is still recorded (the default path genuinely runs)', () => {
  const t = createTetra({ noveltyThreshold: 1 });
  const before = Date.now();
  t.observe('no-clock-given');
  const rec = t.getDomain('no-clock-given');
  assert.ok(rec.createdAt >= before);
});

test('observe(signature, null) does not throw -- isolates the `opts &&` short-circuit guard', () => {
  const t = createTetra({ noveltyThreshold: 1 });
  assert.doesNotThrow(() => t.observe('x', null));
});
