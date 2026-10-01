// Kar watches himself, gated: the shape of a miss, the misses of a run, the loop that writes the playbook, how he
// reads it, and the sealed rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import W, { SHAPES, RULES, shapeOf, missesOf, rightOf, playbook, renderPlaybook, judgeWatch } from './watch.mjs';

test('the vocabulary', () => {
  assert.deepEqual(SHAPES, ['tool-detour', 'wrong-number', 'half-pair', 'wrong-name', 'no-answer']);
  assert.deepEqual(Object.keys(RULES), SHAPES);
  for (const s of SHAPES) assert.ok(RULES[s].length > 60, s);
  assert.equal(Object.keys(W).length, 8);
});

test('shapeOf: what kind of wrong', () => {
  assert.equal(shapeOf({ expect: '\\b37\\b', reply: '' }), 'no-answer');
  assert.equal(shapeOf({ expect: '\\b37\\b', reply: "I don't know." }), 'no-answer');
  for (const r of ['I do not have that', 'not sure', 'no information on it', "can't find it", 'cannot tell', "couldn't determine", 'could not say', 'not in my brain', 'not available in my records']) assert.equal(shapeOf({ expect: '\\b37\\b', reply: r }), 'no-answer', r);
  assert.equal(shapeOf({ expect: '\\b37\\b', reply: '19', toolCalls: 2 }), 'tool-detour');
  assert.equal(shapeOf({ expect: '\\b37\\b', reply: '19', toolCalls: '1' }), 'tool-detour', 'a count written as text still counts');
  for (const r of ['Let me check the file', "I'll look it up", 'I will check', 'I need to check', 'I would need to look', 'got ENOENT', 'no such file', 'repository is not found at the path', 'the search did not find it', 'the estate index shows nothing']) assert.equal(shapeOf({ expect: '\\b37\\b', reply: r }), 'tool-detour', r);
  assert.equal(shapeOf({ expect: '\\b57\\b[\\s\\S]{0,80}\\b64\\b', reply: '64 only' }), 'half-pair');
  assert.equal(shapeOf({ expect: '\\b37\\b', reply: '19 of 60' }), 'wrong-number');
  assert.equal(shapeOf({ expect: '\\b37\\b', reply: 'nineteen' }), 'wrong-name', 'a number asked and a word given');
  assert.equal(shapeOf({ expect: '\\bU\\b[^.]{0,60}\\bV\\b', reply: 'A maps to Z, 2 ways' }), 'wrong-name', 'quantifier digits are not an asked number');
  assert.equal(shapeOf({ expect: 'UV\\s*\\|\\s*515', reply: 'U→V' }), 'wrong-name');
  assert.equal(shapeOf({ expect: 'UV\\s*\\|\\s*515', reply: 'UV|514' }), 'wrong-number');
  assert.equal(shapeOf({ expect: '\\d\\d', reply: '5' }), 'wrong-name', 'an escape is not an asked number');
  assert.equal(shapeOf({ expect: 'c24f5e4', reply: 'e13b713' }), 'wrong-name', 'a commit is a name, not a number');
  assert.equal(shapeOf({ expect: 'c24f5e4x', reply: '7' }), 'wrong-number');
  assert.equal(shapeOf({ expect: 'kar-brain-on|the brain', reply: 'kard-creatures-vision' }), 'wrong-name');
  assert.equal(shapeOf(), 'no-answer');
  assert.equal(shapeOf({ expect: 5, reply: 7 }), 'no-answer');
});

