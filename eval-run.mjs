#!/usr/bin/env node
// eval-run.mjs — THE EVAL. Deterministic metrics, NO LLM judge — the estate's actual wedge. Measures
// the specific properties where the nested-solid architecture and a standard RAG store genuinely
// differ, each scored exactly. Designed to be able to say no: nothing here is pre-scored to win.
import { createCrystal } from './crystal.mjs';
import { FallRemember } from '../fall-remember/fall-remember.mjs';
import { verifyBeforePromote } from './wire-octa.mjs';
import { createRagBaseline } from './rag-baseline.mjs';

let report = [];
function log(line) { report.push(line); console.log(line); }

// ══ EVAL 1 — EXACT-FACT NO-DRIFT ══
// Near-duplicate facts: same key, different value, different real source. Metric: exact-match
// accuracy AND correct provenance, per (key, source) pair — a deterministic pass/fail per item.
log('\n=== EVAL 1: EXACT-FACT NO-DRIFT ===');
const dupCases = [
  { key: 'lesson-count', a: ['eyeball-read', 6], b: ['gated-count', 7] },
  { key: 'build-status', a: ['monitor-a', 'green'], b: ['monitor-b', 'red'] },
  { key: 'temp-reading', a: ['sensor-1', 72], b: ['sensor-2', 74] },
  { key: 'user-count', a: ['api-a', 1500], b: ['api-b', 1502] },
  { key: 'version', a: ['tag-a', '2.1'], b: ['tag-b', '2.2'] },
];
const crystal1 = createCrystal();
const rag1 = createRagBaseline();
for (const c of dupCases) {
  crystal1.write(c.key, c.a[1], c.a[0], 1); crystal1.write(c.key, c.b[1], c.b[0], 2);
  rag1.write(c.key, c.a[1], c.a[0], 1); rag1.write(c.key, c.b[1], c.b[0], 2);
}
let crystalHits = 0, ragHits = 0, total1 = 0;
for (const c of dupCases) {
  for (const [source, expected] of [c.a, c.b]) {
    total1++;
    const cr = crystal1.read(c.key, source);
    const crOk = cr.ok && cr.value === expected && cr.source === source;
    if (crOk) crystalHits++;
    // the fairest reasonable RAG query: include the key AND the source explicitly
    const rr = rag1.query(`${c.key} according to ${source}`, 1)[0];
    const ragOk = rr && rr.value === expected && rr.source === source;
    if (ragOk) ragHits++;
    log(`  [${c.key} / ${source}] expect=${JSON.stringify(expected)} | crystal=${crOk ? 'HIT' : 'MISS(' + cr.value + ')'} | RAG=${ragOk ? 'HIT' : 'MISS(' + (rr ? rr.value : 'none') + ' from ' + (rr ? rr.source : '?') + ')'}`);
  }
}
log(`RESULT 1 — crystal exact-match: ${crystalHits}/${total1} (${(100 * crystalHits / total1).toFixed(1)}%) | RAG exact-match: ${ragHits}/${total1} (${(100 * ragHits / total1).toFixed(1)}%)`);

// ══ EVAL 2 — CONTRADICTION DETECTION ══
// Three genuinely independent sources per key, real disagreement, no majority. Metric: is the
// contradiction CAUGHT (an explicit signal) vs silently returned as if settled?
log('\n=== EVAL 2: CONTRADICTION DETECTION ===');
const contraCases = [
  { key: 'recurrence-count', vals: [['source-a', 6], ['source-b', 7], ['source-c', 8]] },
  { key: 'error-total', vals: [['log-a', 12], ['log-b', 15], ['log-c', 19]] },
  { key: 'confidence', vals: [['model-a', 'high'], ['model-b', 'medium'], ['model-c', 'low']] },
];
const crystal2 = createCrystal();
const rag2 = createRagBaseline();
for (const c of contraCases) for (const [src, val] of c.vals) { crystal2.write(c.key, val, src, 1); rag2.write(c.key, val, src, 1); }
let octaCaught = 0;
for (const c of contraCases) {
  const v = verifyBeforePromote({ crystal: crystal2, key: c.key });
  const caught = v.ok && v.verdict.verdict === 'SPLIT' && Object.keys(v.verdict.accepted).length === 0;
  if (caught) octaCaught++;
  log(`  [${c.key}] octa verdict=${v.ok ? v.verdict.verdict : v.why} | caught=${caught}`);
  // the honest RAG-side check: does querying it even SIGNAL a contradiction exists? A standard RAG
  // store has no such mechanism at all — it just returns its top-1 match, silently, as if settled.
  const rr = rag2.query(c.key, 1)[0];
  log(`      RAG silently returns top-1: "${rr.value}" (source: ${rr.source}) — no contradiction signal exists in this architecture, structurally, not by omission here`);
}
log(`RESULT 2 — octa contradiction-caught: ${octaCaught}/${contraCases.length} (${(100 * octaCaught / contraCases.length).toFixed(1)}%) | RAG contradiction-caught: 0/${contraCases.length} (0.0%) — no mechanism exists to catch one`);

