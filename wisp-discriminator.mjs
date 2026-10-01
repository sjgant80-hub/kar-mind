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
// A phrase is found only when it is a real, non-empty string and the file reads; any failure to read is a no.
const readsAs = (file, phrase) => {
  try { return typeof phrase === 'string' && phrase !== '' && readFileSync(file, 'utf8').includes(phrase); } catch { return false; }
};

export function verifyWisp({ claimedFile, claimedGateCompanion, claimedCrossRefFile, claimedCrossRefPhrase } = {}) {
  // existsSync('') is false, so an empty path needs no separate length check; the string check stays,
  // because a Buffer or a file descriptor is a different claim from a path.
  const provenanceReal = typeof claimedFile === 'string' && existsSync(claimedFile);
  const gateBacked = typeof claimedGateCompanion === 'string' && existsSync(claimedGateCompanion);
  const crossReferenced = typeof claimedCrossRefFile === 'string' && readsAs(claimedCrossRefFile, claimedCrossRefPhrase);
  const passed = [provenanceReal, gateBacked, crossReferenced].filter(Boolean).length;
  return {
    provenanceReal, gateBacked, crossReferenced,
    score: `${passed}/3`,
    decision: passed === 3 ? 'PASS — genuine, gate-backed, cross-referenced' : 'FLAG — insufficient verifiable backing',
  };
}
