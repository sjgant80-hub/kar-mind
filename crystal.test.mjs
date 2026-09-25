import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCrystal } from './crystal.mjs';

test('basic write then read round-trips byte-exact', () => {
  const c = createCrystal();
  assert.equal(c.write('greeting', 'hello', 'session-a', 100).ok, true);
  const r = c.read('greeting');
  assert.equal(r.ok, true);
  assert.equal(r.value, 'hello');
  assert.equal(r.source, 'session-a');
  assert.equal(r.ts, 100);
});

test('reading an unwritten key is a clean miss, not a throw or a guess', () => {
  const c = createCrystal();
  const r = c.read('never-written');
  assert.equal(r.ok, false);
});

// ── THE CENTERPIECE: the exact adversarial scenario the gate exists to prove. Two near-duplicate
// facts — same key, different source, different ts, different value — must never drift into each
// other. Modeled on a real case from tonight: one session eyeballed a recurrence count as 6, a
// later gated run corrected it to 7. Both are real facts CUBE must keep exactly separate.
test('NO-DRIFT: two facts under the SAME key from DIFFERENT sources never blend — each retrieved exactly, by its own source', () => {
  const c = createCrystal();
  c.write('lesson-recurrence-count', 6, 'eyeball-read-2026-09-22', 1000);
  c.write('lesson-recurrence-count', 7, 'lessonsfold-gated-2026-09-22', 2000);

  const bySourceA = c.read('lesson-recurrence-count', 'eyeball-read-2026-09-22');
  assert.equal(bySourceA.ok, true);
  assert.equal(bySourceA.value, 6);
  assert.equal(bySourceA.source, 'eyeball-read-2026-09-22');
  assert.equal(bySourceA.ts, 1000);

  const bySourceB = c.read('lesson-recurrence-count', 'lessonsfold-gated-2026-09-22');
  assert.equal(bySourceB.ok, true);
  assert.equal(bySourceB.value, 7);
  assert.equal(bySourceB.source, 'lessonsfold-gated-2026-09-22');
  assert.equal(bySourceB.ts, 2000);

  // neither read leaked the other's value — the classic drift failure would be returning 6.5,
  // or 7 when asked for A's fact specifically, or silently preferring one source over the other.
  assert.notEqual(bySourceA.value, bySourceB.value);
});

test('read() with NO source given returns the most RECENT fact for the key (by ts), not the first-written', () => {
  const c = createCrystal();
  c.write('k', 'old-value', 'src-1', 1000);
  c.write('k', 'new-value', 'src-2', 2000);
  const r = c.read('k');
  assert.equal(r.value, 'new-value');
  assert.equal(r.source, 'src-2');
});

test('EXACT TIE on ts: the LATER write wins (isolates >= from > in the winner-picking loop)', () => {
  const c = createCrystal();
  c.write('k', 'first-written', 'src-1', 5000);
  c.write('k', 'second-written', 'src-2', 5000); // identical ts, written after
  const r = c.read('k');
  assert.equal(r.value, 'second-written'); // last-write-wins on an exact tie
  assert.equal(r.source, 'src-2');
});

test('a source-filtered read also resolves ties by latest write (isolates the tie-break loop applying to the filtered candidate set too)', () => {
  const c = createCrystal();
  c.write('k', 'v1', 'same-source', 100);
  c.write('k', 'v2', 'same-source', 100); // same source, same ts, re-asserted later
  const r = c.read('k', 'same-source');
  assert.equal(r.value, 'v2');
});

test('requesting a source that never wrote to this key is a clean miss, does not fall back to another source', () => {
  const c = createCrystal();
  c.write('k', 'v', 'real-source', 1);
  const r = c.read('k', 'a-source-that-never-wrote-here');
  assert.equal(r.ok, false);
});

test('LEXICALLY SIMILAR keys are never conflated: no trimming, no case-folding, no normalization', () => {
  const c = createCrystal();
  c.write('count', 1, 'a', 1);
  c.write('Count', 2, 'a', 1);
  c.write('count ', 3, 'a', 1); // trailing space
  c.write(' count', 4, 'a', 1); // leading space
  assert.equal(c.read('count').value, 1);
  assert.equal(c.read('Count').value, 2);
  assert.equal(c.read('count ').value, 3);
  assert.equal(c.read(' count').value, 4);
  assert.equal(c.size(), 4); // four genuinely distinct keys, not merged into fewer
});

test('history() returns every fact ever written under a key, in order, unblended', () => {
  const c = createCrystal();
  c.write('k', 'v1', 's1', 10);
  c.write('k', 'v2', 's2', 20);
  const h = c.history('k');
  assert.equal(h.ok, true);
  assert.equal(h.facts.length, 2);
  assert.deepEqual(h.facts[0], { value: 'v1', source: 's1', ts: 10 });
  assert.deepEqual(h.facts[1], { value: 'v2', source: 's2', ts: 20 });
});

test('history() of an unwritten key is an empty (not missing) fact list', () => {
  const c = createCrystal();
  const h = c.history('never-touched');
  assert.equal(h.ok, true);
  assert.deepEqual(h.facts, []);
});

