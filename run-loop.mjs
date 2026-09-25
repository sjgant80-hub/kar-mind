#!/usr/bin/env node
// run-loop.mjs — AUTONOMY. The mind's own run-loop: from a single start it pulls its own stimuli
// from a perception source and drives the full cognitive cascade (perceive→verify→consolidate for a
// fact, dream for episodes, route for a signal) over and over on its own, moving real organ state
// without a caller per step. A governed loop: it runs steps back-to-back until its work is spent
// (dead air → stop loudly) or a safety cap is hit — never an unbounded runaway.
//
// ⚑ SAFETY BY CONSTRUCTION, not by good behaviour: this file imports NOTHING of the export door. The
// autonomous loop can perceive, verify, consolidate, dream, and route — all cognition, all reversible,
// all inside the mind's own memory — but it has no reference to `confirmExport`, no money verb, and no
// publish verb, so an irreversible outside-world action is unreachable from here. The mind thinks and
// remembers on its own; it cannot spend or publish on its own, and that is a wall, not a promise. A
// gate (run-loop.test.mjs) proves a full autonomous run leaves the export door untouched.
//
// Pure and deterministic given its source and clock: `now` is injectable, the source is the caller's,
// and tick() never sleeps — so the loop is fully testable without real time. The async time-spacing
// and the persist-each-tick step live in the persistent glue (mind-persistent.mjs), off this kernel.
export function createRunLoop({ mind, source, now = Date.now } = {}) {
  if (!mind || typeof mind.think !== 'function') throw new Error('run-loop requires a live mind');
  if (!source || typeof source.next !== 'function') throw new Error('run-loop requires a source with a next() method');
  if (typeof now !== 'function') throw new Error('now must be a function');
  let acted = 0;

  // tick() — pull ONE stimulus and drive the matching cascade. Returns a receipt. A dry source
  // (next() → null/undefined) is reported as acted:false, the signal the run loop stops on.
  function tick() {
    const stim = source.next();
    if (stim === null || stim === undefined) return { ok: true, acted: false, reason: 'source-dry' };
    if (typeof stim !== 'object' || typeof stim.kind !== 'string') return { ok: false, acted: false, why: 'a stimulus must be an object with a string kind' };
    const at = now();
    if (stim.kind === 'fact') {
      const receipt = mind.think(stim.fact || {}, { recall: stim.recall || { ageMs: 0, halfLifeMs: 100000, accessCount: 0 }, routeSignature: stim.routeSignature });
      acted++;
      return { ok: receipt.ok, acted: receipt.ok, kind: 'fact', at, receipt };
    }
    if (stim.kind === 'episodes') {
      const r = mind.dream({ episodes: stim.episodes, day: stim.day, minInstances: stim.minInstances || 2, source: stim.source || 'loop' });
      acted += r.ok ? 1 : 0;
      return { ok: r.ok, acted: r.ok, kind: 'episodes', at, generated: r.generatedCount || 0, promoted: r.promotedCount || 0 };
    }
    if (stim.kind === 'signal') {
      const r = mind.route(stim.signal, { now: at });
      acted += r.ok ? 1 : 0;
      return { ok: r.ok, acted: r.ok, kind: 'signal', at, birthed: !!r.birthed, matched: !!r.matched };
    }
    return { ok: false, acted: false, why: 'unknown stimulus kind: ' + stim.kind };
  }

  // run({maxTicks}) — the autonomous drive: from this one call, tick() runs up to maxTicks times,
  // stopping the moment the source goes dry (dead air, reported plainly, stopping
  // rather than running empty windows). Returns the real state delta across the whole run — proof the
  // mind moved its own state without a caller per step.
  function run({ maxTicks = 100 } = {}) {
    if (!Number.isInteger(maxTicks) || maxTicks < 1) return { ok: false, why: 'maxTicks must be a positive integer' };
    const before = mind.snapshot();
    const steps = [];
    let stopped = 'max-ticks';
    for (let i = 0; i < maxTicks; i++) {
      const t = tick();
      steps.push(t);
      if (!t.acted) { stopped = t.reason === 'source-dry' ? 'source-dry' : 'refused'; break; }
    }
    const after = mind.snapshot();
    return {
      ok: true, stopped,
      ticksActed: steps.filter((s) => s.acted).length,
      steps, before, after,
      delta: {
        crystalFacts: after.crystalFacts - before.crystalFacts,
        dodecaMemories: after.dodecaMemories - before.dodecaMemories,
        dreamFacts: after.dreamFacts - before.dreamFacts,
        bornDomains: after.bornDomains - before.bornDomains,
      },
    };
  }

  return { tick, run, actedCount: () => acted };
}

// queueSource(items) — a simple, drainable perception source for driving a loop: next() yields the
// next queued stimulus and removes it, then null forever once empty. A real deployment would swap this
// for a durable inbox / sensor feed; the loop does not care which, it only calls next().
export function queueSource(items = []) {
  const q = Array.isArray(items) ? items.slice() : [];
  return { next: () => (q.length ? q.shift() : null), push: (x) => q.push(x), size: () => q.length };
}
