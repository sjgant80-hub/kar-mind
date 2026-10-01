import { test } from 'node:test';
import assert from 'node:assert/strict';
import B, { MAX_DESC, MAX_LINE, LOOKS, needsLook, FACT, keyFactsOf, judgeFix, frontmatter, memoryFacts, indexLines, askFacts, backlogFacts, stateOf, changedFacts, nextBuild, decisionsOf, digest, gradeAnswer, scoreAnswers, judgeBrain } from './brain.mjs';

const ev = (key, value, ts = 1, source = 's') => ({ t: 'perceive', fact: { key, value, source, ts } });
const md = (desc, extra = '') => '---\nname: x\ndescription: ' + desc + '\n' + extra + '---\nbody';

test('the constants and the default export', () => {
  assert.equal(MAX_DESC, 400);
  assert.equal(MAX_LINE, 600);
  assert.equal(Object.keys(B).length, 20);
  assert.equal(B.needsLook, needsLook);
  assert.equal(B.keyFactsOf, keyFactsOf);
  assert.ok(LOOKS instanceof RegExp && FACT instanceof RegExp && FACT.global);
  assert.equal(B.judgeBrain, judgeBrain);
});

test('frontmatter reads name, description and type, first value wins', () => {
  assert.deepEqual(frontmatter('---\nname: a\ndescription: "say \\"hi\\""\nmetadata:\n  type: project\n---\nbody'), { name: 'a', description: 'say "hi"', type: 'project' });
  assert.deepEqual(frontmatter('---\r\nname: b\r\ndescription: plain words\r\n---\r\nx'), { name: 'b', description: 'plain words' });
  assert.deepEqual(frontmatter('---\nname: a\nname: z\n---\n'), { name: 'a' });
  assert.deepEqual(frontmatter('---\ndescription: "only one quote\n---\n'), { description: '"only one quote' });
  assert.deepEqual(frontmatter('---\ntitle: t\n---\n'), {});
  for (const bad of ['no front matter', '--\nname: a\n--', null, 5, '']) assert.equal(frontmatter(bad), null);
});

test('memoryFacts: one fact per file that describes itself', () => {
  const long = 'L'.repeat(MAX_DESC + 5);
  const facts = memoryFacts([
    { name: 'a', text: md('does a', '  type: project\n'), mtimeMs: 7 },
    { name: 'b', text: md(long), mtimeMs: 8 },
    { name: 'c', text: 'no frontmatter', mtimeMs: 9 },
    { name: 'd', text: '---\nname: d\n---\n', mtimeMs: 9 },
    { name: '', text: md('x'), mtimeMs: 1 }, { name: 'e', text: md('x'), mtimeMs: NaN }, null, 'f',
  ]);
  assert.deepEqual(facts[0], { key: 'memory:a', value: { d: 'does a', type: 'project' }, source: 'memory', ts: 7 });
  assert.equal(facts[1].value.d, 'L'.repeat(MAX_DESC - 1) + '…');
  assert.equal(facts[1].value.type, null);
  assert.equal(facts.length, 2);
  assert.equal(memoryFacts([{ name: 'x', text: md('L'.repeat(MAX_DESC)), mtimeMs: 1 }])[0].value.d, 'L'.repeat(MAX_DESC));
  assert.deepEqual(memoryFacts(null), []);
});

const INDEX = [
  '> **⚑ ESTATE = the whole org** — [estate-index.json](estate-index.json) 1,768 repos',
  '',
  '**Recent builds (newest first):**',
  '- [fallworld](fallworld.md) — ⚑⚑ THE LIVING WORLD: LIVE 2d57105',
  '- not a link line',
  '- [kard-evolve](kard-evolve.md) — creatures [x](y.md)',
  '',
  '- [later](later.md) — after the blank',
].join('\n');

