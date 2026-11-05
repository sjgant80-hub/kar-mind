// the gate receipt: built only from one finished run that covers exactly the workflow's kernels; checked against the
// workflow and the files as they are now; garbage gives a reason, never a throw
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import G, { KIND, COUNTS, matrixOf, build, check } from './gatereceipt.mjs';

const SHA = 'b'.repeat(40), H = (c) => c.repeat(64);
const verdict = (total, killed, more = {}) => ({ total, capped: false, killed, survived: [], ignored: [], score: 1, clean: true, ...more });
const art = (kernel, v, more = {}) => ({ kernel, tests: [kernel.replace('.mjs', '.test.mjs')], witness: 'v0.6', sha: SHA, run: '123', verdict: v, ...more });
const MATRIX = [{ kernel: 'a.mjs', tests: ['a.test.mjs'] }, { kernel: 'b.mjs', tests: ['b.test.mjs', 'b2.test.mjs'] }, { kernel: 'c.mjs', tests: ['c.test.mjs'] }];
const ARTS = () => [art('a.mjs', verdict(5, 5)), art('b.mjs', verdict(7, 7)), art('c.mjs', verdict(0, 0))];
const TESTCOUNTS = () => ({ kind: COUNTS, v: 1, node: 'v22.1.0', pass: 9, fail: 0, files: { 'a.test.mjs': { pass: 2, fail: 0 }, 'b.test.mjs': { pass: 3, fail: 0 }, 'b2.test.mjs': { pass: 1, fail: 0 }, 'c.test.mjs': { pass: 3, fail: 0 } } });
const HASHES = { 'a.mjs': H('1'), 'b.mjs': H('2'), 'c.mjs': H('3') };
const IN = (patch) => ({ verdicts: ARTS(), counts: TESTCOUNTS(), matrix: MATRIX, hashes: HASHES, witness: 'v0.6', ...patch });
const why = (patch) => build(IN(patch)).why;

test('the default export and the kinds', () => {
  assert.deepEqual(Object.keys(G).sort(), ['COUNTS', 'KIND', 'build', 'check', 'matrixOf']);
  assert.equal(KIND, 'kar-mind.gate-receipt');
  assert.equal(COUNTS, 'kar-mind.test-counts');
});

test('matrixOf: the witness matrix, read from the workflow line by line; anything else is skipped', () => {
  const yml = ['jobs:', '  witness:', '        include:', '          - { kernel: a.mjs, tests: "a.test.mjs" }',
    '          - { kernel: b.mjs, tests: "b.test.mjs  b2.test.mjs", timeout: 120000 }', '          - { kernel: notes.txt, tests: "x.test.mjs" }',
    '          - { kernel: c.mjs, tests: "" }', '# - { kernel: d.mjs } has no tests field', 'x'].join('\r\n');
  assert.deepEqual(matrixOf(yml), [{ kernel: 'a.mjs', tests: ['a.test.mjs'] }, { kernel: 'b.mjs', tests: ['b.test.mjs', 'b2.test.mjs'] }, { kernel: 'c.mjs', tests: [] }]);
  for (const junk of [null, undefined, 5, {}, ['- { kernel: a.mjs, tests: "a.test.mjs" }']]) assert.deepEqual(matrixOf(junk), []);
});

test('matrixOf: this repo’s own workflow names every root module, each with its tests', () => {
  const m = matrixOf(readFileSync(new URL('./.github/workflows/ci.yml', import.meta.url), 'utf8'));
  assert.ok(m.length >= 25);
  assert.ok(m.some((x) => x.kernel === 'gatereceipt.mjs' && x.tests.includes('gatereceipt.test.mjs')));
  assert.ok(m.every((x) => x.tests.length > 0));
});

