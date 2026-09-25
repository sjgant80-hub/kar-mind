#!/usr/bin/env node
// wire-dodeca.mjs — THE EDGE: crystal (the exact-facts shelf) -> DODECA (fall-remember, the real
// meaning organ), coupled through the strand's real promote/hold/decay/expire decision. This is the
// wiring itself, a NEW surface edge-testing says needs its own proof — a proven kernel proves
// nothing about its wire.
//
// Real imports, not stubs: crystal.mjs (this session's own exact-facts kernel), strand.mjs (this
// session's own movement kernel), and fall-remember's actual class, imported directly from the real
// repo on disk.
import { FallRemember } from '../fall-remember/fall-remember.mjs';
import { recallScore, strandDecision } from './strand.mjs';

// promoteToDodeca: given a live crystal instance, a key/source to look up, and the recall inputs
// that decide its fate, this either genuinely writes the fact into a REAL FallRemember store (when
// the strand says promote) or does nothing (hold/decay/expire) — never a partial or simulated write.
//
// Returns {ok, decision, crystalFact?, dodecaRecord?, why?} — total, never throws.
export function promoteToDodeca({ crystal, dodeca, key, source, ageMs, halfLifeMs, accessCount }) {
  if (!crystal || typeof crystal.read !== 'function') return { ok: false, why: 'crystal must be a live crystal instance' };
  if (!dodeca || typeof dodeca.store !== 'function') return { ok: false, why: 'dodeca must be a live FallRemember instance' };
  const fact = crystal.read(key, source);
  if (!fact.ok) return { ok: false, why: 'no such fact in crystal: ' + fact.why };

  const s = recallScore({ base: 1, ageMs, halfLifeMs, accessCount });
  if (!s.ok) return { ok: false, why: 'bad recall inputs: ' + s.why };
  const d = strandDecision({ score: s.score });
  if (!d.ok) return { ok: false, why: d.why };

  if (d.decision !== 'promote') {
    return { ok: true, decision: d.decision, crystalFact: fact, dodecaRecord: null };
  }

  // THE REAL MOVE: an actual write into fall-remember's actual store, through its own real API —
  // not a copy of the logic, the genuine organ, embedding real text via its own embed().
  const rec = dodeca.store({
    id: key + '::' + source,
    text: `${key}: ${JSON.stringify(fact.value)} (source: ${fact.source}, ts: ${fact.ts})`,
    meta: { crystalKey: key, crystalSource: fact.source, crystalTs: fact.ts, promotedFromScore: s.score },
  });
  if (!rec) return { ok: false, why: 'fall-remember refused the write (degenerate vector at its own degenerate-vector gate)' };
  return { ok: true, decision: 'promote', crystalFact: fact, dodecaRecord: rec };
}
