// Simon's pattern, gated: what counts as a decision, its type, his verdict, the profile, the prediction and the rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import P, { TYPES, VERDICTS, ON_HIS_KEY, questionOf, isDecision, typeOf, verdictOf, decisionOf, dedupe, profile, predict, wilsonLow, score, judgePattern } from './pattern.mjs';

test('the vocabulary', () => {
  assert.deepEqual(TYPES, ['money', 'post', 'destroy', 'standing', 'choose', 'build', 'other']);
  assert.deepEqual(VERDICTS, ['go', 'all', 'no']);
  assert.deepEqual(ON_HIS_KEY, ['money', 'post', 'destroy']);
  assert.equal(Object.keys(P).length, 14);
});

test('questionOf: the sentence that asks, to the end', () => {
  assert.equal(questionOf('I built the gate. It passed 40/40. Want me to push it?'), 'Want me to push it?');
  assert.equal(questionOf('Done.\nShould I wire it in? Or hold.'), 'Should I wire it in? Or hold.');
  assert.equal(questionOf('Built it! Ready? Say go.'), 'Ready? Say go.');
  assert.equal(questionOf('The price was £5. Gate is green. Say the word and I will ship it'), 'Say the word and I will ship it');
  assert.equal(questionOf('Built it. Shipped it. All green'), 'All green', 'no question: the last sentence');
  assert.equal(questionOf('x'.repeat(900) + ' ok?').length, 400);
  assert.equal(questionOf('a? b'), 'a? b', 'a question at the very start keeps everything after it');
  assert.equal(questionOf(null), '');
});

test('isDecision: a question near the end, or an offer to act', () => {
  assert.equal(isDecision('Built it. Want me to push it?'), true);
  assert.equal(isDecision('Built it. Say the word and I ship it.'), true);
  assert.equal(isDecision('Built it, gate green, live.'), false);
  assert.equal(isDecision('Why did it fail? Because the path was wrong. ' + 'Then I fixed it and the gate went green and it shipped. '.repeat(10)), false, 'an old rhetorical question is not an ask');
  for (const p of ['should I', 'shall I', 'your call', 'say go', 'do you want', 'which one', 'which first', 'which way', 'ready for', 'ready to', 'good to go', 'ok to', 'okay to', 'yes or no', 'call it']) {
    assert.equal(isDecision('Done. ' + p + ' now.'), true, p);
  }
  assert.equal(isDecision(''), false);
  assert.equal(isDecision(5), false);
});

test('typeOf: first match wins, in order, read from the question only', () => {
  assert.equal(typeOf('Want me to set the price at £9?'), 'money');
  assert.equal(typeOf('Shall I wire Stripe payments?'), 'money');
  assert.equal(typeOf('It cost $3 to build. Want me to post it on LinkedIn?'), 'post', 'the money before the question is not the question');
  assert.equal(typeOf('Want me to email Danny the brief?'), 'post');
  assert.equal(typeOf('Should I delete the old branch?'), 'destroy');
  assert.equal(typeOf('Shall I schedule it nightly?'), 'standing');
  assert.equal(typeOf('Want it to start at logon?'), 'standing');
  assert.equal(typeOf('Build (a) the gate or (b) the page first?'), 'choose');
  assert.equal(typeOf('Which one first?'), 'choose');
  assert.equal(typeOf('Gate it now or ship it as is?'), 'choose');
  assert.equal(typeOf('Want me to build it?'), 'build');
  assert.equal(typeOf('Push it live?'), 'build');
  assert.equal(typeOf('Does that look right?'), 'other');
  assert.equal(typeOf('Want me to post the price?'), 'money', 'money comes before post');
  assert.equal(typeOf('Delete the post?'), 'post', 'post comes before destroy');
  assert.equal(typeOf('Schedule a delete?'), 'destroy', 'destroy comes before standing');
  assert.equal(typeOf('Schedule a build or a fix?'), 'standing', 'standing comes before choose');
  assert.equal(typeOf('Build a or b?'), 'choose', 'choose comes before build');
  assert.equal(typeOf(null), 'other');
  for (const [w, t] of [['pricing', 'money'], ['subscription', 'money'], ['€5', 'money'], ['tweet', 'post'], ['facebook', 'post'], ['product hunt', 'post'], ['reply to', 'post'], ['outreach', 'post'],
    ['wipe', 'destroy'], ['force-push', 'destroy'], ['uninstall', 'destroy'], ['cron', 'standing'], ['on startup', 'standing'], ['every morning', 'standing'], ['hooks', 'standing'], ['settings.json', 'standing'],
    ['either', 'choose'], ['wire', 'build'], ['deploy', 'build'], ['scope', 'build']]) assert.equal(typeOf('OK to ' + w + ' it?'), t, w);
});

