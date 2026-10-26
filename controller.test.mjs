import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { route, verbOf, fits, nightOf, walletFor, reserve, cortexArgs, readReply, ideaPrompt, readLocalIdea, similarity, ideaChecks,
  TIERS, RUN, NARROW, JUDGE, FRAME, TEMPLATE, IDEA_SCHEMA, IDEA_SYSTEM } from './controller.mjs';

const prereg = JSON.parse(readFileSync(new URL('./data/controller-prereg.json', import.meta.url), 'utf8'));
const B = { left: 100000, ceiling: 30000 };

test('the vendored foundation is exactly what its pin names', () => {
  const pin = JSON.parse(readFileSync(new URL('./vendor/fall-kit-core/FALL-KIT-CORE.json', import.meta.url), 'utf8'));
  assert.match(pin.commit, /^[0-9a-f]{40}$/);
  assert.ok(Object.keys(pin.files).includes('vendor/wallet/wallet.mjs'));
  for (const [f, sha] of Object.entries(pin.files)) assert.equal(createHash('sha256').update(readFileSync(new URL('./vendor/fall-kit-core/' + f, import.meta.url))).digest('hex'), sha, f);
});

test('the sealed routing jobs land on their sealed tiers', () => {
  const tasks = prereg.routing.tasks;
  assert.equal(tasks.length, 30);
  const right = tasks.filter(([w, tier]) => route(w, B).tier === tier).length;
  assert.equal(right, 30);
  for (const t of TIERS) assert.equal(tasks.filter(([, tier]) => tier === t).length, 10);
});

test('route: each verb list, the unknown verb, and the budget', () => {
  for (const v of RUN) assert.equal(route(v + ' it', B).tier, 'deterministic', v);
  for (const v of NARROW) assert.equal(route(v + ' it', B).tier, 'local', v);
  for (const v of JUDGE) assert.equal(route(v + ' it', B).tier, 'frontier', v);
  const r = route('run the gate', B);
  assert.equal(r.why, '"run" is an organ’s job: run it, no model');
  assert.equal(r.fallback, false);
  assert.equal(route('classify it', B).why, '"classify" is a narrow wording job: the local model');
  assert.equal(route('plan it', B).why, '"plan" is judgement: the frontier');
  assert.equal(route('ponder the estate', B).tier, 'frontier', 'an unknown verb: Claude when unsure');
  assert.match(route('ponder the estate', B).why, /^"ponder" is a verb the router does not know: Claude when unsure: the frontier$/);
  assert.match(route('', B).why, /^no verb: Claude when unsure/);
  // no budget left: judgement and the unknown fall back to the local model, and say so; the others do not change
  const none = { left: 29999, ceiling: 30000 };
  const fb = route('decide the next build', none);
  assert.deepEqual([fb.tier, fb.fallback], ['local', true]);
  assert.equal(fb.why, '"decide" is judgement, but tonight’s frontier budget is spent: the local model, as a fallback');
  assert.equal(route('ponder', none).tier, 'local');
  assert.equal(route('run it', none).tier, 'deterministic', 'an organ job needs no budget');
  assert.equal(route('classify it', none).fallback, false);
  assert.equal(route('decide it', { left: 30000, ceiling: 30000 }).tier, 'frontier', 'exactly the ceiling fits');
  assert.equal(route('decide it').tier, 'local', 'no budget given is no budget');
  assert.equal(route('decide it', null).tier, 'local');
  assert.equal(route(5, B).tier, 'frontier', 'junk words are no verb: Claude when unsure, within budget');
});

test('verbOf and fits', () => {
  assert.equal(verbOf('Please, run the gate'), 'run');
  assert.equal(verbOf('Kar, propose an idea'), 'propose');
  assert.equal(verbOf('please kar please review it'), 'review');
  assert.equal(verbOf('please'), 'please', 'a lone "please" is the verb');
  assert.equal(verbOf('kar'), 'kar');
  assert.equal(verbOf('  Re-run   the census'), 're-run');
  assert.equal(verbOf('RUN!'), 'run');
  assert.equal(verbOf(''), '');
  assert.equal(verbOf(null), '');
  assert.equal(fits(10, 10), true);
  assert.equal(fits(9, 10), false);
  assert.equal(fits(10, 0), false, 'a ceiling is at least one token');
  assert.equal(fits(10, -1), false);
  assert.equal(fits(10.5, 10), false);
  assert.equal(fits(10, 1.5), false);
  assert.equal(fits('10', 5), false);
});

