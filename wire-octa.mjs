#!/usr/bin/env node
// wire-octa.mjs — THE EDGE: crystal (facts, possibly multi-source) -> Veridia's real cross-check ->
// dodeca (meaning). Read fallforgecell/kernel.mjs in full before writing this (666 lines, all
// exports scanned, the core triangle logic read closely) — its own README calls itself "the cell,"
// not a verify organ by name, but its real function is exactly a verify: three independent nodes
// answer the same thing, adjudicated per field, a confidently-wrong single source gets caught by
// disagreement with the other two. That IS octa's real capability, confirmed from the code, not
// assumed from the spec's name for it.
//
// HONEST SHAPE OF THE FIT: Veridia's adjudicate() cross-checks independent NODES answering the SAME
// task, not "a candidate fact against an existing store." The genuine bridge is that crystal already
// stores multiple independent SOURCES per key (built that way from the start, for exactly this kind
// of no-drift reason) — a key with 3+ source-facts recorded in crystal IS structurally the same shape
// as Veridia's "panel." This wiring feeds crystal's real history() straight into Veridia's real
// adjudicate(), using each source as the model fingerprint. Nothing about Veridia's own logic is
// reimplemented here — the panel-independence refusal, the per-field verdicts, all its own code.
import { adjudicate } from '../fallforgecell/kernel.mjs';

// verifyBeforePromote: gather every independent source's claim for a key from a real crystal
// instance and run them through Veridia's real adjudicate(). Returns Veridia's own verdict, not a
// fabricated pass — if there aren't enough independent sources yet, or the panel isn't independent,
// or a field is contested, that is reported exactly as Veridia itself reports it.
export function verifyBeforePromote({ crystal, key }) {
  if (!crystal || typeof crystal.history !== 'function') return { ok: false, why: 'crystal must be a live crystal instance' };
  if (typeof key !== 'string' || !key) return { ok: false, why: 'key must be a non-empty string' };
  const h = crystal.history(key);
  if (!h.ok) return { ok: false, why: h.why };
  if (h.facts.length < 3) return { ok: false, why: `Veridia needs at least 3 independent claims to cross-check — only ${h.facts.length} recorded for this key` };
  const answers = h.facts.map((f) => ({ value: f.value }));
  const fingerprints = h.facts.map((f) => f.source);
  const verdict = adjudicate(answers, fingerprints); // the real organ's real call, unmodified
  return { ok: true, key, verdict };
}
