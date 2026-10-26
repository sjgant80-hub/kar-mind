// controller-flow.test.mjs — nightIdea: the nightly idea's flow, with the wires faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nightIdea, IDEA_SYSTEM, IDEA_SCHEMA } from './controller.mjs';

const idea = { idea: 'Run didy as the conductor inside fall-os.', uses: ['fall-os', 'didy'], firstStep: 'Wire didy into the fall-os control loop.', why: 'One loop, owned.' };
const local = async () => ({ text: 'Sure: {"idea": "a local idea that is long enough"}', model: 'qwen2.5:7b' });
const base = () => {
  const calls = [], saved = [];
  return {
    calls, saved,
    deps: { pair: ['fall-os', 'didy'], night: '2026-10-25', budget: 100000, ceiling: 30000, local,
      think: async (c) => { calls.push(c); return { ok: true, structured: idea, tokens: 900, model: 'claude-opus-4-8', turns: 1, denials: 0 }; },
      save: async (s) => { saved.push(s.wallet.budget.spent); } },
  };
};

test('frontier when the budget fits and it answers; the ceiling is saved as spent before the call', async () => {
  const { calls, saved, deps } = base();
  const r = await nightIdea(deps);
  assert.deepEqual([r.tier, r.fallback, r.tokens, r.model, r.turns, r.denials], ['frontier', false, 900, 'claude-opus-4-8', 1, 0]);
  assert.deepEqual(r.idea, idea);
  assert.equal(r.why, '"propose" is judgement: the frontier');
  assert.deepEqual(saved, [30000]);
  assert.equal(r.state.wallet.budget.spent, 30000);
  assert.equal(r.state.night, '2026-10-25');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].system, IDEA_SYSTEM);
  assert.equal(calls[0].schema, IDEA_SCHEMA);
  assert.equal(calls[0].prompt, r.prompt);
  assert.match(r.prompt, /- fall-os\n- didy/);
  assert.equal((await nightIdea({ ...deps, save: undefined })).tier, 'frontier', 'no save given still works');
});

test('the frontier does not answer: the local model makes the idea, and the record says why', async () => {
  const { deps } = base();
  const down = await nightIdea({ ...deps, think: async () => ({ ok: false, why: 'no claude CLI on this machine' }) });
  assert.deepEqual([down.tier, down.fallback, down.model, down.tokens, down.turns], ['local', true, 'qwen2.5:7b', 0, 0]);
  assert.equal(down.why, 'the frontier did not answer (no claude CLI on this machine): the local model, as a fallback');
  assert.deepEqual(down.idea, { idea: 'a local idea that is long enough' });
  assert.equal(down.state.wallet.budget.spent, 30000, 'the ceiling stays spent: the call was attempted');
  const bad = [async () => { throw new Error('x'); }, async () => null, async () => ({ ok: true, structured: null }), async () => ({ ok: true, structured: 'x' }), async () => 'x', async () => ({ ok: false }), async () => ({ ok: 'yes', structured: idea })];
  for (const think of bad) {
    const x = await nightIdea({ ...deps, think });
    assert.deepEqual([x.tier, x.fallback, x.model], ['local', true, 'qwen2.5:7b']);
    assert.match(x.why, /^the frontier did not answer \(.+\): the local model, as a fallback$/);
  }
  assert.match((await nightIdea({ ...deps, think: async () => ({ ok: false, why: 7 }) })).why, /\(no reply\)/);
  assert.match((await nightIdea({ ...deps, think: async () => null })).why, /\(no reply\)/);
});

test('no budget left tonight: straight to the local model, the frontier never called, nothing spent', async () => {
  const { deps } = base();
  let thought = 0;
  const state = { night: '2026-10-25', wallet: { id: 'kar-cortex', caps: ['think'], budget: { total: 100000, spent: 90000 } } };
  const r = await nightIdea({ ...deps, state, think: async () => { thought++; return null; } });
  assert.deepEqual([r.tier, r.fallback, thought], ['local', true, 0]);
  assert.match(r.why, /budget is spent/);
  assert.equal(r.state.wallet.budget.spent, 90000);
  assert.equal(r.model, 'qwen2.5:7b');
});

test('the local model fails too: no idea, and nothing invented', async () => {
  const { deps } = base();
  const none = await nightIdea({ ...deps, think: async () => null, local: async () => { throw new Error('off sick'); } });
  assert.deepEqual([none.idea, none.model], [null, null]);
  const odd = await nightIdea({ ...deps, think: async () => null, local: async () => ({ text: '{}', model: 5 }) });
  assert.deepEqual([odd.idea, odd.model], [{}, null]);
  const junk = await nightIdea({ ...deps, think: async () => null, local: async () => 'x' });
  assert.deepEqual([junk.idea, junk.model], [null, null]);
  assert.equal((await nightIdea(null)).tier, 'local', 'no deps, no budget: local');
});