test('nights: twelve hours back, so one evening and its small hours are one night', () => {
  assert.equal(nightOf(new Date('2026-10-26T01:45:00Z')), '2026-10-25');
  assert.equal(nightOf(new Date('2026-10-25T22:00:00Z')), '2026-10-25');
  assert.equal(nightOf(new Date('2026-10-26T11:59:59Z')), '2026-10-25');
  assert.equal(nightOf(new Date('2026-10-26T12:00:00Z')), '2026-10-26');
  assert.equal(nightOf(new Date('nope')), '1970-01-01');
  assert.equal(nightOf('2026-10-26'), '1970-01-01');
});

test('the wallet is a wall: the ceiling is spent before the call, and a call that does not fit is refused', () => {
  let s = walletFor(null, '2026-10-25', 100000);
  assert.deepEqual(s.wallet.budget, { total: 100000, spent: 0 });
  assert.deepEqual(s.wallet.caps, ['think']);
  const made = [];
  for (let i = 0; i < 6; i++) {
    const r = reserve(s.wallet, 30000);
    made.push(r.ok);
    if (r.ok) s = { ...s, wallet: r.wallet };
    if (i === 0) assert.equal(r.left, 70000);
    if (i === 3) { assert.match(r.why, /over budget/); assert.equal(r.left, 10000); }
  }
  assert.deepEqual(made, [true, true, true, false, false, false]);
  assert.equal(s.wallet.budget.spent, 90000);
  assert.equal(walletFor(s, '2026-10-25', 100000).wallet, s.wallet, 'the same night keeps its wallet');
  assert.deepEqual(walletFor(s, '2026-10-26', 100000).wallet.budget, { total: 100000, spent: 0 }, 'the next night starts fresh');
  assert.deepEqual(walletFor(s, '2026-10-25', 200000).wallet.budget, { total: 200000, spent: 0 }, 'a changed budget is a new wallet');
  assert.equal(walletFor({ night: '2026-10-25', wallet: { ...s.wallet, budget: { total: 100000, spent: -1 } } }, '2026-10-25', 100000).wallet.budget.spent, 0, 'a broken wallet starts fresh');
  assert.equal(walletFor({ night: '2026-10-25', wallet: { ...s.wallet, budget: { total: 100000, spent: 1.5 } } }, '2026-10-25', 100000).wallet.budget.spent, 0);
  assert.equal(walletFor({ night: '2026-10-25', wallet: { ...s.wallet, caps: 'think' } }, '2026-10-25', 100000).wallet.budget.spent, 0);
  assert.equal(walletFor({ night: '2026-10-25', wallet: { ...s.wallet, budget: null } }, '2026-10-25', 100000).wallet.budget.spent, 0);
  assert.equal(walletFor({ night: '2026-10-25', wallet: null }, '2026-10-25', 100000).wallet.budget.spent, 0);
  assert.equal(walletFor({ night: '2026-10-25', wallet: { ...s.wallet } }, '2026-10-25', 100000).wallet.budget.spent, 90000, 'a whole wallet is kept');
  const untouched = walletFor(null, '2026-10-25', 100000);
  assert.equal(walletFor(untouched, '2026-10-25', 100000).wallet, untouched.wallet, 'a wallet with nothing spent yet is still tonight’s');
  assert.equal(walletFor('x', 'n', -5).wallet.budget.total, 0, 'a bad budget is none');
  assert.equal(walletFor('x', 'n', 2.5).wallet.budget.total, 0);
  assert.equal(walletFor(null, 'n', 0).wallet.budget.total, 0, 'a budget of nothing is allowed');
  const exact = reserve(walletFor(null, 'n', 30000).wallet, 30000);
  assert.deepEqual([exact.ok, exact.left], [true, 0], 'a call that exactly fits is made');
  assert.deepEqual([reserve(s.wallet, 0).ok, reserve(s.wallet, 0).why], [false, 'a call needs a ceiling']);
  assert.equal(reserve(s.wallet, 2.5).ok, false);
  assert.equal(reserve(s.wallet, 0).left, 10000);
});

