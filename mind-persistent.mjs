#!/usr/bin/env node
// mind-persistent.mjs — the glue that makes the mind persistent AND autonomous together: boot a mind
// from its durable journal, let its run-loop drive cognition on its own, and persist each tick. Ungated
// async glue around three gated kernels (mind.mjs, persist.mjs, run-loop.mjs) — the same split
// disk.mjs uses around store.mjs. Its behaviour is proven by mind-persist.test.mjs (state survives a
// real restart) rather than by witnessing this orchestration layer.
import { createJournal } from './persist.mjs';
import { rebuildMind } from './mind.mjs';
import { createRunLoop } from './run-loop.mjs';

// bootMind({dir, roots?, ...mindOpts}) — THE RESTART ENTRY. Open the durable journal, replay it to
// reconstruct every organ, and hand back a live, journaling mind wired to keep persisting. Called on
// a cold start it yields an empty mind; called again on the same dir it yields the mind exactly as it
// was left (organ counts intact). Total: a load/rebuild failure returns {ok:false, why}, never throws.
export async function bootMind({ dir, roots, ...mindOpts } = {}) {
  let journal;
  try { journal = createJournal({ dir, roots }); }
  catch (e) { return { ok: false, why: 'could not open journal: ' + e.message }; }
  const loaded = await journal.load();
  if (!loaded.ok) return { ok: false, why: 'journal load failed: ' + loaded.why };
  const rebuilt = rebuildMind(loaded.events, mindOpts);
  if (!rebuilt.ok) return { ok: false, why: 'rebuild failed: ' + rebuilt.why };
  return {
    ok: true,
    mind: rebuilt.mind,
    journal,
    restoredFrom: loaded.fresh ? null : journal.path,
    replayed: rebuilt.replayed,
    skipped: rebuilt.skipped,
    snapshot: rebuilt.mind.snapshot(),
  };
}

// persistMind(journal, mind) — seal the mind's current event log to disk. Idempotent, whole-state.
export async function persistMind(journal, mind) {
  if (!journal || typeof journal.flush !== 'function') return { ok: false, why: 'need a live journal' };
  if (!mind || typeof mind.events !== 'function') return { ok: false, why: 'need a journaling mind' };
  return journal.flush(mind.events());
}

// runAutonomous({mind, journal, source, maxTicks, cadenceMs, now, sleep}) — start the mind's own loop
// and let it run: each tick drives one cognitive cascade and then persists itself, on its own cadence,
// until the source is dry or the safety cap is hit. This is the autonomous, persistent mind actually
// running — from one call it moves and durably records its own state, with no caller per step. It
// still cannot reach the export door (run-loop.mjs has no path to it), so nothing irreversible leaves
// the machine unattended.
export async function runAutonomous({ mind, journal, source, maxTicks = 100, cadenceMs = 0, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  if (!mind || typeof mind.snapshot !== 'function') return { ok: false, why: 'need a live mind' };
  const loop = createRunLoop({ mind, source, now });
  const before = mind.snapshot();
  const steps = [];
  for (let i = 0; i < maxTicks; i++) {
    const t = loop.tick();
    if (!t.acted) { steps.push(t); break; }        // dead air → stop
    const f = journal ? await journal.flush(mind.events()) : { ok: true, bytes: 0 };
    t.persisted = f.ok;
    t.journalBytes = f.bytes || 0;
    steps.push(t);
    if (cadenceMs > 0) await sleep(cadenceMs);      // its own cadence between beats
  }
  const after = mind.snapshot();
  return {
    ok: true,
    ticksActed: steps.filter((s) => s.acted).length,
    persistedEveryActedTick: steps.filter((s) => s.acted).every((s) => s.persisted),
    steps, before, after,
    delta: {
      crystalFacts: after.crystalFacts - before.crystalFacts,
      dodecaMemories: after.dodecaMemories - before.dodecaMemories,
      dreamFacts: after.dreamFacts - before.dreamFacts,
      bornDomains: after.bornDomains - before.bornDomains,
    },
  };
}
