import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './breach-harness.mjs';

function capture() { const lines = []; return { log: (s) => lines.push(s), lines }; }

test('createHarness requires a label', () => {
  assert.throws(() => createHarness({}));
  assert.throws(() => createHarness());
  assert.throws(() => createHarness({ label: '' }));
});

test('check(desc, true) counts a pass and prints PASS', () => {
  const c = capture();
  const h = createHarness({ label: 'X', log: c.log });
  const ok = h.check('thing works', true);
  assert.equal(ok, true);
  assert.equal(h.counts().pass, 1);
  assert.equal(h.counts().fail, 0);
  assert.ok(c.lines[0].startsWith('PASS'));
});

test('check with NO detail argument omits the arrow entirely — exact line, isolates detail===undefined from !==', () => {
  const c = capture();
  const h = createHarness({ label: 'X', log: c.log });
  h.check('plain check, no detail', true);
  assert.equal(c.lines[0], 'PASS  plain check, no detail');
});

test('check(desc, false) counts a fail and prints *** FAIL ***', () => {
  const c = capture();
  const h = createHarness({ label: 'X', log: c.log });
  const ok = h.check('thing broke', false);
  assert.equal(ok, false);
  assert.equal(h.counts().fail, 1);
  assert.ok(c.lines[0].includes('*** FAIL ***'));
});

test('check coerces a truthy non-boolean cond to a pass (isolates !!cond, not ===true)', () => {
  const h = createHarness({ label: 'X' });
  assert.equal(h.check('truthy', 1), true);
  assert.equal(h.check('truthy-string', 'yes'), true);
  assert.equal(h.counts().pass, 2);
});

test('checkResult derives the boolean from a {ok} result object matched against wantOk', () => {
  const h = createHarness({ label: 'X' });
  assert.equal(h.checkResult('refused as expected', { ok: false, why: 'no' }, false), true);
  assert.equal(h.checkResult('allowed as expected', { ok: true }, true), true);
  assert.equal(h.counts().pass, 2);
});

test('checkResult: got.ok does not match wantOk -> fails', () => {
  const h = createHarness({ label: 'X' });
  assert.equal(h.checkResult('should have refused', { ok: true }, false), false);
  assert.equal(h.counts().fail, 1);
});

test('checkResult with a null/undefined got (a crashed call) never throws, and is strict: null is not the boolean false', () => {
  const h = createHarness({ label: 'X' });
  // (null && got.ok===true) evaluates to null, not false — and null !== false under strict
  // equality, so this reads as a FAIL even against wantOk:false. That strictness is intentional
  // (copied verbatim from the three original scripts) — a crashed call should not silently read as
  // "correctly refused" just because both are falsy in a loose sense.
  assert.doesNotThrow(() => h.checkResult('null result, wanted false', null, false));
  assert.equal(h.counts().fail, 1);
  assert.doesNotThrow(() => h.checkResult('null result, wanted true', null, true));
  assert.equal(h.counts().fail, 2);
});

test('summary reports the real running totals and a clean flag', () => {
  const h = createHarness({ label: 'X' });
  h.check('a', true); h.check('b', true); h.check('c', false);
  const s = h.summary('HOLDS');
  assert.equal(s.pass, 2);
  assert.equal(s.fail, 1);
  assert.equal(s.total, 3);
  assert.equal(s.clean, false);
});

test('summary with zero checks run is clean (vacuously — the caller decides if that is meaningful)', () => {
  const h = createHarness({ label: 'X' });
  const s = h.summary('HOLDS');
  assert.equal(s.total, 0);
  assert.equal(s.clean, true);
});

test('summary prints the custom verb only when clean, and the breach count when not', () => {
  const c = capture();
  const h = createHarness({ label: 'WIRE TEST', log: c.log });
  h.check('ok', true);
  h.summary('WIRE HOLDS');
  assert.ok(c.lines[c.lines.length - 1].includes('WIRE HOLDS'));
  const c2 = capture();
  const h2 = createHarness({ label: 'WIRE TEST', log: c2.log });
  h2.check('bad', false);
  h2.summary('WIRE HOLDS');
  assert.ok(c2.lines[c2.lines.length - 1].includes('BREACH(ES) FOUND'));
  assert.ok(!c2.lines[c2.lines.length - 1].includes('WIRE HOLDS'));
});

test('two independently-created harnesses never share counters', () => {
  const a = createHarness({ label: 'A' });
  const b = createHarness({ label: 'B' });
  a.check('x', true); a.check('y', true);
  b.check('z', false);
  assert.equal(a.counts().pass, 2);
  assert.equal(b.counts().pass, 0);
  assert.equal(b.counts().fail, 1);
});

test('default log is console.log when none injected (does not throw)', () => {
  const h = createHarness({ label: 'DEFAULT-LOG' });
  assert.doesNotThrow(() => { h.check('quiet-ish', true); h.summary('OK'); });
});