test('indexLines finds the estate line and the recent builds, links flattened', () => {
  assert.deepEqual(indexLines(INDEX), {
    estate: 'ESTATE = the whole org — estate-index.json 1,768 repos',
    recent: [{ name: 'fallworld', text: 'THE LIVING WORLD: LIVE 2d57105' }, { name: 'kard-evolve', text: 'creatures x' }],
  });
  assert.deepEqual(indexLines('nothing here'), { estate: null, recent: [] });
  assert.deepEqual(indexLines('**Recent builds**\n- [a](a.md) — first line'), { estate: null, recent: [{ name: 'a', text: 'first line' }] });
  assert.deepEqual(indexLines('**Recent builds**\nplain'), { estate: null, recent: [] });
  assert.deepEqual(indexLines(null), { estate: null, recent: [] });
});

test('askFacts and backlogFacts', () => {
  assert.deepEqual(askFacts({ asks: [{ id: 'a1', kind: 'want', status: 'open', say: 'fold the ledger', at: '2026-09-22T09:20:00Z' }, { id: 'a2', say: 'x', at: 'not a date' }, { id: '', say: 'x' }, { id: 'a3' }, null] }), [
    { key: 'ask:a1', value: { kind: 'want', status: 'open', say: 'fold the ledger' }, source: 'kar-asks', ts: Date.parse('2026-09-22T09:20:00Z') },
    { key: 'ask:a2', value: { kind: '', status: '', say: 'x' }, source: 'kar-asks', ts: 0 },
  ]);
  assert.equal(askFacts({ asks: [{ id: 'l', say: 'S'.repeat(MAX_DESC + 1) }] })[0].value.say.length, MAX_DESC);
  for (const bad of [null, {}, { asks: 'x' }, []]) assert.deepEqual(askFacts(bad), []);
  assert.deepEqual(backlogFacts({ items: [
    { id: 'b1', n: 1, title: 'Switch on', why: 'w', status: 'open', ts: 5, needs: 'money', after: ['x', 3, ''] },
    { id: 'b2', n: 2, title: 'Next' },
    { id: 'b3', n: 1.5, title: 'bad n' }, { id: 'b4', title: 'no n' }, { n: 3, title: 'no id' }, { id: 'b5', n: 4 }, 'x',
  ] }), [
    { key: 'backlog:b1', value: { n: 1, title: 'Switch on', status: 'open', needs: 'money', after: ['x'], why: 'w' }, source: 'brain-backlog', ts: 5 },
    { key: 'backlog:b2', value: { n: 2, title: 'Next', status: 'open', needs: null, after: [], why: '' }, source: 'brain-backlog', ts: 0 },
  ]);
  assert.equal(backlogFacts({ items: [{ id: 'q', n: 1, title: 't', ts: Infinity }] })[0].ts, 0);
  for (const bad of [null, { items: 'x' }]) assert.deepEqual(backlogFacts(bad), []);
});

test('stateOf keeps the latest perceived fact for every key', () => {
  const s = stateOf([ev('a', 1, 1), ev('b', 2, 2, 'src'), ev('a', 3, 3), { t: 'dream', fact: { key: 'z' } }, { t: 'perceive', fact: { key: '' } }, { t: 'perceive' }, null, 'x']);
  assert.deepEqual([...s.keys()], ['a', 'b']);
  assert.deepEqual(s.get('a'), { value: 3, ts: 3, source: 's' });
  assert.deepEqual(s.get('b'), { value: 2, ts: 2, source: 'src' });
  assert.equal(stateOf(null).size, 0);
});

test('changedFacts writes only what is new or different', () => {
  const s = stateOf([ev('a', { d: 'x' }), ev('b', 1)]);
  const f = [{ key: 'a', value: { d: 'x' } }, { key: 'b', value: 2 }, { key: 'c', value: 0 }, { key: '', value: 1 }, null];
  assert.deepEqual(changedFacts(s, f).map((x) => x.key), ['b', 'c']);
  assert.deepEqual(changedFacts(new Map(), [{ key: 'a', value: { d: 'x' } }]).length, 1);
  assert.deepEqual(changedFacts({}, f), []);
  assert.deepEqual(changedFacts(s, null), []);
});

const Q = (items, asks = []) => stateOf([
  ...items.map((i) => ev('backlog:' + i.id, { n: i.n, title: i.title || i.id, status: i.status || 'open', needs: i.needs || null, after: i.after || [], why: i.why || '' })),
  ...asks.map((a) => ev('ask:' + a.id, { kind: a.kind, status: a.status, say: a.say })),
]);

