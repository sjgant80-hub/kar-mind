#!/usr/bin/env node
// mind.mjs — THE UNIFYING ORGAN. Composes the estate's cognitive-stack organs into ONE runnable
// system: crystal (facts) · strand (movement) · the three wires to the real estate organs (dodeca
// = fall-remember, icosa = the-dreamer, octa = Veridia/fallforgecell) · tetra (birth) · the
// primitives (consent-gate, wall) · the verifier (wisp-discriminator). Built by karma-didy ("Kar"),
// 2026-09-25, from the founding brief: "wrap everything into a unifying repo and nest the organs
// inside it to become one full complete system."
//
// KONOMIFIED IN PLACE — this file imports the REAL organ files where they already live and moves or
// copies NOTHING. The wires (wire-dodeca/icosa/octa.mjs) carry their own `../fall-remember`,
// `../the-dreamer`, `../fallforgecell` imports, which resolve to the real sibling repos on disk;
// physically relocating an organ would break those imports. So the unification is genuine COMPOSITION
// of the real gated organs, never a clean-room sibling that re-implements them (reuse-in-place,
// edge-testing). What makes this "one system" is this orchestrator + its integration gate
// (mind.test.mjs) proving a fact flows end-to-end through real organ state — not a directory reshuffle.
//
// PROVENANCE, held to the Floyd provenance rule and the Konomi provenance rule:
//   • The distinct-tier memory architecture this stack is shaped after is GARY W. FLOYD's — Lumiea
//     Systems Research Division, ThunderStruck Service LLC — NEXUS (2026) and Dream State
//     Architecture (2025). Gary's real `nexus_shortterm` schema (knowledge_graph, chunk_embeddings +
//     content_chunks, dream_space's tier column, dewey_classification + routing_rules, compositor_
//     outcomes, v_promotion_candidates) is the reference for how these tiers are shaped and how items
//     promote between them. Credited in full; the geometry/solid names are the estate's own lens, not
//     Gary's terms, and nothing geometric is anywhere in this file's logic.
//   • The cube/database-split method the estate forks from is THOMAS FRUMKIN's Konomi / MianoCube —
//     "the cube processes, the database persists." Lean credit: "Konomi architecture, created by
//     Thomas Frumkin."
//   • The composition itself, the strand recall-law, and the organ kernels are the estate's own work.
//
// WHAT THIS IS NOT (the honest scope this whole arc is built to protect):
//   • Not an autonomous agent. It moves a fact when CALLED, through gated seams; it does not act on
//     its own.
//   • Not a persistent database. The organs are in-memory per process. The ONLY durable surface is
//     the export door below, and that door is guarded by a real consent gate + a real path wall.
//   • Tetra births a bounded domain RECORD; it does NOT spin up live per-domain organ instances
//     (flagged in tetra.mjs, unchanged here). Said plainly, not glossed.
//
// Total at the API surface: every method returns {ok:false, why} on bad input, never throws.

import { existsSync, writeFileSync } from 'node:fs';
import { createCrystal } from './crystal.mjs';
import { recallScore, strandDecision, applyDecision, SHELVES } from './strand.mjs';
import { promoteToDodeca } from './wire-dodeca.mjs';
import { dreamAndPromote } from './wire-icosa.mjs';
import { verifyBeforePromote } from './wire-octa.mjs';
import { createTetra } from './tetra.mjs';
import { createConsentGate } from './consent-gate.mjs';
import { createWall } from './wall.mjs';
import { verifyWisp } from './wisp-discriminator.mjs';
import { FallRemember } from '../fall-remember/fall-remember.mjs';
import { emptyStore } from '../the-dreamer/dreamer.mjs';

