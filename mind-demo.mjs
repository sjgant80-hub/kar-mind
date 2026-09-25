#!/usr/bin/env node
// mind-demo.mjs — the unified system RUN LIVE end-to-end, so the composition can be watched, not just
// asserted. Not a kernel (mind.mjs is the kernel, witness-clean 1.0); this is a harness that drives a
// real scenario through the real organs and prints the real state at each hop. Run: `node mind-demo.mjs`.
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMind, verifyManifest, SOLIDS } from './mind.mjs';

const line = (s = '') => console.log(s);
const tmp = mkdtempSync(join(tmpdir(), 'mind-demo-'));

line('╔══════════════════════════════════════════════════════════════════╗');
line('║  THE UNIFIED COGNITIVE STACK — one system, driven end-to-end       ║');
line('╚══════════════════════════════════════════════════════════════════╝');

// 0 — the system verifies its own declared parts before it runs anything.
const manifest = verifyManifest();
line(`\n[manifest] the system checks its own organs with its own wisp-discriminator → allReal=${manifest.allReal} (${manifest.results.length} organs)`);
for (const r of manifest.results) line(`           ${r.solid.padEnd(13)} ${r.file.padEnd(24)} wisp=${r.wisp} status=${r.status}`);

const mind = createMind({ exportRoots: [tmp], tetraConfig: { noveltyThreshold: 2 } });
line(`\n[start]    snapshot: ${JSON.stringify(mind.snapshot())}`);

// 1 — PERCEIVE: ground truth enters the crystal (exact-facts floor). Gary-shape: knowledge_graph.
line(`\n── CRYSTAL (facts) ${''.padEnd(2,'·')} nexus-ref: ${SOLIDS.crystal.nexusRef}`);
mind.perceive({ key: 'release', value: 'v2.4', source: 'git-tag' });
mind.perceive({ key: 'lesson-recurrence', value: 'seven nights converged on one fix', source: 'kar-lessons' });
line(`[perceive] two facts recorded → crystalFacts=${mind.snapshot().crystalFacts}`);

// 2 — OCTA (verify): three independent sources, a real contradiction caught by real Veridia.
line(`\n── OCTA (verify) ${''.padEnd(2,'·')} nexus-ref: ${SOLIDS.octa.nexusRef}`);
mind.perceive({ key: 'recurrence-count', value: 6, source: 'eyeball' });
mind.perceive({ key: 'recurrence-count', value: 7, source: 'gated-count' });
mind.perceive({ key: 'recurrence-count', value: 8, source: 'peer-audit' });
const v = mind.verify('recurrence-count');
line(`[verify]   3 independent sources disagree → Veridia verdict=${v.verdict.verdict}, accepted=${JSON.stringify(v.verdict.accepted)} (contradiction CAUGHT, nothing promoted)`);

// 3 — CONSOLIDATE (strand → DODECA): a strong fact genuinely crosses into the real meaning organ.
line(`\n── DODECA (meaning) ${''.padEnd(2,'·')} nexus-ref: ${SOLIDS.dodeca.nexusRef}`);
const c = mind.consolidate({ key: 'lesson-recurrence', source: 'kar-lessons', ageMs: 0, halfLifeMs: 100000, accessCount: 3 });
line(`[strand]   recall decision=${c.decision} → dodecaMemories=${mind.snapshot().dodecaMemories} (a real FallRemember write)`);

// 4 — DREAM (ICOSA → loop back to CRYSTAL): the-dreamer generates a fact from no single episode.
line(`\n── ICOSA (generate) ${''.padEnd(2,'·')} nexus-ref: ${SOLIDS.icosa.nexusRef}`);
const before = mind.snapshot();
const d = mind.dream({
  episodes: [
    { s: 'robin', p: 'isa', o: 'bird' }, { s: 'sparrow', p: 'isa', o: 'bird' },
    { s: 'robin', p: 'can', o: 'fly' }, { s: 'sparrow', p: 'can', o: 'fly' },
  ],
  day: 1, minInstances: 2, source: 'dream',
});
const after = mind.snapshot();
line(`[dream]    generated=${d.generatedCount}, promoted back=${d.promotedCount} → dreamFacts ${before.dreamFacts}→${after.dreamFacts}, crystalFacts ${before.crystalFacts}→${after.crystalFacts} (loop closed: a generated fact re-entered crystal)`);

// 5 — ROUTE (TETRA): a genuinely new domain births only after the novelty threshold, bounded.
line(`\n── TETRA (birth) ${''.padEnd(2,'·')} nexus-ref: ${SOLIDS.tetra.nexusRef}`);
mind.route('quantum-metrology'); const born = mind.route('quantum-metrology');
line(`[route]    new signature seen twice → birthed=${born.birthed}, bornDomains=${mind.snapshot().bornDomains} (one stray input alone never births)`);

// 6 — the doubly-gated export door: propose (staged, nothing written) → confirm (real file).
line(`\n── EXPORT DOOR (consent + wall) ──`);
const target = join(tmp, 'mind-snapshot.json');
const prop = mind.proposeExport(target);
line(`[propose]  staged export of the mind's snapshot → pending=${!!mind.pendingExport()}, fileWritten=${existsSync(target)} (nothing on disk yet)`);
const done = mind.confirmExport(prop.id);
line(`[confirm]  consent id matched → fileWritten=${done.wrote} at ${target.replace(/\\/g,'/')}`);

// 7 — THINK: the whole cascade in one call, with an honest per-hop receipt.
line(`\n── THINK (one call, whole stack) ──`);
const t = mind.think({ key: 'unified', value: 'the stack moved as one', source: 'kar' },
  { recall: { ageMs: 0, halfLifeMs: 100000, accessCount: 0 }, routeSignature: 'new-topic' });
line(`[think]    hops=${JSON.stringify(t.hops)}`);
line(`           delta=${JSON.stringify(t.delta)}`);

line(`\n[final]    snapshot: ${JSON.stringify(mind.snapshot())}`);
line('\nOne system: a fact entered ground truth, was cross-checked, consolidated into meaning, a new');
line('fact was generated and looped back, a new domain was born — all through the REAL organs, every');
line('state change read from the organ\'s own count. What is NOT built: tetra spinning up live per-domain');
line('organ instances (bounded birth-record only); durable persistence beyond the gated export door.');
rmSync(tmp, { recursive: true, force: true });