test('nextBuild: the first open item whose prerequisites are done, in order', () => {
  const s = Q([{ id: 'c', n: 3 }, { id: 'a', n: 1, status: 'done' }, { id: 'b', n: 2, after: ['z'] }, { id: 'z', n: 9 }],
    [{ id: 'w', kind: 'want', status: 'open', say: 'want this' }, { id: 'd', kind: 'decision', status: 'open', say: 'decide' }, { id: 'n', kind: 'need', status: 'done', say: 'old' }]);
  const n = nextBuild(s);
  assert.equal(n.build.id, 'c');
  assert.deepEqual(n.asks.map((a) => a.id), ['w']);
  assert.equal(nextBuild(Q([{ id: 'b', n: 2, after: ['a'] }, { id: 'a', n: 1, status: 'done' }])).build.id, 'b');
  assert.equal(nextBuild(Q([{ id: 'a', n: 1, status: 'needs-simon' }, { id: 'b', n: 2, status: 'done' }])).build, null);
  assert.deepEqual(nextBuild(null), { build: null, asks: [] });
});

test('decisionsOf: open decision-asks and queue items waiting on Simon, nothing else', () => {
  const s = Q([{ id: 'sw', n: 2, status: 'needs-simon', title: 'Logon', why: 'a standing switch' }, { id: 'q', n: 3, status: 'needs-simon', title: 'Bare' }, { id: 'o', n: 1 }],
    [{ id: 'd1', kind: 'decision', status: 'open', say: 'Pick one' }, { id: 'd2', kind: 'decision', status: 'done', say: 'old' }, { id: 'w', kind: 'want', status: 'open', say: 'w' }]);
  assert.deepEqual(decisionsOf(s), [{ id: 'd1', say: 'Pick one', from: 'ask' }, { id: 'sw', say: 'Logon — a standing switch', from: 'queue' }, { id: 'q', say: 'Bare', from: 'queue' }]);
  assert.deepEqual(decisionsOf(null), []);
});

test('digest: the working memory, small and true', () => {
  const state = stateOf([
    ev('memory:old', { d: 'old file' }, 5), ev('memory:edge', { d: 'at the last look exactly' }, 10), ev('memory:new', { d: 'new file' }, 20), ev('memory:newer', { d: 'D'.repeat(250) }, 30),
    ev('backlog:x', { n: 1, title: 'Build X', status: 'open', needs: null, after: [], why: 'because' }),
    ev('ask:w', { kind: 'want', status: 'open', say: 'a want' }),
    ev('ask:d', { kind: 'decision', status: 'open', say: 'a decision' }),
  ]);
  const text = digest({ state, index: indexLines(INDEX), since: 10, now: Date.UTC(2026, 9, 1) });
  assert.equal(text, [
    '── KAR\'S BRAIN · working memory, read from the persistent journal (7 facts) ──',
    'ESTATE: ESTATE = the whole org — estate-index.json 1,768 repos',
    'RECENT BUILDS, newest first:',
    '· fallworld — THE LIVING WORLD: LIVE 2d57105',
    '· kard-evolve — creatures x',
    'CHANGED SINCE THE LAST LOOK (2):',
    '· newer — ' + 'D'.repeat(199) + '…',
    '· new — new file',
    'NEXT BUILD (Simon\'s approved order): 1 · Build X — because',
    'OPEN ASKS:',
    '· a want',
    'DECISIONS ONLY SIMON MAKES (1):',
    '· a decision',
    '(read 2026-10-01T00:00:00.000Z)',
  ].join('\n'));
  const quiet = digest({ state: new Map(), index: { estate: null, recent: [] } });
  assert.equal(quiet, [
    '── KAR\'S BRAIN · working memory, read from the persistent journal (0 facts) ──',
    'CHANGED SINCE THE LAST LOOK (0): nothing',
    'NEXT BUILD (Simon\'s approved order): the queue is empty',
    'DECISIONS ONLY SIMON MAKES (0): none waiting',
  ].join('\n'));
  const capped = digest({ state, index: { recent: [{ name: 'a', text: 'R'.repeat(MAX_LINE + 1) }, { name: 'b', text: 'b' }], estate: 'E'.repeat(MAX_LINE + 1) }, since: 0, recentMax: 1, changedMax: 1 });
  assert.ok(capped.includes('ESTATE: ' + 'E'.repeat(MAX_LINE - 1) + '…'));
  assert.ok(capped.includes('· a — ' + 'R'.repeat(MAX_LINE - 1) + '…'));
  assert.ok(!capped.includes('· b — b'));
  assert.ok(capped.includes('CHANGED SINCE THE LAST LOOK (4):\n· newer'));
  assert.ok(!capped.includes('· new — new file'));
  assert.ok(!capped.includes('(read '));
  assert.equal(digest({ state, index: { recent: 'x' } }).includes('RECENT BUILDS'), false);
  assert.ok(digest({ state: stateOf([ev('backlog:y', { n: 1, title: 'Y', status: 'open', needs: null, after: [], why: '' })]), index: {} }).includes('1 · Y\n'));
  for (const bad of [{}, { state: {}, index: {} }, { state: new Map(), index: null }]) assert.equal(digest(bad), null);
  assert.equal(digest(), null);
});

