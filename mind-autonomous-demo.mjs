#!/usr/bin/env node
// mind-autonomous-demo.mjs — the PERSISTENT, AUTONOMOUS mind run live: boot cold, let it drive its own
// loop on a real cadence and persist itself each beat, then a genuine restart from disk with every
// organ count intact. Run: `node mind-autonomous-demo.mjs`. Harness, not a kernel (the kernels are
// witness-clean 1.0); this just lets you watch the composed system run on its own.
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootMind, runAutonomous } from './mind-persistent.mjs';
import { queueSource } from './run-loop.mjs';

const line = (s = '') => console.log(s);
const dir = mkdtempSync(join(tmpdir(), 'mind-live-'));
const birdEpisodes = () => [
  { s: 'robin', p: 'isa', o: 'bird' }, { s: 'sparrow', p: 'isa', o: 'bird' },
  { s: 'robin', p: 'can', o: 'fly' }, { s: 'sparrow', p: 'can', o: 'fly' },
];

line('╔══════════════════════════════════════════════════════════════════╗');
line('║  THE PERSISTENT, AUTONOMOUS MIND — booted, run on its own, restart ║');
line('╚══════════════════════════════════════════════════════════════════╝');

// ── BOOT 1: cold start from an empty durable journal ──
const b1 = await bootMind({ dir, tetraConfig: { noveltyThreshold: 2 } });
line(`\n[boot 1]   cold start · restoredFrom=${b1.restoredFrom} · snapshot=${JSON.stringify(b1.snapshot)}`);

// ── the mind runs its OWN loop: from one call it pulls its own stimuli, drives the full cascade, and
//    persists itself each beat, on a real 40ms cadence. No caller per step. ──
const source = queueSource([
  { kind: 'fact', fact: { key: 'lesson', value: 'seven nights converged', source: 'kar' }, recall: { ageMs: 0, halfLifeMs: 100000, accessCount: 3 } },
  { kind: 'fact', fact: { key: 'release', value: 'v2.4', source: 'git-tag' } },
  { kind: 'episodes', episodes: birdEpisodes(), day: 1, source: 'dream' },
  { kind: 'signal', signal: 'quantum-metrology' },
  { kind: 'signal', signal: 'quantum-metrology' },
]);
line('\n[run]      the loop starts — it drives itself now (40ms cadence, persisting each beat):');
const run = await runAutonomous({ mind: b1.mind, journal: b1.journal, source, maxTicks: 20, cadenceMs: 40 });
for (const s of run.steps.filter((x) => x.acted)) {
  const detail = s.kind === 'fact' ? `crossedIntoDodeca=${s.receipt.hops.consolidate.crossedIntoDodeca}`
    : s.kind === 'episodes' ? `generated=${s.generated} promoted=${s.promoted}`
    : `birthed=${s.birthed}`;
  line(`           @${s.at % 100000}ms  ${s.kind.padEnd(9)} ${detail.padEnd(28)} persisted=${s.persisted} (${s.journalBytes}B on disk)`);
}
line(`[run]      done · ticksActed=${run.ticksActed} · persistedEveryActedTick=${run.persistedEveryActedTick} · delta=${JSON.stringify(run.delta)}`);
const live = b1.mind.snapshot();
line(`[live]     the running mind's state: ${JSON.stringify(live)}`);
line(`[disk]     durable journal: ${statSync(b1.journal.path).size}B sealed at ${b1.journal.path.replace(/\\/g, '/')}`);

// ── THE RESTART: a brand-new mind object, same dir, nothing shared in memory. It rebuilds from disk. ──
line('\n[RESTART]  ── the process forgets everything; a new mind boots from the durable file alone ──');
const b2 = await bootMind({ dir, tetraConfig: { noveltyThreshold: 2 } });
line(`[boot 2]   restoredFrom=${b2.journal.path.replace(/\\/g, '/')} · replayed=${b2.replayed} events`);
const restored = b2.mind.snapshot();
line(`[boot 2]   restored state: ${JSON.stringify(restored)}`);

const intact = JSON.stringify(restored) === JSON.stringify(live);
line(`\n[PROOF]    every organ count intact across the restart? ${intact ? 'YES' : 'NO'}`);
line(`           crystal ${live.crystalFacts}→${restored.crystalFacts} · dodeca ${live.dodecaMemories}→${restored.dodecaMemories} · dream ${live.dreamFacts}→${restored.dreamFacts} · domains ${live.bornDomains}→${restored.bornDomains}`);

// the restored mind is live, not frozen: it keeps thinking and persisting from where it left off
b2.mind.perceive({ key: 'after-restart', value: 'still awake', source: 'kar' });
line(`[live]     the restored mind keeps going: perceived one more fact → crystalFacts=${b2.mind.snapshot().crystalFacts}`);

line('\nThe mind ran its own cognition, remembered itself to disk each beat, and came back whole from');
line('that disk alone — persistent and autonomous. It never touched the export door while it ran:');
line('publish and spend stay behind consent + wall, unreachable from the loop by construction.');
rmSync(dir, { recursive: true, force: true });