test('verdictOf: go, all, no — or nothing when it is a new instruction', () => {
  for (const r of ['yes', 'Yes!', 'yeah mate', 'yep', 'y', 'go', 'go for it', 'do it', 'lfg', 'sure', 'approved', 'ship it', 'push it live', 'proceed', 'please do', 'crack on', 'keep going', 'continue', 'carry on', 'build it', 'wire it in', 'fork it in', 'make it so', 'ok', 'okay!', '  "yes route it to local"']) assert.equal(verdictOf(r), 'go', r);
  for (const r of ['all', 'both', 'all of it dude epic', 'all of them', 'all three', 'everything', 'do it all', 'the lot', 'yes all', 'go all three in that order', 'yes both', 'ok, both', 'yes merge both posts', 'do all three'.replace('do all three', 'do it all three')]) assert.equal(verdictOf(r), 'all', r);
  for (const r of ['no', 'n', 'nope', 'nah', "don't", 'do not', 'stop', 'not now', 'not yet', 'park it', 'hold for kar', 'wait dude', 'leave it', 'skip', 'never mind', 'nevermind', 'cancel that']) assert.equal(verdictOf(r), 'no', r);
  for (const r of ['ok got the correct id in file', 'okay so what next', 'update the seed', 'why the fuck', 'yesterday', 'gone', 'nothing', 'allow me', 'bothered', '', null, 5]) assert.equal(verdictOf(r), null, String(r));
  assert.equal(verdictOf('yes and also add the tests'), 'go');
  assert.equal(verdictOf('yes do the whole thing, everything'), 'all', 'a yes that reaches for everything inside thirty characters');
  assert.equal(verdictOf('yes ' + 'x'.repeat(40) + ' everything'), 'go', 'everything too far from the yes is not an all');
  assert.equal(verdictOf('no, both'), 'no');
});

test('decisionOf and dedupe', () => {
  assert.deepEqual(decisionOf({ ask: 'Built. Want me to push it?', reply: 'yes', at: '2026-09-25T10:00:00Z' }), { at: '2026-09-25', type: 'build', verdict: 'go' });
  assert.deepEqual(decisionOf({ ask: 'Built.', reply: 'yes', at: '2026-09-25' }), null);
  assert.deepEqual(decisionOf({ ask: 'Which first?', reply: 'update the seed' }), { at: '', type: 'choose', verdict: null });
  assert.equal(decisionOf(), null);
  const a = { ask: 'x'.repeat(300) + 'Want it?', reply: 'yes', at: '1' }, b = { ask: 'y'.repeat(300) + 'Want it?', reply: 'yes', at: '2' };
  assert.deepEqual(dedupe([a, { ...a, at: '9' }, b, null, { ask: 'Want it?', reply: ' yes ' }, { ask: 'Want it? ', reply: 'yes' }]), [a, b, { ask: 'Want it?', reply: ' yes ' }]);
  assert.deepEqual(dedupe([{ ask: 'z'.repeat(50) + 'q'.repeat(200), reply: 'r' }, { ask: 'w'.repeat(50) + 'q'.repeat(200), reply: 'r' }]).length, 1, 'only the last 200 characters of the ask tell exchanges apart');
  assert.deepEqual(dedupe('x'), []);
});

