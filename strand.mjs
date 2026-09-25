#!/usr/bin/env node
// strand.mjs — the scoring-and-movement kernel: pure, deterministic, total. wired to nothing yet
// (CUBE and the real organs are the next step, after this is proven in isolation).
//
// PROVENANCE, fully re-grounded (2026-09-25) — this time against Thomas Frumkin's ACTUAL readable
// source, not filename mentions: read in full — Downloads/fallmind-v2/core/{cube.js, db.js,
// system.js, block-array.js, femtollm.js} (the real, faithful JS port of his MianoCube/cube.py spec)
// and Downloads/konomi-cube/README.md (his recursive-cube geometry piece).
//
// VERIFIED THOMAS FRUMKIN, credited in full: the 9-node cube (8 vertices + 1 central "CEN"
// resolver, "1 Cube = 1 Neuron"), the FemtoLLM per-node forward pass, and the real architectural
// principle this strand's own design resonates with — "the cube processes, the database persists"
// (db.js's own comment, quoting him: "it's a database · you store data in it"). Konomi is the real
// seed this whole architecture forks from, per the Konomi provenance rule — lean credit: "Konomi
// architecture, created by Thomas Frumkin."
//
// CHECKED AND NOT FOUND, said plainly rather than faked: no recall/decay/reinforcement/tier-
// promotion formula exists anywhere in his readable source. The only "decay" concept in his real
// material is the recursive cube's VISUAL SPIN RATE slowing with nesting depth (an animation/geometry
// property, README: "the spin rate decays with depth") — a different thing from a memory item's
// recall decaying over time, and I'm not conflating the two just because both use the word "decay."
//
// A real naming collision was found and then FIXED (2026-09-25): his `Cube` class means a 9-node
// COMPUTE unit ("1 Cube = 1 Neuron"). This file used to reuse "cube" as a memory-SHELF name too —
// renamed to "crystal" (the spec's own phrase, "the precise crystalline store") specifically so the
// two never collide. Thomas's Cube stays his; the estate's exact-facts shelf has its own name now.
//
// Since no Thomas-verified recall formula exists to supersede them, Gary W. Floyd's NEXUS/Dream
// State Architecture papers remain a genuine RESONANCE — not the origin — credited in full ONLY for
// the two specific, exact, verified numbers below that were actually read out of his real papers:
//   - Dream State Architecture (Floyd, 2025) Section 3.2.2 Phase 5: "wake_ethical_composite >= 0.7:
//     remember" / "< 0.5: forget" / "else: flag_review" — reused as the THRESHOLD SHAPE (his exact
//     numbers) for this strand's own recall score, not a claim this IS his ethical filter.
//   - Dream State Architecture Section 4.3, step 5: "cleanup_forgotten_dreams() # Delete old noise"
//     scheduled "7 days later" — reused honestly as EXPIRE_GRACE_MS below.
//
// ESTATE CHOICES — explicitly not verified against any primary source, chosen because neither
// Konomi's accessible materials nor Gary's papers specify a closed form for these:
//   - the exponential decay curve and log-diminishing reinforcement in recallScore()
//   - "expire" as a fourth state beyond Gary's three (remember/forget/flag)
//   - the solid-shape shelf names (cube/octa/dodeca/icosa) — the estate's own lens
//
// Total: every function returns {ok:false, why} on bad input, never throws.

// -- recallScore: estate-choice implementation of the concepts NEXUS's E(x) names but does not close --
export function recallScore({ base, ageMs, halfLifeMs, accessCount }) {
  if (typeof base !== 'number' || !Number.isFinite(base)) return { ok: false, why: 'base must be a finite number' };
  if (typeof ageMs !== 'number' || !Number.isFinite(ageMs) || ageMs < 0) return { ok: false, why: 'ageMs must be a non-negative finite number' };
  if (typeof halfLifeMs !== 'number' || !Number.isFinite(halfLifeMs) || halfLifeMs <= 0) return { ok: false, why: 'halfLifeMs must be a positive finite number' };
  if (typeof accessCount !== 'number' || !Number.isFinite(accessCount) || accessCount < 0) return { ok: false, why: 'accessCount must be a non-negative finite number' };
  const decay = Math.pow(0.5, ageMs / halfLifeMs);          // estate choice: exponential recency decay (wr(t))
  const reinforcement = 1 + Math.log1p(accessCount) * 0.1;  // estate choice: diminishing-returns reinforcement (f_usage analogue)
  const raw = base * decay * reinforcement;
  const score = Math.max(0, Math.min(1, raw));
  return { ok: true, score, decay, reinforcement };
}

// Gary's exact numbers (Dream State Architecture Section 3.2.2, Phase 5), reused as the threshold
// SHAPE for this strand's own recall score -- not a claim that this score IS his ethical composite.
export const PROMOTE_AT = 0.7;  // his "remember" threshold, exact
export const FLOOR_AT = 0.5;    // his "forget" threshold, exact
// His real 7-day cleanup interval (Dream State Architecture Section 4.3, step 5), reused as the grace
// window before an item below the floor is actually removed rather than merely demoted.
export const EXPIRE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

// strandDecision: the promote/hold/decay/expire call, against Gary's exact threshold numbers.
export function strandDecision({ score, msBelowFloor = 0 }) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return { ok: false, why: 'score must be a finite number' };
  if (typeof msBelowFloor !== 'number' || !Number.isFinite(msBelowFloor) || msBelowFloor < 0) return { ok: false, why: 'msBelowFloor must be a non-negative finite number' };
  if (score >= PROMOTE_AT) return { ok: true, decision: 'promote' };
  if (score < FLOOR_AT) {
    if (msBelowFloor >= EXPIRE_GRACE_MS) return { ok: true, decision: 'expire' };
    return { ok: true, decision: 'decay' };
  }
  return { ok: true, decision: 'hold' }; // his 0.5-0.7 "flag_review" band, renamed for the strand's general context
}

// -- the estate's own solid-lens shelf ordering (never Gary's terms) --
const SHELF_ORDER = ['crystal', 'octa', 'dodeca', 'icosa'];

// applyDecision: the REAL state transition -- proves movement, not a label. Given the item's
// CURRENT shelf and a decision, returns where it actually ends up.
export function applyDecision(currentShelf, decision) {
  if (typeof currentShelf !== 'string' || !SHELF_ORDER.includes(currentShelf)) return { ok: false, why: 'currentShelf must be one of ' + SHELF_ORDER.join(', ') };
  if (typeof decision !== 'string' || !['promote', 'hold', 'decay', 'expire'].includes(decision)) return { ok: false, why: "decision must be one of promote, hold, decay, expire" };
  if (decision === 'expire') return { ok: true, shelf: null, expired: true };
  if (decision === 'hold') return { ok: true, shelf: currentShelf, expired: false };
  const idx = SHELF_ORDER.indexOf(currentShelf);
  if (decision === 'promote') return { ok: true, shelf: SHELF_ORDER[Math.min(idx + 1, SHELF_ORDER.length - 1)], expired: false };
  return { ok: true, shelf: SHELF_ORDER[Math.max(idx - 1, 0)], expired: false }; // decay
}

export const SHELVES = SHELF_ORDER.slice();
