// The seed's codec, gated: primes, the bloom of a set, held lines as names, deltas, and the sealed rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import C, { primes, dictionary, foldSet, unfoldSet, encodeHeld, decodeHeld, delta, applyDelta, judgeCodec } from './seedcodec.mjs';

test('primes and the dictionary', () => {
  assert.deepEqual(primes(7), [2, 3, 5, 7, 11, 13, 17]);
  assert.equal(primes(7).reduce((a, p) => a * p, 1), 510510, 'the first seven primes multiply to the primorial');
  assert.deepEqual(primes(0), []);
  assert.deepEqual(primes(-3), []);
  assert.deepEqual(primes('x'), []);
  assert.deepEqual(primes(2.9), [2, 3]);
  assert.equal(primes(5000).length, 5000);
  assert.equal(primes(9999).length, 5000, 'capped');
  assert.deepEqual(primes(10).slice(-2), [23, 29]);
  assert.deepEqual(dictionary(['a', 'b', 'a', '', 5, 'c']), [{ name: 'a', prime: 2 }, { name: 'b', prime: 3 }, { name: 'c', prime: 5 }]);
  assert.deepEqual(dictionary(null), []);
  assert.equal(Object.keys(C).length, 9);
});

test('foldSet and unfoldSet: a set ⇄ one integer, by unique factorisation', () => {
  const d = dictionary(['Prove', 'Own', 'Shape', 'Carry', 'Remember', 'Run-cheap', 'Connect']);
  assert.equal(foldSet(['Prove', 'Own'], d), (6).toString(36));
  assert.equal(foldSet(d.map((x) => x.name), d), (510510).toString(36), 'all seven elements fold to the primorial');
  assert.equal(foldSet([], d), '1', 'the empty set is unity');
  assert.equal(foldSet(['Nope'], d), '1');
  assert.deepEqual(unfoldSet(foldSet(['Connect', 'Prove'], d), d), ['Prove', 'Connect']);
  // every one of the 127 non-empty blooms round-trips
  let ok = 0;
  for (let mask = 1; mask < 128; mask++) {
    const set = d.filter((x, k) => mask & (1 << k)).map((x) => x.name);
    if (JSON.stringify(unfoldSet(foldSet(set, d), d)) === JSON.stringify(set)) ok++;
  }
  assert.equal(ok, 127);
  const big = dictionary(Array.from({ length: 60 }, (_, k) => 'e' + k));
  const pick = ['e0', 'e17', 'e59'];
  assert.deepEqual(unfoldSet(foldSet(pick, big), big), pick, 'sixty entries still fold and unfold exactly (BigInt)');
  assert.equal(unfoldSet('1', d).length, 0);
  assert.equal(unfoldSet((4).toString(36), d), null, 'a square is not a set');
  assert.equal(unfoldSet((19).toString(36), d), null, 'a prime nobody holds is not a set');
  assert.equal(unfoldSet('0', d), null);
  for (const bad of ['', 'Z!', null, '-1']) assert.equal(unfoldSet(bad, d), null);
  assert.deepEqual(unfoldSet('6', [null, { name: 'x', prime: 2 }, { name: 'y', prime: 1.5 }, { name: 'z', prime: 3 }]), ['x', 'z']);
  assert.equal(unfoldSet('6', null), null);
  assert.equal(foldSet(['x'], [{ name: 'x', prime: 2.5 }, null]), '1');
  assert.equal(foldSet('x', d), '1');
});

const HELD = [{ name: 'fallworld', text: 'fallworld — THE LIVING WORLD' }, { name: 'kard', text: 'kard — creatures' }, { name: 'dup', text: 'kard — creatures' }, { name: '', text: 'x' }, null];
test('encodeHeld and decodeHeld: lines the reader holds become their names, and come back exactly', () => {
  const t = 'RECENT\n· fallworld — THE LIVING WORLD\n· kard — creatures\n· other — not held\nfallworld — THE LIVING WORLD';
  const coded = encodeHeld(t, HELD, { prefix: '· ' });
  assert.equal(coded, 'RECENT\n· [fallworld]\n· [kard]\n· other — not held\nfallworld — THE LIVING WORLD');
  assert.equal(decodeHeld(coded, HELD, { prefix: '· ' }), t);
  assert.equal(encodeHeld('kard — creatures', HELD), '[kard]', 'no prefix: whole lines');
  assert.equal(decodeHeld('[kard]\n[nobody]\n[kard', HELD), 'kard — creatures\n[nobody]\n[kard');
  assert.equal(decodeHeld('· [kard]', HELD), '· [kard]', 'a prefix it was not told about is left alone');
  assert.equal(encodeHeld(null, HELD), '');
  assert.equal(encodeHeld('a', null), 'a');
  assert.equal(decodeHeld('a', 'x'), 'a');
});