test('profile and predict', () => {
  const ds = [{ type: 'build', verdict: 'go' }, { type: 'build', verdict: 'go' }, { type: 'build', verdict: 'no' }, { type: 'post', verdict: 'no' }, { type: 'choose', verdict: 'all' },
    { type: 'choose', verdict: 'go' }, { type: 'money', verdict: null }, { type: 'nope', verdict: 'go' }, null, { type: 'build', verdict: 'maybe' }];
  const p = profile(ds);
  assert.deepEqual(p, { byType: { build: { go: 2, all: 0, no: 1 }, post: { go: 0, all: 0, no: 1 }, choose: { go: 1, all: 1, no: 0 } }, overall: { go: 3, all: 1, no: 2 } });
  assert.equal(predict(p, 'build'), 'go');
  assert.equal(predict(p, 'post'), 'no');
  assert.equal(predict(p, 'choose'), 'go', 'a tie goes to go');
  assert.equal(predict(p, 'money'), 'go', 'an unseen type falls back to his commonest verdict');
  assert.equal(predict({ byType: { x: { go: 0, all: 0, no: 0 } }, overall: { go: 0, all: 2, no: 1 } }, 'x'), 'all', 'a type with no verdicts falls back too');
  assert.equal(predict({ byType: { x: { go: 1, all: 1, no: 2 } } }, 'x'), 'no');
  assert.equal(predict({ byType: { x: { go: 0, all: 3, no: 3 } } }, 'x'), 'all', 'all before no on a tie');
  assert.equal(predict(null, 'build'), 'go');
  assert.deepEqual(profile(null), { byType: {}, overall: { go: 0, all: 0, no: 0 } });
});

test('wilsonLow', () => {
  assert.equal(wilsonLow(0, 0), 0);
  assert.equal(wilsonLow(10, 10).toFixed(4), '0.7225');
  assert.equal(wilsonLow(19, 20).toFixed(4), '0.7639');
  assert.equal(wilsonLow(5, 10).toFixed(4), '0.2366');
  assert.equal(wilsonLow(0, 10), 0);
  for (const [k, n] of [[11, 10], [-1, 5], [1.5, 3], [1, 0], ['1', 2], [1, 2.5]]) assert.equal(wilsonLow(k, n), 0, k + '/' + n);
});

const PROF = { byType: { build: { go: 9, all: 0, no: 1 }, post: { go: 0, all: 0, no: 3 }, choose: { go: 1, all: 2, no: 0 } }, overall: { go: 10, all: 2, no: 4 } };
test('score: overall, against always-go, per type, and which types clear', () => {
  const held = [...Array(10).fill({ type: 'build', verdict: 'go' }), { type: 'post', verdict: 'no' }, { type: 'choose', verdict: 'go' }, { type: 'choose', verdict: 'all' }, { type: 'money', verdict: 'no' }, { type: 'x', verdict: 'go' }, { type: 'build', verdict: 'none' }, null];
  const s = score(PROF, held);
  assert.deepEqual([s.n, s.hits, s.alwaysGo], [14, 12, 11]);
  assert.equal(s.rate, 12 / 14);
  assert.deepEqual(s.marks.slice(10), [{ type: 'post', actual: 'no', predicted: 'no' }, { type: 'choose', actual: 'go', predicted: 'all' }, { type: 'choose', actual: 'all', predicted: 'all' }, { type: 'money', actual: 'no', predicted: 'go' }]);
  const t = Object.fromEntries(s.types.map((r) => [r.type, r]));
  assert.deepEqual(t.build, { type: 'build', n: 10, hits: 10, rate: 1, low: wilsonLow(10, 10), predicts: 'go', clears: true, onHisKey: false });
  assert.deepEqual(t.post, { type: 'post', n: 1, hits: 1, rate: 1, low: wilsonLow(1, 1), predicts: 'no', clears: false, onHisKey: true });
  assert.deepEqual(t.other, { type: 'other', n: 0, hits: 0, rate: 0, low: 0, predicts: 'go', clears: false, onHisKey: false });
  assert.equal(t.money.onHisKey, true);
  assert.equal(score(PROF, held, { minN: 11 }).types[5].clears, false, 'ten is not eleven');
  assert.equal(score(PROF, held, { bar: 1 }).types[5].clears, true, 'exactly the bar clears');
  const nine = score(PROF, [...Array(9).fill({ type: 'build', verdict: 'go' }), { type: 'build', verdict: 'no' }]);
  assert.equal(nine.types[5].clears, false, '90% does not clear 95%');
  assert.deepEqual(score(PROF, null), { n: 0, hits: 0, rate: 0, alwaysGo: 0, marks: [], types: score(PROF, []).types });
  assert.equal(score(PROF, []).types.length, 7);
});

