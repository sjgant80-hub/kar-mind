#!/usr/bin/env node
// wisp-discriminator.mjs — the wisp-survival axis, HARDENED: a real, generalizable discriminator
// that VERIFIES its inputs against real files on disk, rather than trusting caller-asserted booleans
// (which is what the first eval pass did — a real gap, closed here). Runs on ANY claimed output, not
// just tonight's examples. Deterministic, no LLM judge: every check is a real filesystem read.
import { existsSync, readFileSync } from 'node:fs';

// verifyWisp({claimedFile, claimedGateCompanion, claimedCrossRefFile, claimedCrossRefPhrase})
// Three real, automated checks:
//   1. provenanceReal  — does the claimed source file genuinely exist?
//   2. gateBacked       — does a claimed companion gate/test file genuinely exist alongside it?
//   3. crossReferenced  — does the claimed cross-reference file genuinely CONTAIN the claimed phrase?
// PASS requires all three. Total: never throws, bad/missing input just fails the relevant check.
export function verifyWisp({ claimedFile, claimedGateCompanion, claimedCrossRefFile, claimedCrossRefPhrase } = {}) {
  const provenanceReal = typeof claimedFile === 'string' && claimedFile.length > 0 && existsSync(claimedFile);
  const gateBacked = typeof claimedGateCompanion === 'string' && claimedGateCompanion.length > 0 && existsSync(claimedGateCompanion);
  let crossReferenced = false;
  if (typeof claimedCrossRefFile === 'string' && typeof claimedCrossRefPhrase === 'string' && claimedCrossRefPhrase.length > 0 && existsSync(claimedCrossRefFile)) {
    try { crossReferenced = readFileSync(claimedCrossRefFile, 'utf8').includes(claimedCrossRefPhrase); } catch { crossReferenced = false; }
  }
  const passed = [provenanceReal, gateBacked, crossReferenced].filter(Boolean).length;
  return {
    provenanceReal, gateBacked, crossReferenced,
    score: `${passed}/3`,
    decision: passed === 3 ? 'PASS — genuine, gate-backed, cross-referenced' : 'FLAG — insufficient verifiable backing',
  };
}
