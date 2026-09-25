#!/usr/bin/env node
// wire-icosa.mjs — THE EDGE: the-dreamer (real generate organ) -> crystal (the loop closes).
//
// HONEST SPLIT, read from the-dreamer's real API before writing a line of this file (dreamer.mjs
// read in full, all 211 lines): dreamCycle() genuinely GENERATES new facts — its own words, "this is
// knowledge that lived in NO single episode" — inferred, provenance-tracked, confidence-scored
// (facts.inferred===true, store.day-stamped, conf = supporters/known). That IS icosa's real generate
// capability, verified from its own code, not assumed from the spec.
//
// What dreamer.mjs does NOT do: write its generations anywhere outside its own store. There is no
// loop-back to crystal in its API — "the best generations promote back to crystal as new verified
// facts" is THIS wiring's job, not a capability the-dreamer already has. Don't credit it with more
// than its own code does.
import { emptyStore, ingest, dreamCycle } from '../the-dreamer/dreamer.mjs';
import { recallScore, strandDecision } from './strand.mjs';

// dreamAndPromote: ingest real episodes into a real dreamer store, run a real dream cycle (its own
// state genuinely changes — store.facts grows, report.generalized counts it), then run each NEWLY
// generated fact from THIS cycle through the strand's real recall decision (confidence as base
// score, fresh, evidence as access count) — only what the strand says 'promote' crosses back into a
// real crystal instance. Total: never throws.
export function dreamAndPromote({ store, crystal, episodes, day, minInstances = 2, source, halfLifeMs = 100000 }) {
  if (!crystal || typeof crystal.write !== 'function') return { ok: false, why: 'crystal must be a live crystal instance' };
  if (typeof source !== 'string' || !source) return { ok: false, why: 'source must be a non-empty string' };
  if (!Array.isArray(episodes)) return { ok: false, why: 'episodes must be an array' };
  const s = store || emptyStore();

  ingest(s, episodes, day);
  const report = dreamCycle(s, { minInstances });

  const promoted = [];
  for (const f of s.facts.values()) {
    if (!f.inferred || f.firstDay !== s.day) continue; // only facts THIS cycle actually generated
    const sc = recallScore({ base: f.conf, ageMs: 0, halfLifeMs, accessCount: f.evidence });
    if (!sc.ok) continue;
    const d = strandDecision({ score: sc.score });
    if (d.decision !== 'promote') continue;
    const key = `${f.s}|${f.p}|${f.o}`;
    const w = crystal.write(key, f.o, source, Date.now());
    if (w.ok) promoted.push({ key, value: f.o, confidence: f.conf, evidence: f.evidence });
  }

  return { ok: true, store: s, report, generatedCount: report.generalized, promotedCount: promoted.length, promoted };
}