test('has() and size() reflect real state accurately', () => {
  const c = createCrystal();
  assert.equal(c.has('k'), false);
  assert.equal(c.size(), 0);
  c.write('k', 'v', 's', 1);
  assert.equal(c.has('k'), true);
  assert.equal(c.size(), 1);
  c.write('k2', 'v2', 's', 2);
  assert.equal(c.size(), 2);
});

test('a falsy-but-real value (0, false, empty string, null) is a valid fact — only undefined is refused', () => {
  const c = createCrystal();
  assert.equal(c.write('zero', 0, 's', 1).ok, true);
  assert.equal(c.read('zero').value, 0);
  assert.equal(c.write('falsebool', false, 's', 1).ok, true);
  assert.equal(c.read('falsebool').value, false);
  assert.equal(c.write('empty', '', 's', 1).ok, true);
  assert.equal(c.read('empty').value, '');
  assert.equal(c.write('nullval', null, 's', 1).ok, true);
  assert.equal(c.read('nullval').value, null);
  assert.equal(c.write('undef', undefined, 's', 1).ok, false); // the one refused value
});

// ── direct validation tests: assert on write()/read()/history()'s OWN return value, not a later
// read() as a proxy — a fuzz test that only checks downstream reads can't distinguish a write-side
// validation bug from a read-side one masking it, exactly what survived on the first witness run.
test('write() itself refuses a truthy NON-STRING key directly (isolates the || from becoming && on the key check)', () => {
  const c = createCrystal();
  assert.equal(c.write(123, 'v', 's', 1).ok, false);
  assert.equal(c.write({}, 'v', 's', 1).ok, false);
  assert.equal(c.write(true, 'v', 's', 1).ok, false);
});
test('write() itself refuses a truthy NON-STRING source directly', () => {
  const c = createCrystal();
  assert.equal(c.write('k', 'v', 123, 1).ok, false);
  assert.equal(c.write('k', 'v', {}, 1).ok, false);
});
test('write() itself refuses a truthy NON-NUMBER ts directly (e.g. a non-empty string)', () => {
  const c = createCrystal();
  assert.equal(c.write('k', 'v', 's', 'five').ok, false);
  assert.equal(c.write('k', 'v', 's', {}).ok, false);
});
test('write() itself refuses ts that IS type number but not finite (NaN/Infinity) — isolates the second || clause from becoming &&', () => {
  const c = createCrystal();
  assert.equal(c.write('k', 'v', 's', NaN).ok, false);
  assert.equal(c.write('k', 'v', 's', Infinity).ok, false);
  assert.equal(c.write('k', 'v', 's', -Infinity).ok, false);
});
test('read() itself refuses a truthy non-string key directly', () => {
  const c = createCrystal();
  assert.equal(c.read(123).ok, false);
  assert.equal(c.read({}).ok, false);
});
test('read() itself refuses an EMPTY STRING key — isolates the second || clause (typeof IS string, but falsy) from becoming &&', () => {
  const c = createCrystal();
  assert.equal(c.read('').ok, false);
});
test('read(key, source) itself refuses a truthy non-string source directly, once the key is valid and has data', () => {
  const c = createCrystal();
  c.write('k', 'v', 'real-source', 1);
  assert.equal(c.read('k', 123).ok, false);
  assert.equal(c.read('k', {}).ok, false);
});
test('read(key, source) itself refuses an EMPTY STRING source, once the key is valid and has data', () => {
  const c = createCrystal();
  c.write('k', 'v', 'real-source', 1);
  assert.equal(c.read('k', '').ok, false);
});
test('history() itself refuses a truthy non-string key directly', () => {
  const c = createCrystal();
  assert.equal(c.history(123).ok, false);
  assert.equal(c.history({}).ok, false);
});

test('two independently-created cubes never share state', () => {
  const a = createCrystal();
  const b = createCrystal();
  a.write('k', 'a-value', 's', 1);
  assert.equal(b.has('k'), false);
  assert.equal(b.read('k').ok, false);
});

// ── fuzz: garbage keys/values/sources/ts across every function, zero throws, zero silently-wrong facts.
test('fuzz: garbage input to write/read/history never throws, and never produces a readable fact from a rejected write', () => {
  const c = createCrystal();
  const garbage = [undefined, null, 123, true, {}, [], () => {}, Symbol('x'), NaN, Infinity, -Infinity, ''];
  for (const key of garbage) {
    for (const value of garbage) {
      for (const source of garbage) {
        for (const ts of garbage) {
          assert.doesNotThrow(() => c.write(key, value, source, ts));
          assert.doesNotThrow(() => c.read(key));
          assert.doesNotThrow(() => c.read(key, source));
          assert.doesNotThrow(() => c.history(key));
          assert.doesNotThrow(() => c.has(key));
        }
      }
    }
  }
  // none of that garbage should have produced any real, readable fact under a garbage key
  for (const key of garbage) {
    if (typeof key === 'string' && key) continue; // only non-string/empty keys are the point here
    const r = c.read(key);
    assert.equal(r.ok, false);
  }
});