test('build: one finished run, every kernel the workflow names, each with its verdict, its hash and its tests’ counts', () => {
  const r = build(IN({}));
  assert.equal(r.ok, true);
  assert.deepEqual(r.receipt, {
    kind: KIND, v: 1, sha: SHA, run: '123', witness: 'v0.6', node: 'v22.1.0',
    totals: { kernels: 3, mutants: 12, caught: 12, survived: 0, ignored: 0, clean: true, testsPassed: 9, testsFailed: 0 },
    kernels: [
      { kernel: 'a.mjs', sha256: H('1'), mutants: 5, caught: 5, survived: 0, ignored: 0, capped: false, clean: true, tests: [{ file: 'a.test.mjs', pass: 2, fail: 0 }] },
      { kernel: 'b.mjs', sha256: H('2'), mutants: 7, caught: 7, survived: 0, ignored: 0, capped: false, clean: true, tests: [{ file: 'b.test.mjs', pass: 3, fail: 0 }, { file: 'b2.test.mjs', pass: 1, fail: 0 }] },
      { kernel: 'c.mjs', sha256: H('3'), mutants: 0, caught: 0, survived: 0, ignored: 0, capped: false, clean: true, tests: [{ file: 'c.test.mjs', pass: 3, fail: 0 }] },
    ],
  });
  const loose = build(IN({ witness: 5, counts: { ...TESTCOUNTS(), node: 22 } })).receipt;
  assert.equal(loose.witness, '');
  assert.equal(loose.node, '');
  const numericRun = build(IN({ verdicts: ARTS().map((a) => ({ ...a, run: 123 })) }));
  assert.equal(numericRun.receipt.run, '123', 'a run id may come as a number');
});