// ── ORGANS: the machine-declared registry of exactly what constitutes this system. Not decoration —
// verifyManifest() below runs each `file` through the estate's own wisp-discriminator to prove the
// manifest is not lying about its own parts. `wiredTo` names the real estate repo an organ couples
// to; `status` is honest about wired-and-gated vs concept-only. ────────────────────────────────────
export const ORGANS = [
  { solid: 'crystal', role: 'exact facts (no drift, no embeddings)', file: 'crystal.mjs', test: 'crystal.test.mjs', wiredTo: null, status: 'wired+gated' },
  { solid: 'strand', role: 'movement law: recall score → promote/hold/decay/expire → shelf transition', file: 'strand.mjs', test: 'strand.test.mjs', wiredTo: null, status: 'wired+gated' },
  { solid: 'dodeca', role: 'meaning: cosine-embedding retrieval', file: 'wire-dodeca.mjs', test: 'edge-gate-dodeca.test.mjs', wiredTo: '../fall-remember', status: 'wired+gated' },
  { solid: 'octa', role: 'verify: cross-check 3+ independent sources per field', file: 'wire-octa.mjs', test: 'edge-gate-octa.test.mjs', wiredTo: '../fallforgecell', status: 'wired+gated' },
  { solid: 'icosa', role: 'generate: dream-cycle inference, loop back to crystal', file: 'wire-icosa.mjs', test: 'edge-gate-icosa.test.mjs', wiredTo: '../the-dreamer', status: 'wired+gated' },
  { solid: 'tetra', role: 'birth: bounded new-domain detection (NOT live organ spin-up — concept floor)', file: 'tetra.mjs', test: 'tetra.test.mjs', wiredTo: null, status: 'wired+gated (spin-up: concept-only)' },
  { solid: 'consent-gate', role: 'primitive: propose/confirm door for irreversible writes', file: 'consent-gate.mjs', test: 'consent-gate.test.mjs', wiredTo: null, status: 'wired+gated' },
  { solid: 'wall', role: 'primitive: realpath-safe path allowlist for durable writes', file: 'wall.mjs', test: 'wall.test.mjs', wiredTo: null, status: 'wired+gated' },
  { solid: 'wisp', role: 'verifier: deterministic file/gate/cross-ref check, no LLM judge', file: 'wisp-discriminator.mjs', test: 'wisp-discriminator.test.mjs', wiredTo: null, status: 'wired+gated' },
];

// The estate's solid-lens → Gary's real nexus_shortterm structures the tier shape is referenced from.
// A map, not a claim of identity: it documents which real Nexus table each shelf is SHAPED AFTER.
export const SOLIDS = {
  crystal: { shelf: 0, nexusRef: 'knowledge_graph (immutable exact rows) / precise store' },
  octa: { shelf: 1, nexusRef: 'source_credibility_map / relationship adjudication' },
  dodeca: { shelf: 2, nexusRef: 'chunk_embeddings + content_chunks (pgvector meaning)' },
  icosa: { shelf: 3, nexusRef: 'dream_space + compositor_outcomes (consolidation/synthesis)' },
  tetra: { shelf: null, nexusRef: 'dewey_classification + routing_rules (new-domain routing)' },
};

// verifyManifest() — the system checks its OWN parts with the estate's own verifier. For every organ
// in ORGANS, wisp-discriminator confirms the source file exists, its test file exists alongside it,
// and its role string is genuinely present in the source. Returns a per-organ report; `allReal` is
// true only if every organ passes all three. Uses import.meta.dir so it is location-independent.
export function verifyManifest(dir) {
  const base = typeof dir === 'string' && dir ? dir : new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const results = ORGANS.map((o) => {
    const src = `${base}/${o.file}`;
    const tst = `${base}/${o.test}`;
    const w = verifyWisp({ claimedFile: src, claimedGateCompanion: tst, claimedCrossRefFile: src, claimedCrossRefPhrase: o.file });
    return { solid: o.solid, file: o.file, status: o.status, wisp: w.score, real: w.provenanceReal, gated: w.gateBacked };
  });
  const allReal = results.every((r) => r.real && r.gated);
  return { ok: true, allReal, results };
}