test('cortexArgs: no tools, no MCP, nothing saved; refuses a model or prompt that is not one', () => {
  const a = cortexArgs({ model: 'claude-opus-4-8', system: 'sys', schema: IDEA_SCHEMA });
  assert.deepEqual(a.slice(0, 8), ['-p', '--output-format', 'json', '--model', 'claude-opus-4-8', '--system-prompt', 'sys', '--tools']);
  assert.equal(a[8], '', 'the tool list is empty');
  for (const f of ['--strict-mcp-config', '--no-session-persistence', '--disable-slash-commands', '--no-chrome']) assert.ok(a.includes(f), f);
  assert.equal(a[a.indexOf('--json-schema') + 1], JSON.stringify(IDEA_SCHEMA));
  assert.equal(a[a.indexOf('--setting-sources') + 1], 'project');
  assert.equal(cortexArgs({ model: 'claude-opus-4-8', system: 'sys' }).includes('--json-schema'), false, 'no schema, no schema flag');
  assert.equal(cortexArgs({ model: 'claude-opus-4-8', system: 'sys', schema: null }).includes('--json-schema'), false);
  assert.equal(cortexArgs({ model: '--tools', system: 'sys' }), null, 'a flag is not a model');
  assert.equal(cortexArgs({ model: 'gpt-4', system: 'sys' }), null);
  assert.equal(cortexArgs({ model: 'claude-opus-4-8', system: '' }), null);
  assert.equal(cortexArgs({ model: 'claude-opus-4-8', system: 5 }), null);
  assert.equal(cortexArgs({ model: 5, system: 'sys' }), null);
  assert.equal(cortexArgs(null), null);
});

test('readReply: the CLI report, read; a refusal or junk is not a reply', () => {
  const good = { type: 'result', subtype: 'success', is_error: false, result: 'ok', num_turns: 1, permission_denials: [], structured_output: { idea: 'x' },
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 62 }, modelUsage: { 'claude-opus-4-8': {} } };
  assert.deepEqual(readReply(JSON.stringify(good)), { ok: true, text: 'ok', structured: { idea: 'x' }, tokens: 0, turns: 1, denials: 0, model: 'claude-opus-4-8' }, 'an empty model entry counts nothing');
  const noMu = { ...good, modelUsage: undefined };
  assert.equal(readReply(JSON.stringify(noMu)).tokens, 177, 'without modelUsage, the usage block is counted');
  // the CLI ran a small model for housekeeping too: every model's tokens count; the model is the one asked for
  const two = { ...good, modelUsage: { 'claude-haiku-4-5': { inputTokens: 521, outputTokens: 13, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }, 'claude-opus-4-8': { inputTokens: 175, outputTokens: 3, cacheReadInputTokens: 10, cacheCreationInputTokens: 2 } } };
  assert.equal(readReply(JSON.stringify(two), 'claude-opus-4-8').tokens, 724);
  assert.equal(readReply(JSON.stringify(two), 'claude-opus-4-8').model, 'claude-opus-4-8');
  assert.equal(readReply(JSON.stringify(two)).model, 'claude-haiku-4-5', 'asked for nothing: the one that wrote most');
  assert.equal(readReply(JSON.stringify(two), 'claude-sonnet-5').model, 'claude-haiku-4-5', 'asked for one it did not use: the one that wrote most');
  const tie = { ...good, modelUsage: { a: { outputTokens: 5 }, b: { outputTokens: 5 }, c: { outputTokens: 9 }, d: null } };
  assert.equal(readReply(JSON.stringify(tie)).model, 'c');
  assert.equal(readReply(JSON.stringify({ ...good, modelUsage: { a: { outputTokens: 5 }, b: { outputTokens: 5 } } })).model, 'a', 'a tie keeps the first');
  assert.equal(readReply(JSON.stringify({ ...good, modelUsage: { a: { inputTokens: -3, outputTokens: 'x' }, b: 7 } })).tokens, 0, 'junk counts are none');
  assert.equal(readReply(JSON.stringify({ ...good, modelUsage: [1] })).tokens, 177, 'a list is not a model table');
  assert.deepEqual(readReply(JSON.stringify({ ...good, is_error: true, result: 'API Error: 400' })), { ok: false, why: 'the frontier refused: API Error: 400' });
  assert.equal(readReply(JSON.stringify({ ...good, subtype: 'error_max_turns' })).ok, false);
  assert.deepEqual(readReply('not json'), { ok: false, why: 'the frontier sent no report' });
  assert.deepEqual(readReply(JSON.stringify({ type: 'system' })), { ok: false, why: 'the frontier sent no result' });
  assert.deepEqual(readReply('null'), { ok: false, why: 'the frontier sent no result' });
  const bare = readReply(JSON.stringify({ type: 'result', subtype: 'success' }));
  assert.deepEqual(bare, { ok: true, text: '', structured: null, tokens: 0, turns: 0, denials: 0, model: null });
  assert.equal(readReply(JSON.stringify({ ...noMu, usage: { input_tokens: -5, output_tokens: 1.5, cache_read_input_tokens: 'x' } })).tokens, 0, 'junk counts are none');
  assert.equal(readReply(JSON.stringify({ ...noMu, usage: null })).tokens, 0);
  assert.equal(readReply(JSON.stringify({ ...good, permission_denials: [{}, {}] })).denials, 2);
  assert.equal(readReply(JSON.stringify({ ...good, permission_denials: 'x' })).denials, 0);
  assert.equal(readReply(JSON.stringify({ ...good, structured_output: 'x' })).structured, null);
  assert.equal(readReply(JSON.stringify({ ...good, result: 7 })).text, '');
  assert.equal(readReply(JSON.stringify({ ...good, modelUsage: {} })).model, null);
  assert.equal(readReply(JSON.stringify({ ...good, modelUsage: {} })).tokens, 177, 'an empty model table: the usage block');
  assert.equal(readReply(JSON.stringify({ ...good, modelUsage: 'x' })).model, null);
});