const Q = [{ q: 'a?', expect: '\\b37\\b' }, { q: 'b?', expect: 'c24f5e4' }, { q: 'c?', expect: '\\b57\\b[\\s\\S]{0,80}\\b64\\b' }];
test('missesOf and rightOf', () => {
  const m = missesOf(Q, [{ reply: '37' }, { reply: ' e13b713\n is  it ', toolCalls: 0 }, { reply: 'x'.repeat(200) + ' 64' }], 2, 'run-x');
  assert.deepEqual(m, [
    { run: 2, source: 'run-x', q: 'b?', expect: 'c24f5e4', said: 'e13b713 is it', shape: 'wrong-name' },
    { run: 2, source: 'run-x', q: 'c?', expect: Q[2].expect, said: 'x'.repeat(159) + '…', shape: 'half-pair' },
  ]);
  assert.deepEqual(missesOf(Q, [null, { reply: 'c24f5e4' }, { reply: '57 then 64' }], 1, 5), [{ run: 1, source: '', q: 'a?', expect: '\\b37\\b', said: '', shape: 'no-answer' }]);
  assert.deepEqual(missesOf([null], [{ reply: 'x' }], 1, 's'), []);
  for (const bad of [[Q, [], 1], [null, [], 1], [Q, null, 1], [Q, [1, 2, 3], 1.5], [Q, [1, 2, 3], '1']]) assert.deepEqual(missesOf(...bad, 's'), []);
  assert.deepEqual(rightOf(Q, [{ reply: 'It was 37 of 60.' }, { reply: 'c24f5e4' }, { reply: 'no' }]), { 'a?': 'It was 37 of 60.', 'b?': 'c24f5e4' });
  assert.deepEqual(rightOf([Q[0], Q[0]], [{ reply: 'the answer is 37' }, { reply: '37' }]), { 'a?': '37' }, 'the shortest right answer');
  assert.deepEqual(rightOf([Q[0], Q[0]], [{ reply: '37' }, { reply: 'the answer is 37' }]), { 'a?': '37' });
  assert.deepEqual(rightOf([Q[0]], [{ reply: 'y'.repeat(200) + ' 37' }])['a?'].length, 160);
  assert.deepEqual(rightOf([null], [{ reply: '37' }]), {});
  assert.deepEqual(rightOf(Q, [1]), {});
  assert.deepEqual(rightOf(null, []), {});
});

const M = (run, shape, q, said = 's') => ({ run, source: 'r', q, expect: 'e', said, shape });
test('playbook: the loop folds misses into rules, by count, with retirement', () => {
  const misses = [M(1, 'wrong-number', 'n1', 'old'), M(2, 'wrong-number', 'n2'), M(3, 'wrong-number', 'n1', 'new'), M(3, 'wrong-name', 'w1'), M(2, 'tool-detour', 't1'),
    M(3, 'tool-detour', 't2'), M(1, 'no-answer', 'x1'), M(4, 'half-pair', 'h1'), { run: 'x', shape: 'wrong-name' }, { run: 1, shape: 'nope' }, null];
  const pb = playbook(misses, { right: { n1: 'thirty-seven', h1: 'both' } });
  assert.deepEqual([pb.version, pb.learnedFrom, pb.runs], [1, 8, 4]);
  assert.deepEqual(pb.rules.map((r) => [r.shape, r.count, r.lastRun]), [['wrong-number', 3, 3], ['tool-detour', 2, 3], ['half-pair', 1, 4], ['wrong-name', 1, 3]]);
  assert.deepEqual(pb.retired, ['no-answer'], 'last seen in run 1, three runs before run 4');
  assert.equal(pb.rules[0].rule, RULES['wrong-number']);
  assert.deepEqual(pb.rules[0].examples, [{ q: 'n1', said: 'new', right: 'thirty-seven' }, { q: 'n2', said: 's', right: '' }], 'latest first, one per question');
  assert.deepEqual(pb.rules[2].examples, [{ q: 'h1', said: 's', right: 'both' }]);
  // retirement is exactly three runs back
  assert.deepEqual(playbook([M(1, 'no-answer', 'a'), M(3, 'wrong-name', 'b')]).retired, [], 'two runs back stays');
  assert.deepEqual(playbook([M(1, 'no-answer', 'a'), M(3, 'wrong-name', 'b')], { retireAfter: 2 }).retired, ['no-answer']);
  // capped rules: the overflow is retired too, never silently dropped
  const capped = playbook(misses, { maxRules: 2 });
  assert.deepEqual(capped.rules.map((r) => r.shape), ['wrong-number', 'tool-detour']);
  assert.deepEqual(capped.retired, ['no-answer', 'half-pair', 'wrong-name']);
  assert.deepEqual(playbook(misses, { maxRules: -1 }).rules, []);
  assert.equal(playbook(misses, { maxExamples: 1 }).rules[0].examples.length, 1);
  assert.equal(playbook(misses, { prevVersion: 4 }).version, 5);
  assert.equal(playbook(misses, { prevVersion: 'x' }).version, 1);
  assert.deepEqual(playbook(misses, { right: null }).rules[0].examples[0].right, '');
  // ties on count: the order of SHAPES decides
  assert.deepEqual(playbook([M(1, 'half-pair', 'a'), M(1, 'tool-detour', 'b')]).rules.map((r) => r.shape), ['tool-detour', 'half-pair']);
  assert.deepEqual(playbook(null), { version: 1, learnedFrom: 0, runs: 0, rules: [], retired: [] });
});