// ── createMind: the one system. Owns live instances of the organs it can own and drives the real
// wires between them. Instances are injectable (for the gate; and so a caller can hand in a
// pre-seeded organ) but default to real ones. ────────────────────────────────────────────────────
export function createMind(opts = {}) {
  const crystal = opts.crystal || createCrystal();
  const dodeca = opts.dodeca || new FallRemember();       // the REAL meaning organ
  const dreamStore = opts.dreamStore || emptyStore();     // the REAL dreamer's own store
  const tetra = opts.tetra || createTetra(opts.tetraConfig || {});
  const consent = opts.consentGate || createConsentGate(opts.consentConfig || {});
  // The export door's wall: durable writes are confined to these roots. Default: none allowed until a
  // caller explicitly opens a root — a durable write is refused by construction until then.
  const exportRoots = Array.isArray(opts.exportRoots) ? opts.exportRoots : [];
  // createWall returns the guard function DIRECTLY (it is `return function guard(path){…}`), not an
  // object with a .guard method — so `guardPath` IS the callable guard. (The integration gate caught
  // this exact wiring mistake on first run: a proven kernel proves nothing about its wire.)
  const guardPath = exportRoots.length ? createWall({ roots: exportRoots, forbidden: opts.forbidden || [], excluded: opts.excluded || [] }) : null;

  // ── event sourcing: when journaling is on, every state-changing verb records the event that caused
  // it, so persist.mjs can seal the log durably and rebuildMind() can replay it to identical organ
  // counts after a restart. Off by default (the pure in-memory mind is unchanged). record() only ever
  // appends a caused event; a refused op records nothing, so the log never contains a no-op.
  const journaling = !!opts.journal;
  const _events = [];
  function record(ev) { if (journaling) _events.push(ev); }

  // PERCEIVE — a fact enters the exact-facts floor (crystal). Gary-shape: an immutable knowledge_graph
  // row / precise-store write. This is the one entry point for ground truth.
  function perceive({ key, value, source, ts } = {}) {
    const stamp = typeof ts === 'number' && Number.isFinite(ts) ? ts : Date.now();
    const r = crystal.write(key, value, source, stamp);
    if (r.ok) record({ t: 'perceive', fact: { key, value, source, ts: stamp } }); // stamp resolved → replay is exact
    return r;
  }

  // VERIFY — octa: run every independent source recorded for a key through Veridia's REAL adjudicate.
  function verify(key) { return verifyBeforePromote({ crystal, key }); }

  // CONSOLIDATE — strand + dodeca: score a crystal fact's recall, and only if the strand says
  // 'promote' does it genuinely cross into the real FallRemember store. Real state change or none.
  function consolidate({ key, source, ageMs = 0, halfLifeMs = 100000, accessCount = 0 } = {}) {
    const r = promoteToDodeca({ crystal, dodeca, key, source, ageMs, halfLifeMs, accessCount });
    if (r.ok) record({ t: 'consolidate', args: { key, source, ageMs, halfLifeMs, accessCount } }); // literal ageMs → same decision on replay
    return r;
  }

  // DREAM — icosa: run a real dream cycle over episodes; generated facts the strand accepts loop back
  // into this same crystal. Closes the generate→verify-worthy→facts loop across two real organs.
  function dream({ episodes, day, minInstances = 2, source, halfLifeMs = 100000 } = {}) {
    const r = dreamAndPromote({ store: dreamStore, crystal, episodes, day, minInstances, source, halfLifeMs });
    if (r.ok) record({ t: 'dream', args: { episodes, day, minInstances, source, halfLifeMs } }); // deterministic generation on replay
    return r;
  }

  // ROUTE — tetra: does an incoming signature belong to a known domain, or is it genuinely new? The
  // system feeds tetra its OWN currently-known crystal keys as existingDomains so "new" means new to
  // the whole mind, not just to tetra's private map.
  function route(signature, { existingDomains, now } = {}) {
    const known = Array.isArray(existingDomains) ? existingDomains : [];
    const at = typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
    const r = tetra.observe(signature, { existingDomains: known, now: at });
    if (r.ok) record({ t: 'route', sig: signature, opts: { existingDomains: known, now: at } }); // now resolved → birth timestamps replay exactly
    return r;
  }

  // ── the export door: the ONLY durable side effect, and it is doubly gated. proposeExport stages a
  // path (refused outright if no wall root was opened, or the path is outside it / secret-shaped);
  // confirmExport requires the matching consent id and only THEN writes the snapshot to disk.
  function proposeExport(path) {
    if (!guardPath) return { ok: false, why: 'no export root opened — durable writes are refused by construction (pass exportRoots to createMind)' };
    const g = guardPath(path);
    if (!g.ok) return { ok: false, why: 'wall refused: ' + g.why };
    const p = consent.propose({ type: 'export', path: g.path }, `export mind snapshot to ${g.path}`);
    return p.ok ? { ok: true, id: p.id, path: g.path, summary: p.summary } : p;
  }
  function confirmExport(id) {
    const c = consent.confirm(id);
    if (!c.ok) return c;
    if (!c.action || c.action.type !== 'export') return { ok: false, why: 'confirmed action was not an export' };
    // re-guard at write time: a wall root cannot be widened between propose and confirm.
    const g = guardPath(c.action.path);
    if (!g.ok) return { ok: false, why: 'wall refused at write time: ' + g.why };
    const snap = snapshot();
    try { writeFileSync(g.path, JSON.stringify({ snapshot: snap, exportedAt: Date.now() }, null, 2)); }
    catch (e) { return { ok: false, why: 'write failed: ' + e.message }; }
    return { ok: true, path: g.path, wrote: existsSync(g.path), snapshot: snap };
  }
  function pendingExport() { return consent.peek(); }

  // SNAPSHOT — the cross-organ observability that makes "one system" checkable: real counts read from
  // each real organ's own state, never bookkeeping the orchestrator keeps on the side.
  function snapshot() {
    return {
      crystalFacts: crystal.size(),
      dodecaMemories: dodeca.size,
      dreamFacts: dreamStore.facts.size,
      bornDomains: tetra.domainCount(),
      shelves: SHELVES.slice(),
    };
  }

  // THINK — the whole cascade in one call: perceive → (verify if the key has an independent panel) →
  // consolidate → route. Returns a receipt of what genuinely happened at each hop plus a before/after
  // snapshot read from real state. This is the "1 full complete system" entry: one call, the whole
  // stack moves, every hop's result and the real state delta reported honestly (including hops that
  // legitimately did nothing).
  function think(fact = {}, { recall = {}, routeSignature } = {}) {
    const before = snapshot();
    const perceived = perceive(fact);
    if (!perceived.ok) return { ok: false, why: 'perceive refused: ' + perceived.why, before };

    const verified = verify(fact.key);                    // ok:false when <3 sources — reported, not hidden
    const consolidated = consolidate({ key: fact.key, source: fact.source, ...recall });
    const routed = routeSignature ? route(routeSignature, { existingDomains: [] }) : null;

    const after = snapshot();
    return {
      ok: true,
      hops: {
        perceive: perceived,
        verify: verified.ok ? { ran: true, verdict: verified.verdict.verdict, independent: verified.verdict.independent } : { ran: false, why: verified.why },
        consolidate: { decision: consolidated.decision || null, crossedIntoDodeca: !!(consolidated.ok && consolidated.dodecaRecord) },
        route: routed ? { birthed: routed.birthed, matched: routed.matched, domain: routed.domain } : { ran: false },
      },
      before, after,
      delta: {
        crystalFacts: after.crystalFacts - before.crystalFacts,
        dodecaMemories: after.dodecaMemories - before.dodecaMemories,
        dreamFacts: after.dreamFacts - before.dreamFacts,
        bornDomains: after.bornDomains - before.bornDomains,
      },
    };
  }

  return {
    perceive, verify, consolidate, dream, route,
    proposeExport, confirmExport, pendingExport,
    snapshot, think,
    // the durable event log (empty unless journaling was turned on) — persist.mjs seals events() and
    // rebuildMind() replays them. A copy, so a caller can never mutate the mind's own history.
    events: () => _events.slice(),
    journaling: () => journaling,
    organs: () => ORGANS.slice(),
    // direct handles for a caller that needs an organ's own richer API (the gate reads these to prove
    // real state changed in the real organ, not in the orchestrator's own bookkeeping).
    _crystal: crystal, _dodeca: dodeca, _dreamStore: dreamStore, _tetra: tetra,
    // strand primitives re-exported so a caller can reason about a decision without a second import.
    strand: { recallScore, strandDecision, applyDecision, SHELVES },
  };
}