// ══ EVAL 3 — SEMANTIC RECALL (expect a TIE: dodeca and RAG share the same embed+cosine mechanism) ══
log('\n=== EVAL 3: SEMANTIC RECALL (dodeca vs RAG — same underlying mechanism, reported honestly) ===');
const semCorpus = [
  { text: 'the witness gate mutates source code and checks if the test suite kills every mutant', topic: 'witness' },
  { text: 'consent gate holds a single pending action until a real button click confirms it', topic: 'consent-gate' },
  { text: 'the wall guard resolves symlinks to their true target before checking allowed roots', topic: 'wall' },
  { text: 'fall remember stores memories in twelve dodecahedral chambers routed by direction', topic: 'dodeca' },
  { text: 'the dreamer consolidates episodic facts overnight into typed generalized rules', topic: 'dreamer' },
  { text: 'veridia cross checks three independent nodes and refuses a panel of duplicate models', topic: 'veridia' },
];
const semQueries = [
  { q: 'how does the mutation testing tool decide if a test suite is good enough', expect: 'witness' },
  { q: 'what makes sure a button click is required before a write actually executes', expect: 'consent-gate' },
  { q: 'how are directory symlinks handled by the path safety check', expect: 'wall' },
  { q: 'how many storage chambers does the memory organ have', expect: 'dodeca' },
  { q: 'what happens to memories overnight while the system sleeps', expect: 'dreamer' },
  { q: 'how does the cross-check system prevent three clones from faking agreement', expect: 'veridia' },
];
const dodeca3 = new FallRemember();
const rag3 = createRagBaseline();
for (const c of semCorpus) { dodeca3.store({ id: c.topic, text: c.text, meta: { topic: c.topic } }); rag3.write(c.topic, c.text, 'corpus', 1); }
let dodecaHits = 0, ragSemHits = 0;
for (const q of semQueries) {
  const dr = dodeca3.retrieve(q.q, { k: 1 });
  const dOk = dr.center && dr.center.name === q.expect;
  if (dOk) dodecaHits++;
  const rr = rag3.query(q.q, 1)[0];
  const rOk = rr && rr.key === q.expect;
  if (rOk) ragSemHits++;
  log(`  [${q.expect}] dodeca=${dOk ? 'HIT' : 'MISS(' + (dr.center ? dr.center.name : 'none') + ')'} | RAG=${rOk ? 'HIT' : 'MISS(' + (rr ? rr.key : 'none') + ')'}`);
}
log(`RESULT 3 — dodeca semantic accuracy: ${dodecaHits}/${semQueries.length} (${(100 * dodecaHits / semQueries.length).toFixed(1)}%) | RAG semantic accuracy: ${ragSemHits}/${semQueries.length} (${(100 * ragSemHits / semQueries.length).toFixed(1)}%)`);
log(dodecaHits === ragSemHits ? '  -> TRUE TIE, same score, same underlying mechanism (embed+cosine)' : '  -> NOT a tie — reporting the real numbers as measured, not forcing a tie narrative');

log('\n=== VERDICT ===');
const win1 = crystalHits > ragHits;
const win2 = octaCaught > 0;
const tie3 = dodecaHits === ragSemHits;
log(`Exact-fact no-drift: ${win1 ? 'NESTED-SOLID WINS' : 'no win shown'} (${crystalHits}/${total1} vs ${ragHits}/${total1})`);
log(`Contradiction detection: ${win2 ? 'NESTED-SOLID WINS' : 'no win shown'} (${octaCaught}/${contraCases.length} vs 0/${contraCases.length})`);
log(`Semantic recall: ${tie3 ? 'TIE' : (dodecaHits > ragSemHits ? 'nested-solid wins' : 'RAG wins')} (${dodecaHits}/${semQueries.length} vs ${ragSemHits}/${semQueries.length})`);