test('renderPlaybook: how Kar reads it', () => {
  const pb = playbook([M(2, 'wrong-number', 'How many?', '19'), M(2, 'tool-detour', 'Which?', 'let me look')], { right: { 'How many?': '37' }, prevVersion: 1 });
  assert.equal(renderPlaybook(pb), [
    'MY PLAYBOOK — rules I wrote from my own past misses (version 2, from 2 wrong answers). I read them before I answer:',
    '1. ' + RULES['tool-detour'] + ' (I have missed this way 1 time.)',
    '   e.g. asked "Which?" I said "let me look".',
    '2. ' + RULES['wrong-number'] + ' (I have missed this way 1 time.)',
    '   e.g. asked "How many?" I said "19" — right was "37".',
  ].join('\n'));
  const two = renderPlaybook(playbook([M(1, 'wrong-name', 'a'), M(1, 'wrong-name', 'b')]));
  assert.ok(two.includes('(I have missed this way 2 times.)'));
  assert.equal(renderPlaybook(playbook([])), '');
  assert.equal(renderPlaybook({ version: 1, learnedFrom: 0, rules: [{ rule: 'r', count: 1, examples: 'x' }] }), 'MY PLAYBOOK — rules I wrote from my own past misses (version 1, from 0 wrong answers). I read them before I answer:\n1. r (I have missed this way 1 time.)');
  assert.equal(renderPlaybook(null), '');
});

test('judgeWatch: the sealed rules', () => {
  const learned = ['wrong-number', 'wrong-name'];
  const without = { marks: [false, false, false, true, true, false], shapes: ['wrong-number', 'wrong-name', 'wrong-number', '', '', 'no-answer'] };
  const withLoop = { marks: [true, true, false, true, true, false], shapes: ['', '', 'wrong-number', '', '', 'half-pair'] };
  const j = judgeWatch({ without, withLoop, learned, loopCloses: true, bars: { fewerBy: 2 } });
  assert.deepEqual(j.rules.map((r) => [r.id, r.pass]), [['fewer-repeats', true], ['not-worse', true], ['no-regression', true], ['loop-closes', true]]);
  assert.deepEqual(j.rules.map((r) => r.value), ['1 repeat mistakes with the loop, 3 without', '4 of 6 right with the loop, 2 without', 'every answer right without the loop is right with it', 'the run\'s own misses rewrote the playbook, and the live line carries the new version']);
  assert.deepEqual([j.passed, j.of, j.repeats], [4, 4, { without: 3, withLoop: 1 }]);
  assert.equal(judgeWatch({ without, withLoop, learned, loopCloses: true, bars: { fewerBy: 3 } }).rules[0].pass, false, 'two fewer is not three');
  const worse = judgeWatch({ without: withLoop, withLoop: without, learned, loopCloses: false, bars: { fewerBy: 0 } });
  assert.deepEqual(worse.rules.map((r) => r.pass), [false, false, false, false]);
  assert.deepEqual(worse.rules.map((r) => r.value).slice(2), ['2 answer(s) right without the loop went wrong with it', 'the playbook was not rewritten from this run']);
  const same = judgeWatch({ without, withLoop: without, learned, loopCloses: true, bars: { fewerBy: 0 } });
  assert.deepEqual(same.rules.map((r) => r.pass), [true, true, true, true], 'equal is not worse; zero fewer meets a zero bar');
  assert.equal(judgeWatch({ without, withLoop, learned: [], loopCloses: true, bars: { fewerBy: 1 } }).rules[0].value, '0 repeat mistakes with the loop, 0 without', 'only learned shapes are repeats');
  const ok = { without, withLoop, learned, loopCloses: true, bars: { fewerBy: 2 } };
  for (const bad of [{ ...ok, without: null }, { ...ok, withLoop: { marks: [true], shapes: [''] } }, { ...ok, without: { marks: [], shapes: [] }, withLoop: { marks: [], shapes: [] } }, { ...ok, learned: 'x' },
    { ...ok, loopCloses: 1 }, { ...ok, bars: { fewerBy: 1.5 } }, { ...ok, bars: null }, { ...ok, without: { marks: [true], shapes: [] } }]) {
    assert.deepEqual(judgeWatch(bad), { ok: false, why: 'two arms over the same held-out questions ({ marks, shapes }), the shapes the playbook learned, the loop check and the sealed bars' });
  }
  assert.equal(judgeWatch().ok, false);
});

test('the edges the mutation gate found', () => {
  assert.equal(missesOf([Q[0]], [{ reply: 'z'.repeat(160) }], 1, 's')[0].said, 'z'.repeat(160), 'exactly 160 characters is kept whole');
  assert.deepEqual(rightOf([Q[0], Q[0]], [{ reply: '37 a' }, { reply: '37 b' }]), { 'a?': '37 a' }, 'an equal-length later answer does not replace the first');
  assert.deepEqual(rightOf(Q, null), {});
  assert.deepEqual(rightOf(Q, 'abc'), {});
});