test('gradeAnswer and scoreAnswers', () => {
  assert.equal(gradeAnswer('Live at 2D57105.', '2d57105'), true);
  assert.equal(gradeAnswer('no idea', '2d57105'), false);
  assert.equal(gradeAnswer('1768 repos', '1,?768'), true);
  for (const [r, p] of [[null, 'a'], ['a', null], ['a', ''], ['a', '('], [null, 'nu'], ['5', 5]]) assert.equal(gradeAnswer(r, p), false);
  assert.deepEqual(scoreAnswers([{ expect: 'a' }, { expect: 'b' }, null], ['A', 'x', 'b']), { n: 3, right: 1, marks: [true, false, false] });
  for (const [q, r] of [[null, []], [[], null], [[{ expect: 'a' }], []]]) assert.equal(scoreAnswers(q, r), null);
});

test('judgeBrain: the sealed rules, each at its edge', () => {
  const S = (marks) => ({ n: marks.length, right: marks.filter(Boolean).length, marks });
  const bars = { withAtLeast: 3, withoutAtMost: 1, liftAtLeast: 2 };
  const live = { soulLive: true, loopCloses: true };
  const good = judgeBrain({ withBrain: S([1, 1, 1, 0].map(Boolean)), without: S([1, 0, 0, 0].map(Boolean)), live, bars });
  assert.deepEqual(good.rules, [
    { id: 'brain-grounds', pass: true, value: '3/4 right with the brain' },
    { id: 'without-guesses', pass: true, value: '1/4 right without it' },
    { id: 'lift', pass: true, value: '+2' },
    { id: 'keeps-what-it-knew', pass: true, value: 'every answer right without the brain is still right with it' },
    { id: 'soul-live', pass: true, value: 'a memory written after boot was found without a restart' },
    { id: 'loop-closes', pass: true, value: 'the session start carried the last build and the next one, with nobody relaying' },
  ]);
  assert.deepEqual([good.passed, good.of], [6, 6]);
  const bad = judgeBrain({ withBrain: S([0, 1, 1, 0].map(Boolean)), without: S([1, 1, 0, 0].map(Boolean)), live: { soulLive: 'yes', loopCloses: false }, bars });
  assert.deepEqual(bad.rules.map((r) => [r.pass, r.value]), [
    [false, '2/4 right with the brain'], [false, '2/4 right without it'], [false, '+0'],
    [false, 'the brain lost an answer it had'], [false, 'not found without a restart'], [false, 'the session start did not carry them'],
  ]);
  assert.equal(bad.passed, 0);
  assert.equal(judgeBrain({ withBrain: S([0, 0].map(Boolean)), without: S([1, 1].map(Boolean)), live, bars }).rules[2].value, '-2');
  const W = S([1, 1, 1, 1].map(Boolean)), O = S([0, 0, 0, 0].map(Boolean));
  for (const args of [{}, { withBrain: W, without: S([0]), live, bars }, { withBrain: W, without: O, live: null, bars }, { withBrain: W, without: O, live, bars: null },
    { withBrain: W, without: O, live, bars: { ...bars, liftAtLeast: 1.5 } }, { withBrain: W, without: O, live, bars: { ...bars, withAtLeast: '3' } }, { withBrain: W, without: O, live, bars: { ...bars, withoutAtMost: undefined } },
    { withBrain: { n: 4, right: 4, marks: [true] }, without: O, live, bars }, { withBrain: { n: 4, right: 4.5, marks: W.marks }, without: O, live, bars }, { withBrain: W, without: { ...O, marks: 'x' }, live, bars }]) {
    assert.equal(judgeBrain(args).ok, false);
  }
  assert.equal(judgeBrain().ok, false);
});