test('judgePattern: the sealed rules', () => {
  const bars = { overallAtLeast: 0.75, minHeld: 20, typeBar: 0.95, typeMinN: 10 };
  const held = [...Array(18).fill({ type: 'build', verdict: 'go' }), { type: 'post', verdict: 'no' }, { type: 'choose', verdict: 'all' }, { type: 'post', verdict: 'go' }];
  const j = judgePattern(score(PROF, held), bars);
  assert.equal(j.ok, true);
  assert.deepEqual(j.rules.map((r) => [r.id, r.pass]), [['enough', true], ['overall', true], ['beats-always-go', true], ['a-type-clears', true]]);
  assert.deepEqual(j.rules.map((r) => r.value), ['21 held-out decisions with a verdict', '20/21 = 95.2%', '20 right against 19 for always saying go', 'build at 95% or more']);
  assert.deepEqual([j.passed, j.of, j.cleared], [4, 4, ['build']]);
  // a type on his key is never named, however well it is called
  const keyed = judgePattern(score({ byType: { post: { go: 0, all: 0, no: 5 } }, overall: { go: 1, all: 0, no: 0 } }, Array(20).fill({ type: 'post', verdict: 'no' })), bars);
  assert.deepEqual(keyed.cleared, []);
  assert.equal(keyed.rules[3].pass, false);
  assert.equal(keyed.rules[3].value, 'no type reached 95% on enough decisions');
  assert.equal(keyed.rules[2].pass, true, '20 right against 0');
  const thin = judgePattern(score(PROF, Array(19).fill({ type: 'build', verdict: 'go' })), bars);
  assert.deepEqual(thin.rules.map((r) => r.pass), [false, true, false, true], '19 is short of 20; matching always-go is not beating it');
  const low = judgePattern(score(PROF, [...Array(14).fill({ type: 'build', verdict: 'go' }), ...Array(6).fill({ type: 'build', verdict: 'no' })]), bars);
  assert.equal(low.rules[1].pass, false, '70% is under 75%');
  assert.equal(judgePattern(score(PROF, [...Array(15).fill({ type: 'build', verdict: 'go' }), ...Array(5).fill({ type: 'build', verdict: 'no' })]), bars).rules[1].pass, true, 'exactly 75% passes');
  assert.equal(judgePattern(score(PROF, []), bars).rules[1].pass, false, 'nothing held out is not a pass');
  for (const bad of [[null, bars], [{ types: [], n: 1.5 }, bars], [score(PROF, []), { overallAtLeast: 0.75 }], [score(PROF, []), null], [{ n: 1 }, bars]]) assert.deepEqual(judgePattern(...bad), { ok: false, why: 'a score and the sealed bars' });
});

test('the edges the mutation gate found', () => {
  assert.equal(questionOf('? hello. world'), '? hello. world', 'a question mark at the very start keeps the whole text');
  const bars = { overallAtLeast: 0.75, minHeld: 20, typeBar: 0.95, typeMinN: 10 };
  assert.equal(judgePattern(score(PROF, Array(20).fill({ type: 'build', verdict: 'go' })), bars).rules[0].pass, true, 'exactly 20 is enough');
  assert.equal(judgePattern(score(PROF, []), { ...bars, overallAtLeast: 0 }).rules[1].pass, false, 'no decisions never passes, even at a zero bar');
  assert.equal(wilsonLow(0, 4), 0);
  assert.ok(wilsonLow(1, 4) > 0);
});
