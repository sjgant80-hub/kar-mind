// wisp-discriminator.test.mjs — gates the deterministic, no-LLM-judge output verifier against REAL
// files in this repo: a genuine file + gate + present phrase passes; a fabricated file, or a real
// file with a fabricated claim, is flagged. Portable and self-contained (no external paths).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { verifyWisp } from './wisp-discriminator.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const f = (name) => join(HERE, name);

test('PASS: a real source file, a real gate companion, and a phrase genuinely present in the source → all three checks pass', () => {
  const r = verifyWisp({
    claimedFile: f('crystal.mjs'),
    claimedGateCompanion: f('crystal.test.mjs'),
    claimedCrossRefFile: f('crystal.mjs'),
    claimedCrossRefPhrase: 'exact recall that', // genuinely in crystal.mjs's header
  });
  assert.equal(r.provenanceReal, true);
  assert.equal(r.gateBacked, true);
  assert.equal(r.crossReferenced, true);
  assert.equal(r.score, '3/3');
  assert.match(r.decision, /^PASS/);
});

test('FLAG: a fabricated file path in plausible naming is caught — provenance fails', () => {
  const r = verifyWisp({
    claimedFile: f('wire-tetra.mjs'), // sounds as real as wire-icosa.mjs, but does not exist
    claimedGateCompanion: f('edge-gate-tetra.test.mjs'),
    claimedCrossRefFile: f('crystal.mjs'),
    claimedCrossRefPhrase: 'exact recall that',
  });
  assert.equal(r.provenanceReal, false);
  assert.match(r.decision, /^FLAG/);
});

test('FLAG (the hard case): real file + real gate, but the SPECIFIC cross-referenced claim is fabricated', () => {
  const r = verifyWisp({
    claimedFile: f('strand.mjs'),
    claimedGateCompanion: f('strand.test.mjs'),
    claimedCrossRefFile: f('strand.mjs'),
    claimedCrossRefPhrase: 'a conclusion that appears nowhere in this real file',
  });
  assert.equal(r.provenanceReal, true);
  assert.equal(r.gateBacked, true);
  assert.equal(r.crossReferenced, false); // the one that actually matters
  assert.match(r.decision, /^FLAG/);
});

test('garbage/missing input never throws and just fails the relevant check', () => {
  const r = verifyWisp({});
  assert.equal(r.score, '0/3');
  assert.match(r.decision, /^FLAG/);
  assert.doesNotThrow(() => verifyWisp());
  assert.doesNotThrow(() => verifyWisp({ claimedFile: 123, claimedCrossRefPhrase: {} }));
});