test('needsLook: a reply that goes to look, or does not know, earns the tools; an answer does not', () => {
  for (const r of ['664 cards.', '2 out of 4.', 'UV|515', 'Settle the cheques', 'unsurely 4', 'The champion is UV|515.']) assert.equal(needsLook(r), false, r);
  for (const r of ['Let me check the file.', 'let me look', 'Let me search', 'let me find it', 'Let me see.', "I'll check", 'I will check',
    "I don't have that.", 'I do not know', "I don't see it", "I'm not sure", 'Not sure.', 'There is no information on it',
    'no record of that', 'No data.', "I can't find it", 'cannot tell', "couldn't determine", 'could not see', 'not in my brain',
    'not available in my memory', 'The repo is not found.', '', '   ', null, 5]) assert.equal(needsLook(r), true, String(r));
});

test('keyFactsOf: only the clauses that carry a fact the index line lacks', () => {
  const desc = '⚑⚑ LIVE (Kar, 2026-09-30, Simon said go): readers of damaged codes. Sealed 5/5: champion UV|515 found U→V — swept 48/48 by gen 21; real 96 vs 94, 0 wrong';
  const line = 'creatures EVOLVE, sealed 5/5 (held-out 352/352 vs 244)';
  assert.equal(keyFactsOf(desc, line), 'Sealed 5/5: champion UV|515 found U→V · swept 48/48 by gen 21 · real 96 vs 94, 0 wrong');
  assert.equal(keyFactsOf('LIVE 2d57105 — at https://x.io/a80/ — 1 — (2) — deck 664', 'deck 664'), 'LIVE 2d57105');
  assert.equal(keyFactsOf('cost $0.2070 and £1.57M', ''), 'cost $0.2070 and £1.57M');
  assert.equal(keyFactsOf('all of it is here: 664 cards', 'already 664 cards'), '');
  assert.equal(keyFactsOf('words only, no facts at all', ''), '');
  assert.equal(keyFactsOf('sjgant80 is a name — written 2026-09-30', ''), '');
  assert.equal(keyFactsOf('a 12/13 score', null), 'a 12/13 score');
  assert.equal(keyFactsOf('ab 1 — 7 — xy 9', ''), 'ab 1 · xy 9', 'four characters is a clause; three is a stray numeral');
  assert.equal(keyFactsOf('x 1/2 · '.repeat(80) + 'end', '', 50).length, 50);
  assert.equal(keyFactsOf('x 1/2 · y', '', 9), 'x 1/2 · y');
  assert.equal(keyFactsOf('aaaa 1/2', '', 7), 'aaaa 1…');
  for (const bad of [null, '', 5]) assert.equal(keyFactsOf(bad, 'x'), '');
});

test('digest with key facts: each recent build carries what its own memory adds', () => {
  const state = stateOf([
    ev('memory:kard-evolve', { d: 'Sealed 5/5: champion UV|515 found U→V — held-out 352/352' }),
    ev('memory:fallworld', { d: 'nothing new here' }),
    ev('memory:quiet', 'not an object'),
  ]);
  const index = { recent: [{ name: 'kard-evolve', text: 'held-out 352/352' }, { name: 'fallworld', text: 'deck' }, { name: 'quiet', text: 'q' }, { name: 'absent', text: 'a' }] };
  const d = digest({ state, index, keyFacts: true });
  assert.ok(d.includes('· kard-evolve — held-out 352/352\n   key facts: Sealed 5/5: champion UV|515 found U→V\n· fallworld — deck\n· quiet — q\n· absent — a\n'));
  assert.ok(!digest({ state, index }).includes('key facts'), 'off unless asked for');
});