test('delta and applyDelta: only what changed', () => {
  const prev = 'a\nb\nc\nd\ne', next = 'a\nb\nX\nc\nd\nY';
  const d = delta(prev, next);
  assert.equal(d, '=0+2\n+X\n=2+2\n+Y');
  assert.equal(applyDelta(prev, d), next);
  assert.equal(delta('a\nb', 'a\nb'), '=0+2');
  assert.equal(delta('', 'z'), '+z');
  assert.equal(applyDelta('', '+z'), 'z');
  assert.equal(delta('x\na\nb\na\nb\nc', 'a\nb\nc'), '=3+3', 'the longest run is taken');
  assert.equal(delta('p\nq', 'q\np'), '=1+1\n=0+1');
  assert.equal(applyDelta('a', '=0+2'), null, 'a run past the end refuses');
  assert.equal(applyDelta('a', '=0+1'), 'a', 'a run to exactly the end is fine');
  assert.equal(applyDelta('a', 'junk'), null);
  assert.equal(applyDelta(null, '+x'), 'x');
  assert.equal(delta(null, null), '=0+1');
  for (let k = 0; k < 30; k++) {
    const A = Array.from({ length: 12 }, (_, j) => 'l' + ((j * 7 + k) % 9)).join('\n'), B = Array.from({ length: 10 }, (_, j) => 'l' + ((j * 5 + k) % 11)).join('\n');
    assert.equal(applyDelta(A, delta(A, B)), B, 'round trip ' + k);
  }
});

test('judgeCodec: the sealed rules', () => {
  const bars = { ratio: 15 };
  const p = [{ kind: 'a', full: 300, coded: 10, exact: true }, { kind: 'a', full: 150, coded: 20, exact: true }, { kind: 'b', full: 100, coded: 100, exact: true }];
  const j = judgeCodec({ payloads: p, bars });
  assert.deepEqual(j.rules.map((r) => [r.id, r.pass]), [['lossless', true], ['fifteen-overall', false], ['fifteen-a', true], ['fifteen-b', false]]);
  assert.deepEqual(j.rules.map((r) => r.value), ['every coded payload decodes back to exactly what is sent today', '4.23× over the whole measured workload (550 Claude tokens as sent today, 130 coded)', '15× on a (450 → 30 tokens over 2)', '1× on b (100 → 100 tokens over 1)']);
  assert.deepEqual([j.passed, j.of, j.ratio], [2, 4, 4.23]);
  assert.deepEqual(j.kinds, [{ kind: 'a', n: 2, full: 450, coded: 30, ratio: 15 }, { kind: 'b', n: 1, full: 100, coded: 100, ratio: 1 }]);
  const off = judgeCodec({ payloads: [{ kind: 'a', full: 30, coded: 2, exact: false }], bars });
  assert.deepEqual(off.rules.map((r) => r.pass), [false, true, true]);
  assert.equal(off.rules[0].value, '1 payload(s) did not decode exactly');
  const why = { ok: false, why: 'the payloads ({ kind, full, coded, exact }) and the sealed bar' };
  for (const bad of [[], [{ kind: '', full: 1, coded: 1, exact: true }], [{ kind: 'a', full: 1, coded: 0, exact: true }], [{ kind: 'a', full: 'x', coded: 1, exact: true }], [{ kind: 'a', full: 1, coded: 1, exact: 1 }], [null]]) {
    assert.deepEqual(judgeCodec({ payloads: bad, bars }), why);
  }
  assert.deepEqual(judgeCodec({ payloads: p, bars: { ratio: 'x' } }), why);
  assert.deepEqual(judgeCodec({ payloads: p }), why);
  assert.deepEqual(judgeCodec(), why);
});

test('the edges the mutation gate found', () => {
  assert.equal(delta('a\nb\na\nb', 'a\nb'), '=0+2', 'an equal run keeps the first place it was found');
  assert.equal(decodeHeld('Xkard]', HELD), 'Xkard]', 'only a line that is wholly [name] is a name');
  assert.equal(decodeHeld('[kard', HELD), '[kard');
  assert.equal(applyDelta('a\nb\nc', delta('a\nb\nc', 'b\nc')), 'b\nc');
});