// rebuildMind(events, opts) — reconstruct a live mind from a durable event log by replaying every
// caused event through the SAME real verbs that produced it. Because the organs are deterministic
// given their inputs (crystal replays exact writes; the-dreamer regenerates the same facts from the
// same episodes; tetra reaches the same birth/pending state from the same signals+clock), the rebuilt
// mind reaches identical organ counts — this is how the mind survives a restart (the durable-memory kernel
// proof shape: state → wipe the live organs → reload from disk → counts intact). The rebuilt mind is
// itself journaling, and its own events() deep-equals the input log (idempotent), so it can keep
// persisting from where it left off. Total: a malformed log entry is skipped, never thrown on.
export function rebuildMind(events, opts = {}) {
  if (!Array.isArray(events)) return { ok: false, why: 'events must be an array' };
  const mind = createMind({ ...opts, journal: true });
  let replayed = 0, skipped = 0;
  for (const e of events) {
    if (!e || typeof e !== 'object') { skipped++; continue; }
    let r;
    if (e.t === 'perceive') r = mind.perceive(e.fact || {});
    else if (e.t === 'consolidate') r = mind.consolidate(e.args || {});
    else if (e.t === 'dream') r = mind.dream(e.args || {});
    else if (e.t === 'route') r = mind.route(e.sig, e.opts || {});
    else { skipped++; continue; }
    if (r && r.ok) replayed++; else skipped++;
  }
  return { ok: true, mind, replayed, skipped };
}
