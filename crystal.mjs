#!/usr/bin/env node
// crystal.mjs — the exact-facts floor of the cognitive stack's memory architecture, built alone, wired to nothing.
// Kar's own build, 2026-09-25, after grounding (not trusting) the spec against what's actually on
// disk: DODECA (fall-remember, real, 17 files) and ICOSA (the-dreamer, real, small) exist; CRYSTAL did
// not. This is CRYSTAL, and only CRYSTAL — no strands, no wiring to the other organs, one shell.
//
// PROVENANCE, held the way the Floyd provenance rule requires: the distinct-organs memory architecture
// this floor belongs under is Gary W. Floyd's — Lumiea Systems Research Division, ThunderStruck
// Service LLC, "NEXUS — Distributed Synthetic Intelligence" (2026) and "Dream State Architecture"
// (2025). Credited in full, verbatim. The estate's solid-shape naming (crystal/octa/dodeca/icosa/tetra)
// is the estate's own lens over that architecture, not Gary's terms — nothing in this file's own
// logic is geometry; it is a plain key/provenance store. Built on the Konomi method (Thomas Frumkin).
//
// THE ONE CLAIM THIS FILE EARNS TONIGHT, and only once the gate below proves it: exact recall that
// provably cannot drift. Nothing about "beats RAG" or "beats the frontier" is asserted here — that
// is an open question for something else to test CRYSTAL against, not a line this file gets to write
// about itself.
//
// Design, deliberately plain: NO embeddings, NO similarity/vector matching, NO normalization of
// keys or sources (no trimming, no case-folding) — two lexically distinct strings are always two
// distinct facts, full stop. A key can hold more than one fact over time (different sources
// asserting different things) — read() without a source returns the most recent; read() WITH a
// source returns exactly that source's fact, never blended with any other source's. Total: every
// function returns {ok:false, why} on bad input, never throws.
export function createCrystal() {
  const store = new Map(); // key (string) -> array of {value, source, ts}, append-only, in write order

  function write(key, value, source, ts) {
    if (typeof key !== 'string' || !key) return { ok: false, why: 'key must be a non-empty string' };
    if (typeof source !== 'string' || !source) return { ok: false, why: 'source must be a non-empty string' };
    if (typeof ts !== 'number' || !Number.isFinite(ts)) return { ok: false, why: 'ts must be a finite number' };
    if (value === undefined) return { ok: false, why: 'value must be provided (undefined is not a fact)' };
    if (!store.has(key)) store.set(key, []);
    store.get(key).push({ value, source, ts });
    return { ok: true, key, source, ts };
  }

  // read(key, source?) — the load-bearing exact-match logic. Without `source`, the candidate set is
  // every fact ever written under `key`; with `source`, the candidate set is narrowed to exactly the
  // facts that source wrote (strict === — never startsWith/includes, never coerced). Whichever
  // candidate set applies, the winner is the one with the highest ts; on an exact tie, the LATER
  // write (by array/write order) wins — `>=` while iterating in write order, not `>`.
  function read(key, source) {
    if (typeof key !== 'string' || !key) return { ok: false, why: 'key must be a non-empty string' };
    const recs = store.get(key);
    if (!recs || recs.length === 0) return { ok: false, why: 'no fact recorded for that key' };
    let candidates = recs;
    if (source !== undefined) {
      if (typeof source !== 'string' || !source) return { ok: false, why: 'source must be a non-empty string when given' };
      candidates = recs.filter((r) => r.source === source);
      if (candidates.length === 0) return { ok: false, why: 'no fact recorded for that key from that source' };
    }
    let best = candidates[0];
    for (const r of candidates) { if (r.ts >= best.ts) best = r; }
    return { ok: true, key, value: best.value, source: best.source, ts: best.ts };
  }

  // history(key) — every fact ever recorded under key, in write order, untouched. The audit trail
  // that proves read()'s answer isn't hiding a blend: nothing here is ever merged or dropped.
  function history(key) {
    if (typeof key !== 'string' || !key) return { ok: false, why: 'key must be a non-empty string' };
    const recs = store.get(key) || [];
    return { ok: true, key, facts: recs.map((r) => ({ value: r.value, source: r.source, ts: r.ts })) };
  }

  // `store.get(key).length > 0` would be genuinely redundant here — write() never creates an entry
  // in `store` without immediately pushing a fact into it, so any key present in `store` already has
  // at least one fact by construction; a separate length check can never observe a different answer,
  // so it was removed rather than defended with a test that can't actually distinguish it.
  function has(key) { return typeof key === 'string' && store.has(key); }
  function size() { return store.size; }

  return { write, read, history, has, size };
}
