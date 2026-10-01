// The persistent glue's own edges, beyond mind-persist.test.mjs's restart proof: its refusals, its safety
// cap, its cadence, and the journal size it reports per beat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { persistMind, runAutonomous } from './mind-persistent.mjs';

const mindStub = () => ({ events: () => [{ t: 'x' }], snapshot: () => ({ crystalFacts: 0, dodecaMemories: 0, dreamFacts: 0, bornDomains: 0 }), think: () => ({ ok: true }) });

test('persistMind refuses what is not a journal or not a journaling mind', async () => {
  const mind = mindStub();
  for (const j of [null, {}, { flush: 'x' }]) assert.deepEqual(await persistMind(j, mind), { ok: false, why: 'need a live journal' });
  const journal = { flush: async (events) => ({ ok: true, count: events.length }) };
  for (const m of [null, {}, { events: 5 }]) assert.deepEqual(await persistMind(journal, m), { ok: false, why: 'need a journaling mind' });
  assert.deepEqual(await persistMind(journal, mind), { ok: true, count: 1 });
});

test('runAutonomous refuses a dead mind, stops at its cap, keeps its cadence, and reports the journal size', async () => {
  for (const m of [null, {}, { snapshot: 'x' }]) assert.deepEqual(await runAutonomous({ mind: m }), { ok: false, why: 'need a live mind' });
  const forever = { next: () => ({ kind: 'signal', signature: 'x' }) };
  const slept = [];
  const journal = { flush: async () => ({ ok: true, bytes: 42 }) };
  let thinks = 0;
  const mind = { ...mindStub(), think: () => { thinks++; return { ok: true }; }, route: () => ({ ok: true }), perceive: () => ({ ok: true }), dream: () => ({ ok: true }) };
  const r = await runAutonomous({ mind, journal, source: forever, maxTicks: 3, cadenceMs: 0, sleep: async (ms) => { slept.push(ms); } });
  assert.equal(r.ok, true);
  assert.equal(r.steps.length, 3, 'the cap is the cap: exactly maxTicks beats, never one more');
  assert.equal(r.ticksActed, 3);
  assert.deepEqual(slept, [], 'a cadence of 0 never sleeps');
  assert.ok(r.steps.filter((s) => s.acted).every((s) => s.journalBytes === 42), 'each beat reports what its flush wrote');
  const timed = await runAutonomous({ mind, journal: null, source: forever, maxTicks: 2, cadenceMs: 5, sleep: async (ms) => { slept.push(ms); } });
  assert.deepEqual(slept, [5, 5]);
  assert.equal(timed.ticksActed, 2);
  assert.ok(timed.steps.filter((s) => s.acted).every((s) => s.journalBytes === 0 && s.persisted === true));
});