test('build: a test file the gate suite did not count shows 0, never a guess', () => {
  const c = TESTCOUNTS(); delete c.files['b2.test.mjs']; c.files['c.test.mjs'] = { pass: -1, fail: 'x' };
  const r = build(IN({ counts: c }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.receipt.kernels[1].tests[1], { file: 'b2.test.mjs', pass: 0, fail: 0 });
  assert.deepEqual(r.receipt.kernels[2].tests[0], { file: 'c.test.mjs', pass: 0, fail: 0 });
});

test('build: the totals are clean only when every kernel is clean, uncapped and has no survivor', () => {
  const one = (v) => build(IN({ verdicts: [art('a.mjs', v), art('b.mjs', verdict(7, 7)), art('c.mjs', verdict(0, 0))] })).receipt.totals;
  assert.equal(one(verdict(5, 5)).clean, true);
  assert.equal(one(verdict(5, 5, { clean: false })).clean, false, 'the gate said not clean');
  assert.equal(one(verdict(5, 5, { capped: true })).clean, false, 'a capped run is a sample, not a gate');
  const s = one(verdict(5, 4, { survived: [{ line: 1 }], clean: false }));
  assert.deepEqual([s.clean, s.survived, s.caught, s.mutants], [false, 1, 11, 12]);
  const t = one(verdict(5, 5, { survived: [{ line: 1 }] }));
  assert.equal(t.clean, false, 'a survivor is never clean, whatever the flag says');
  assert.equal(one(verdict(5, 5, { ignored: [{ line: 2 }] })).ignored, 1);
});

test('build: refuses anything but one finished run covering exactly the workflow', () => {
  assert.equal(why({ matrix: [] }), 'the workflow names no kernels');
  assert.equal(why({ matrix: 'a.mjs' }), 'the workflow names no kernels');
  const bad = 'a verdict the runner did not finish';
  for (const broke of [null, 5, 'x', Object.assign([], art('a.mjs', verdict(5, 5)))]) assert.equal(why({ verdicts: [broke, ...ARTS().slice(1)] }), bad, String(broke));
  for (const [k, v] of [['kernel', 'a.js'], ['kernel', 5], ['tests', 'a.test.mjs'], ['sha', 'b'.repeat(39)], ['sha', 'B'.repeat(40)], ['run', 'r1'], ['run', ''], ['verdict', null]]) {
    assert.equal(why({ verdicts: [{ ...art('a.mjs', verdict(5, 5)), [k]: v }, ...ARTS().slice(1)] }), bad, k + '=' + v);
  }
  for (const [k, v] of [['total', -1], ['total', 1.5], ['killed', '5'], ['survived', 0], ['ignored', null], ['capped', 'false'], ['clean', 1]]) {
    assert.equal(why({ verdicts: [art('a.mjs', verdict(5, 5, { [k]: v })), ...ARTS().slice(1)] }), bad, k + '=' + v);
  }
  assert.equal(why({ verdicts: [art('a.mjs', Object.assign([], verdict(5, 5))), ...ARTS().slice(1)] }), bad, 'an array is not a verdict');
  const noCounts = 'no test counts from the gate suite';
  for (const c of [null, 5, [], Object.assign([], TESTCOUNTS()), { ...TESTCOUNTS(), kind: 'x' }, { ...TESTCOUNTS(), pass: -1 }, { ...TESTCOUNTS(), fail: 0.5 }, { ...TESTCOUNTS(), files: [] }]) {
    assert.equal(why({ counts: c }), noCounts, JSON.stringify(c));
  }
  assert.equal(why({ verdicts: ARTS().map((a, k) => (k === 1 ? { ...a, sha: 'c'.repeat(40) } : a)) }), 'the verdicts come from more than one run', 'another commit, same run id');
  assert.equal(why({ verdicts: ARTS().map((a, k) => (k === 2 ? { ...a, run: '124' } : a)) }), 'the verdicts come from more than one run', 'another run');
  assert.equal(why({ verdicts: ARTS().slice(0, 2) }), 'c.mjs: no verdict');
  assert.equal(why({ verdicts: [...ARTS(), art('b.mjs', verdict(7, 7))] }), 'b.mjs: more than one verdict');
  assert.equal(why({ verdicts: [...ARTS(), art('d.mjs', verdict(1, 1))] }), 'a verdict for a kernel the workflow does not name');
  assert.equal(why({ hashes: { ...HASHES, 'b.mjs': 'zz' } }), 'b.mjs: no hash at the run’s commit');
  assert.equal(why({ hashes: { ...HASHES, 'b.mjs': H('A') } }), 'b.mjs: no hash at the run’s commit');
  assert.equal(why({ hashes: null }), 'a.mjs: no hash at the run’s commit');
  assert.equal(why({ verdicts: 'x' }), 'a.mjs: no verdict');
  for (const junk of [null, undefined, 5, 'x', []]) assert.deepEqual(build(junk), { ok: false, why: 'the workflow names no kernels' });
  assert.deepEqual(build({ ...IN({}), matrix: [null] }), { ok: false, why: 'the artifacts could not be read' });
});

test('check: the receipt against the workflow and the files now; a changed kernel is named, a missing one refused', () => {
  const r = build(IN({})).receipt;
  const now = check(r, MATRIX, HASHES);
  assert.deepEqual([now.ok, now.why, now.changed], [true, 'every kernel is as the run measured it', []]);
  assert.deepEqual(now.rows.map((x) => [x.kernel, x.current, x.mutants]), [['a.mjs', true, 5], ['b.mjs', true, 7], ['c.mjs', true, 0]]);
  const moved = check(r, MATRIX, { ...HASHES, 'b.mjs': H('9') });
  assert.deepEqual([moved.ok, moved.why, moved.changed, moved.rows[1].current], [true, 'changed since the run: b.mjs', ['b.mjs'], false]);
  assert.deepEqual(check(r, MATRIX, null).changed, ['a.mjs', 'b.mjs', 'c.mjs']);
  assert.deepEqual(check(r, [...MATRIX, { kernel: 'd.mjs', tests: [] }], HASHES), { ok: false, why: 'gated but not in the receipt: d.mjs', rows: [], changed: [] });
  assert.deepEqual(check(r, MATRIX.slice(1), HASHES), { ok: false, why: 'in the receipt but no longer gated: a.mjs', rows: [], changed: [] });
  assert.deepEqual(check({ ...r, kernels: [...r.kernels, 5] }, MATRIX, HASHES).why, 'in the receipt but no longer gated: (not a kernel)');
  assert.deepEqual(check(r, null, HASHES).why, 'in the receipt but no longer gated: a.mjs, b.mjs, c.mjs');
  for (const bad of [null, 5, [], { ...r, kind: 'x' }, { ...r, v: 2 }, { ...r, sha: 'x' }, { ...r, kernels: {} }, { ...r, totals: null }]) {
    assert.deepEqual(check(bad, MATRIX, HASHES), { ok: false, why: 'not a gate receipt', rows: [], changed: [] });
  }
  assert.deepEqual(check(r, [null], HASHES), { ok: false, why: 'the receipt could not be read', rows: [], changed: [] });
});
