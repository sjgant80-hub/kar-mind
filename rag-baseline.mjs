#!/usr/bin/env node
// rag-baseline.mjs — the FAIR RAG comparator: one flat embedding store, vector-similarity retrieval,
// the standard one-blur approach. Uses fall-remember's OWN embed()/cosine() — the exact same
// embedding function crystal/dodeca's real organ uses — so the only variable under test is
// architecture (distinct organs + no-drift crystal + octa-verify) vs one blurred store, not
// embedding quality. A rigged-weak baseline would invalidate the whole result, so this isn't one:
// it's given the best-faith query it can reasonably be given in every eval that uses it.
import { embed, cosine } from '../fall-remember/fall-remember.mjs';

export function createRagBaseline() {
  const store = []; // flat, append-only — the standard shape: everything blurred into one list

  function write(key, value, source, ts) {
    const text = `${key}: ${value} (source: ${source})`;
    store.push({ key, value, source, ts, text, vector: embed(text) });
    return { ok: true };
  }

  // query: the standard RAG move — embed the query, return the top-k by cosine. No key lookup, no
  // source disambiguation mechanism, no contradiction awareness. That absence is the actual point
  // under test, not a handicap added on top.
  function query(text, k = 1) {
    const qv = embed(text);
    const scored = store.map((r) => ({ ...r, score: cosine(qv, r.vector) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  return { write, query, size: () => store.length };
}