test('the idea prompt: the pair with what each is, what memory holds, the recent builds, the one answer shape', () => {
  const p = ideaPrompt({ pair: ['fall-os', 'didy'], what: { 'fall-os': 'the sovereign operating system', didy: 'the trainable conductor' }, held: ['a line', '  ', 7, 'b'.repeat(300)], recent: ['fall-kit-core', 'light-everywhere'] });
  assert.match(p, /^Tonight the dream most often found these two together:\n- fall-os: the sovereign operating system\n- didy: the trainable conductor\nWhat memory holds on them:\n- a line\n- b{240}\nThe estate’s most recent builds:\n- fall-kit-core\n- light-everywhere\n\nPropose ONE small/);
  assert.match(p, /"uses": \[/);
  assert.match(p, /none of these words: \+1, wobble, theta, kappa, phi, regulator\.$/);
  const q = ideaPrompt({ pair: ['a', 'b'] });
  assert.match(q, /^Tonight the dream most often found these two together:\n- a\n- b\n\nPropose ONE/, 'no memory, no recent builds: no empty headings');
  assert.match(ideaPrompt(null), /^Tonight the dream most often found these two together:\n- \n- \n/);
  assert.match(ideaPrompt({ pair: ['x'] }), /\n- \n- \n/, 'a pair is two');
  const many = ideaPrompt({ pair: ['a', 'b'], held: Array.from({ length: 9 }, (_, i) => 'h' + i), recent: Array.from({ length: 9 }, (_, i) => 'r' + i) });
  assert.equal((many.match(/^- h\d$/gm) || []).length, 6);
  assert.equal((many.match(/^- r\d$/gm) || []).length, 6);
  assert.ok(!ideaPrompt({ pair: ['a', 'b'], what: { a: '' } }).includes('- a:'), 'an empty description is left out');
  assert.equal(ideaPrompt({ pair: ['a', 'b'], what: { a: 'w'.repeat(300) } }).split('\n')[1].length, '- a: '.length + 200);
  assert.ok(IDEA_SYSTEM.length > 40);
});

test('readLocalIdea: the JSON object in a reply, or nothing', () => {
  assert.deepEqual(readLocalIdea('Sure! {"idea": "x", "uses": []} hope that helps'), { idea: 'x', uses: [] });
  assert.equal(readLocalIdea('no json here'), null);
  assert.equal(readLocalIdea('} backwards {'), null);
  assert.equal(readLocalIdea('{not json}'), null);
  assert.equal(readLocalIdea('[1,2]'), null);
  assert.equal(readLocalIdea('{"a":1}'.replace('{', '[')), null);
  assert.equal(readLocalIdea(null), null);
  assert.deepEqual(readLocalIdea('{"idea": "starts at once"}'), { idea: 'starts at once' }, 'a reply that is only the object');
  assert.equal(readLocalIdea('{"idea": "no close"'), null);
});

test('similarity: shared words over all words', () => {
  assert.equal(similarity('build the mesh relay', 'build the mesh relay'), 1);
  assert.equal(similarity('alpha beta', 'gamma delta'), 0);
  assert.equal(similarity('', ''), 1);
  assert.equal(similarity('alpha beta gamma', 'alpha beta delta'), 0.5);
  assert.equal(similarity('a b c', 'a b c'), 1, 'one-letter words do not count — every word is too short, so both are empty');
  assert.equal(similarity('ab cd', 'ab ef'), 1, 'nor do two-letter ones');
  assert.equal(similarity('', 'alpha beta'), 0, 'nothing shares nothing with something');
  assert.equal(similarity('alpha beta', ''), 0);
  assert.equal(similarity('alpha bravo charlie delta', 'alpha bravo charlie echo'), 0.6);
});

test('the five checks, each on its own edge', () => {
  const repos = new Set(['fall-os', 'didy', 'fall-kit']);
  const ctx = { pair: ['fall-os', 'didy'], repos, others: [] };
  const good = { idea: 'Run didy as the conductor inside fall-os.', uses: ['fall-os', 'didy'], firstStep: 'Wire didy into the fall-os control loop.', why: 'One loop, owned.' };
  assert.deepEqual(ideaChecks(good, ctx), { shaped: true, grounded: true, plain: true, concrete: true, fresh: true, passes: true });
  const fail = (patch, key) => { const r = ideaChecks({ ...good, ...patch }, ctx); assert.equal(r[key], false, key + ' ' + JSON.stringify(patch)); assert.equal(r.passes, false); };
  fail({ idea: 'too short' }, 'shaped');
  fail({ why: 'short' }, 'shaped');
  fail({ firstStep: 'Wire didy into fall-os.' }, 'shaped');
  fail({ uses: 'fall-os' }, 'shaped');
  fail({ idea: 5 }, 'shaped');
  fail({ uses: ['fall-os', 'nonesuch'] }, 'grounded');
  fail({ uses: ['fall-kit'] }, 'grounded');
  fail({ uses: [] }, 'grounded');
  fail({ uses: ['fall-os', 7] }, 'grounded');
  fail({ why: 'It regulates the wobble.' }, 'plain');
  fail({ idea: 'Use the +1 term to steer fall-os and didy.' }, 'plain');
  fail({ uses: ['fall-os', 'didy'], firstStep: 'Open the editor and write the first test file now.' }, 'concrete');
  fail({ idea: 'fall-os bundled with didy as a paired offer for whoever runs fall-kit.' }, 'fresh');
  assert.equal(ideaChecks(good, { ...ctx, others: [good.idea] }).fresh, false, 'the same idea twice is not fresh');
  assert.equal(ideaChecks(good, { ...ctx, others: ['something else entirely different words'] }).fresh, true);
  assert.equal(ideaChecks({ ...good, idea: 'alpha bravo charlie delta' }, { ...ctx, others: ['alpha bravo charlie echo'] }).fresh, true, 'sharing exactly 60% of the words is still fresh');
  assert.equal(ideaChecks({ ...good, idea: 'alpha bravo charlie delta' }, { ...ctx, others: ['alpha bravo charlie delta foxtrot'] }).fresh, false, 'sharing more is not');
  assert.equal(ideaChecks('a string', ctx).shaped, false);
  assert.equal(ideaChecks({ ...good, firstStep: 'Wire DIDY into the control loop now.' }, ctx).concrete, true, 'names are matched in any case');
  assert.equal(ideaChecks({ ...good, firstStep: 'one two three four five six' }, ctx).shaped, true, 'six words is enough');
  assert.equal(ideaChecks({ ...good, idea: 'x'.repeat(20) }, ctx).shaped, true, 'twenty characters is enough');
  assert.equal(ideaChecks({ ...good, why: 'y'.repeat(10) }, ctx).shaped, true);
  assert.equal(ideaChecks(null, ctx).passes, false);
  assert.equal(ideaChecks([good], ctx).shaped, false);
  assert.deepEqual(ideaChecks(good, null), { shaped: true, grounded: false, plain: true, concrete: false, fresh: true, passes: false });
  assert.equal(ideaChecks(good, { pair: ['fall-os', 'didy'], repos: ['fall-os', 'didy'] }).grounded, false, 'repos must be a set');
  assert.equal(ideaChecks(good, { ...ctx, others: 'x' }).fresh, true);
  assert.equal(ideaChecks(good, { ...ctx, pair: [5, ''] }).concrete, false);
  assert.ok(FRAME.test('a phi term') && !FRAME.test('philosophy'));
  assert.ok(TEMPLATE.test('A bundled with B as a paired offer'));
});