test('judgeFix: the fix pass rules, each at its edge', () => {
  const A = (marks, tools) => ({ marks: marks.map(Boolean), tools });
  const bars = { originalAtLeast: 2, heldAtLeast: 1, beatsBy: 2 };
  const v1 = A([1, 0, 0, 0, 0], [0, 1, 2, 0, 0]);
  const v2 = A([1, 1, 0, 1, 0], [0, 0, 0, 1, 0]);
  const good = judgeFix({ v1, v2, original: 3, bars });
  assert.deepEqual(good.rules, [
    { id: 'original-bar', pass: true, value: '2/3 of the original questions' },
    { id: 'held-out-bar', pass: true, value: '1/2 of the held-out questions' },
    { id: 'beats-v1', pass: true, value: '3 vs 1 of 5' },
    { id: 'no-regression', pass: true, value: 'every original answer the first brain got right, the fixed one still gets right' },
    { id: 'fewer-tools', pass: true, value: 'reached for a tool on 1 questions, against 2' },
  ]);
  assert.deepEqual([good.passed, good.of], [5, 5]);
  const bad = judgeFix({ v1: A([1, 1, 0, 0, 0], [1, 0, 0, 0, 0]), v2: A([0, 1, 0, 0, 0], [1, 0, 0, 0, 0]), original: 3, bars });
  assert.deepEqual(bad.rules.map((r) => [r.pass, r.value]), [
    [false, '1/3 of the original questions'], [false, '0/2 of the held-out questions'], [false, '1 vs 2 of 5'],
    [false, '1 original answer(s) lost'], [false, 'reached for a tool on 1 questions, against 1'],
  ]);
  assert.equal(bad.passed, 0);
  assert.equal(judgeFix({ v1: A([0, 0, 0, 0, 0], [0, 0, 0, 0, 0]), v2: A([1, 1, 0, 1, 0], [0, 0, 0, 0, 0]), original: 3, bars }).rules[2].pass, true);
  assert.equal(judgeFix({ v1: A([1, 0, 0, 0, 0], [0, 0, 0, 0, 0]), v2: A([1, 1, 0, 0, 0], [0, 0, 0, 0, 0]), original: 3, bars }).rules[1].value, '0/2 of the held-out questions');
  for (const args of [{}, { v1, v2: A([1], [0]), original: 3, bars }, { v1: { marks: [true], tools: [] }, v2, original: 3, bars }, { v1, v2, original: 0, bars }, { v1, v2, original: 5, bars },
    { v1, v2, original: 2.5, bars }, { v1, v2, original: 3, bars: null }, { v1, v2, original: 3, bars: { ...bars, beatsBy: '2' } }, { v1, v2: { marks: 'x', tools: [] }, original: 3, bars }, { v1: { marks: [], tools: 'x' }, v2, original: 3, bars }]) {
    assert.equal(judgeFix(args).ok, false);
  }
  assert.equal(judgeFix().ok, false);
  // each refusal alone, everything else valid — so no guard can hide behind another
  const five = A([1, 0, 0, 0, 0], [0, 0, 0, 0, 0]);
  assert.equal(judgeFix({ v1: { marks: five.marks, tools: [0, 0, 0, 0] }, v2: five, original: 3, bars }).ok, false, 'v1 alone malformed');
  assert.equal(judgeFix({ v1: five, v2: { marks: five.marks, tools: [0, 0, 0, 0] }, original: 3, bars }).ok, false, 'v2 alone malformed');
  assert.equal(judgeFix({ v1: five, v2: A([1, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]), original: 3, bars }).ok, false, 'lengths differ, both well formed');
  assert.equal(judgeFix({ v1: five, v2: five, original: 1, bars }).ok, true, 'one original question is enough');
  assert.equal(judgeFix({ v1: five, v2: five, original: 4, bars }).ok, true, 'one held-out question is enough');
});
