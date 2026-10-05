import { test } from 'node:test';
import assert from 'node:assert/strict';
import L, { clausesOf, factsOf, missingFacts, renderBuilds, relayout } from './layout.mjs';

test('clausesOf splits on every boundary, one fact per clause', () => {
  assert.deepEqual(clausesOf('a — b; c · d: e, f + g but h (i) j'), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
  assert.deepEqual(clausesOf('1B 19, 7B 19, 14B 37 of 60, bar 57'), ['1B 19', '7B 19', '14B 37 of 60', 'bar 57']);
  assert.deepEqual(clausesOf('19/20 + 8/10 held out'), ['19/20', '8/10 held out']);
  assert.deepEqual(clausesOf('1,768 repos'), ['1,768 repos']);   // a comma inside a number is not a boundary
  assert.deepEqual(clausesOf('a-b'), ['a-b']);
  assert.deepEqual(clausesOf('a:b'), ['a:b']);
  assert.deepEqual(clausesOf('a,b'), ['a,b']);
  assert.deepEqual(clausesOf('a+b'), ['a+b']);
  assert.deepEqual(clausesOf('abut c'), ['abut c']);
  assert.deepEqual(clausesOf('a·b'), ['a·b']);
  assert.deepEqual(clausesOf('a;b'), ['a;b']);
});

test('clausesOf keeps the word on a vs split, drops flags and empties', () => {
  assert.deepEqual(clausesOf('gen 1 vs trials 1.5 vs blind 6.5'), ['gen 1', 'vs trials 1.5', 'vs blind 6.5']);
  assert.deepEqual(clausesOf('352/352 vs. 244'), ['352/352', 'vs 244']);
  assert.deepEqual(clausesOf('avs b'), ['avs b']);
  assert.deepEqual(clausesOf('⚑⚑ LIVE'), ['LIVE']);
  assert.deepEqual(clausesOf(' ⚑ ; x'), ['x']);
  assert.deepEqual(clausesOf(''), []);
  assert.deepEqual(clausesOf(42), []);
  assert.deepEqual(clausesOf(null), []);
});

test('factsOf trims trailing punctuation, missingFacts names what was lost', () => {
  assert.deepEqual(factsOf('1B 19, 7B 19.'), ['1', '19', '7', '19']);
  assert.deepEqual(factsOf('sealed 4d21214 → 1/4'), ['4d21214', '1/4']);
  assert.deepEqual(factsOf('no digits'), []);
  assert.deepEqual(factsOf(7), []);
  assert.deepEqual(missingFacts('19/20 and 47', '19/20 only'), ['47']);
  assert.deepEqual(missingFacts('19/20 and 47', '47 and 19/20'), []);
  assert.deepEqual(missingFacts('47', null), ['47']);
  assert.deepEqual(missingFacts(null, 'x'), []);
});

test('renderBuilds numbers newest first and names the build just before each', () => {
  const b = [{ name: 'c', text: ['x 3, y 4'] }, { name: 'b', text: ['z', 'k 9'] }, { name: 'a', text: ['w'] }];
  assert.deepEqual(renderBuilds(b), [
    'RECENT BUILDS — 3 listed, numbered newest first: #1 is the newest, #3 is the oldest listed',
    '#1 c (newest · built just before it: b)', '  - x 3', '  - y 4',
    '#2 b (built just before it: a)', '  - z', '  - k 9',
    '#3 a (oldest listed)', '  - w',
  ]);
  assert.deepEqual(renderBuilds([{ name: 'solo', text: ['s'] }]), [
    'RECENT BUILDS — 1 listed, numbered newest first: #1 is the newest, #1 is the oldest listed',
    '#1 solo (newest · oldest listed)', '  - s',
  ]);
  assert.deepEqual(renderBuilds([]), ['RECENT BUILDS: none listed']);
  assert.deepEqual(renderBuilds(null), ['RECENT BUILDS: none listed']);
});

const DIGEST = [
  'HEAD LINE',
  'ESTATE: 1,768 repos (1,721 public, 47 private)',
  'RECENT BUILDS, newest first:',
  '· new — scored 15/18 but always-go 17/18',
  '   key facts: sealed 4d21214',
  '· old — 1B 19, 7B 19',
  'CHANGED SINCE THE LAST LOOK (0): nothing',
].join('\r\n');

test('relayout re-lays the estate line and the builds, passes the rest through, loses no fact', () => {
  const r = relayout(DIGEST);
  assert.equal(r, [
    'HEAD LINE',
    'ESTATE:', '  - 1,768 repos', '  - 1,721 public', '  - 47 private',
    'RECENT BUILDS — 2 listed, numbered newest first: #1 is the newest, #2 is the oldest listed',
    '#1 new (newest · built just before it: old)', '  - scored 15/18', '  - always-go 17/18', '  - sealed 4d21214',
    '#2 old (oldest listed)', '  - 1B 19', '  - 7B 19',
    'CHANGED SINCE THE LAST LOOK (0): nothing',
  ].join('\n'));
  assert.deepEqual(missingFacts(DIGEST, r), []);
});

test('relayout keeps a stray line in the block rather than dropping it', () => {
  const r = relayout('RECENT BUILDS, newest first:\n   key facts: orphan 5\n· nodash line 6\n· ok — 7\nTAIL');
  assert.equal(r, [
    'RECENT BUILDS — 3 listed, numbered newest first: #1 is the newest, #3 is the oldest listed',
    '#1 (unnamed) (newest · built just before it: (unnamed))', '  - orphan 5',
    '#2 (unnamed) (built just before it: ok)', '  - nodash line 6',
    '#3 ok (oldest listed)', '  - 7',
    'TAIL',
  ].join('\n'));
  assert.equal(relayout('RECENT BUILDS'), 'RECENT BUILDS: none listed');
  assert.equal(relayout('ESTATE:x'), 'ESTATE:x');
  assert.equal(relayout('x\nESTATE: a, b'), 'x\nESTATE:\n  - a\n  - b');
  assert.equal(relayout(''), '');
  assert.equal(relayout(null), null);
  assert.equal(L.relayout, relayout);
});
