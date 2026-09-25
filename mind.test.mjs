// mind.test.mjs — THE INTEGRATION EDGE-GATE. The single load-bearing proof that mind.mjs is genuinely
// ONE runnable system, not files that merely coexist. Each organ is already gated in isolation
// (crystal 20/22+2, strand 33/33, dodeca 5/5, octa 6/6, icosa 5/5, tetra 16/16, primitives proven).
// This gate proves the COMPOSITION: a fact flowing through the real organs, observed by each real
// organ's OWN state — edge-testing applied to the whole stack. Nothing mocked: real crystal,
// real strand, real FallRemember, real the-dreamer, real Veridia, real tetra, real consent+wall.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMind, rebuildMind, verifyManifest, ORGANS } from './mind.mjs';
import { createConsentGate } from './consent-gate.mjs';

const birdEpisodes = () => [
  { s: 'robin', p: 'isa', o: 'bird' }, { s: 'sparrow', p: 'isa', o: 'bird' },
  { s: 'robin', p: 'can', o: 'fly' }, { s: 'sparrow', p: 'can', o: 'fly' },
];

test('MANIFEST: the system verifies its OWN declared parts with its OWN wisp-discriminator — every organ file and test file genuinely exists on disk', () => {
  const report = verifyManifest();
  assert.equal(report.ok, true);
  assert.equal(report.allReal, true, 'every declared organ must be a real, gate-backed file — a manifest that names a file that is not there is a lie the gate must catch');
  assert.equal(report.results.length, ORGANS.length);
  for (const r of report.results) {
    assert.equal(r.real, true, `${r.solid}: source file missing`);
    assert.equal(r.gated, true, `${r.solid}: test/gate companion missing`);
  }
});

test('END-TO-END: a fact flows perceive → crystal → strand decision → REAL fall-remember, with every hop observed by real organ state (not orchestrator bookkeeping)', () => {
  const mind = createMind();
  const before = mind.snapshot();
  assert.equal(before.crystalFacts, 0);
  assert.equal(before.dodecaMemories, 0);

  // PERCEIVE — the fact lands in the exact-facts floor. Real crystal state moves.
  const p = mind.perceive({ key: 'lesson-recurrence', value: 'seven nights converged on one fix', source: 'kar-lessons-2026-09-22' });
  assert.equal(p.ok, true);
  assert.equal(mind.snapshot().crystalFacts, 1, 'crystal genuinely holds the fact now');

  // CONSOLIDATE — fresh + no decay → strand says promote → it genuinely crosses into the REAL organ.
  const c = mind.consolidate({ key: 'lesson-recurrence', source: 'kar-lessons-2026-09-22', ageMs: 0, halfLifeMs: 100000, accessCount: 0 });
  assert.equal(c.ok, true);
  assert.equal(c.decision, 'promote');
  assert.equal(mind._dodeca.size, 1, 'THE REAL PROOF: fall-remember\'s own count changed — the fact crossed the wire');

  // and it is genuinely retrievable through fall-remember's OWN cosine search, not our record-keeping
  const found = mind._dodeca.retrieve('lesson-recurrence: "seven nights converged on one fix" (source: kar-lessons-2026-09-22, ts: ' + c.crystalFact.ts + ')');
  assert.ok(found.center, 'the real organ finds it by its own search');
});

test('END-TO-END: a weak (old, unreinforced) fact perceives but the strand refuses to promote — it genuinely never reaches the real meaning organ', () => {
  const mind = createMind();
  mind.perceive({ key: 'stale', value: 'nobody looked at this in ages', source: 'src', ts: Date.now() - 1_000_000 });
  const c = mind.consolidate({ key: 'stale', source: 'src', ageMs: 1_000_000, halfLifeMs: 100000, accessCount: 0 });
  assert.equal(c.decision, 'decay');
  assert.equal(mind._dodeca.size, 0, 'the real organ was never written — non-movement is real too');
});

test('END-TO-END (octa seam): three independent sources for one key are cross-checked by the REAL Veridia adjudicate, and a genuine contradiction is CAUGHT, not silently consolidated', () => {
  const mind = createMind();
  mind.perceive({ key: 'count', value: 6, source: 'source-a' });
  mind.perceive({ key: 'count', value: 7, source: 'source-b' });
  mind.perceive({ key: 'count', value: 8, source: 'source-c' });

  const v = mind.verify('count');
  assert.equal(v.ok, true);
  assert.equal(v.verdict.verdict, 'SPLIT', 'Veridia\'s own real disagreement verdict on a genuine 3-way contradiction');
  assert.deepEqual(v.verdict.accepted, {}, 'THE REAL CATCH: nothing was silently accepted');

  // agreeing sources → Veridia accepts, and the whole thing is one live crystal shared across seams
  mind.perceive({ key: 'agree', value: 42, source: 's1' });
  mind.perceive({ key: 'agree', value: 42, source: 's2' });
  mind.perceive({ key: 'agree', value: 42, source: 's3' });
  const v2 = mind.verify('agree');
  assert.equal(v2.verdict.verdict, 'UNANIMOUS');
  assert.equal(v2.verdict.accepted.value, 42);
});

test('END-TO-END (icosa seam, loop closure): a real dream cycle GENERATES a new fact in the-dreamer\'s own store and it loops back into the SAME mind\'s crystal', () => {
  const mind = createMind();
  const before = mind.snapshot();
  const r = mind.dream({
    episodes: [
      { s: 'robin', p: 'isa', o: 'bird' }, { s: 'sparrow', p: 'isa', o: 'bird' },
      { s: 'robin', p: 'can', o: 'fly' }, { s: 'sparrow', p: 'can', o: 'fly' },
    ],
    day: 1, minInstances: 2, source: 'kar-dream',
  });
  assert.equal(r.ok, true);
  assert.ok(r.generatedCount >= 1, 'the-dreamer genuinely generalized at least one rule');
  assert.ok(r.promotedCount >= 1, 'a generated fact genuinely looped back');

  const after = mind.snapshot();
  assert.ok(after.dreamFacts > before.dreamFacts, 'the-dreamer\'s own store grew — real generation');
  assert.ok(after.crystalFacts > before.crystalFacts, 'crystal grew from a fact that lived in NO input episode — the loop truly closed');
  // and the specific generated fact is readable from the SAME mind's crystal
  const cf = mind._crystal.read('bird|can|fly', 'kar-dream');
  assert.equal(cf.ok, true);
  assert.equal(cf.value, 'fly');
});

test('END-TO-END (tetra seam): a genuinely new domain births only after the novelty threshold, bounded by capacity — one stray input never spawns a domain', () => {
  const mind = createMind({ tetraConfig: { maxDomains: 2, noveltyThreshold: 2 } });
  const first = mind.route('sig-new');
  assert.equal(first.birthed, false, 'one sighting is not enough');
  const second = mind.route('sig-new');
  assert.equal(second.birthed, true, 'seen twice → born');
  assert.equal(mind.snapshot().bornDomains, 1);
  // capacity: fill it, then a third distinct domain is refused, count never exceeds the cap
  mind.route('sig-two'); mind.route('sig-two');
  mind.route('sig-three'); const capped = mind.route('sig-three');
  assert.equal(capped.birthed, false);
  assert.equal(capped.refused, 'at-capacity');
  assert.ok(mind.snapshot().bornDomains <= 2, 'the hard cap held across the whole system');
});

test('THINK: one call drives the whole cascade and returns an honest receipt — real deltas per hop, including hops that legitimately did nothing', () => {
  const mind = createMind();
  const out = mind.think(
    { key: 'unified-fact', value: 'the stack moved as one', source: 'kar' },
    { recall: { ageMs: 0, halfLifeMs: 100000, accessCount: 0 }, routeSignature: 'a-domain' },
  );
  assert.equal(out.ok, true);
  assert.equal(out.hops.perceive.ok, true);
  assert.equal(out.hops.verify.ran, false, 'only one source → octa honestly reports it did not run, not a faked pass');
  assert.equal(out.hops.consolidate.decision, 'promote');
  assert.equal(out.hops.consolidate.crossedIntoDodeca, true);
  assert.equal(out.delta.crystalFacts, 1);
  assert.equal(out.delta.dodecaMemories, 1, 'the real meaning organ grew by exactly one across the whole think()');
});

test('EXPORT DOOR: durable write is refused by construction until a root is opened, then doubly gated (consent id + path wall) before a real file is ever written', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'mind-export-'));
  try {
    // no root opened → refused outright
    const noRoot = createMind();
    assert.equal(noRoot.proposeExport(join(tmp, 'snap.json')).ok, false, 'no durable write without an explicitly opened root');

    const mind = createMind({ exportRoots: [tmp] });
    mind.perceive({ key: 'k', value: 'v', source: 's' });

    // a path OUTSIDE the opened root is walled off
    assert.equal(mind.proposeExport(join(tmpdir(), 'escape.json')).ok, false, 'the wall refuses a path outside the opened root');

    // propose inside the root → a pending consent slot, but NO file yet
    const target = join(tmp, 'snap.json');
    const prop = mind.proposeExport(target);
    assert.equal(prop.ok, true);
    assert.ok(mind.pendingExport(), 'a consent slot is genuinely pending');
    assert.equal(existsSync(target), false, 'proposing wrote nothing — the door has not opened');

    // a WRONG id cannot fire it
    assert.equal(mind.confirmExport('not-the-id').ok, false);
    assert.equal(existsSync(target), false, 'a bad confirm still wrote nothing');

    // the matching id → the real file is genuinely written, and it holds the real snapshot
    const done = mind.confirmExport(prop.id);
    assert.equal(done.ok, true);
    assert.equal(done.wrote, true);
    assert.equal(existsSync(target), true, 'THE REAL SIDE EFFECT: a genuine file on disk, only after both gates passed');
    const onDisk = JSON.parse(readFileSync(target, 'utf8'));
    assert.equal(onDisk.snapshot.crystalFacts, 1, 'the exported snapshot is the mind\'s real state');

    // single-use: the same id cannot fire twice
    assert.equal(mind.confirmExport(prop.id).ok, false, 'consent is single-use — no replay');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('MANIFEST honors its dir argument and requires BOTH a source AND a gate companion per organ (not either-or)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mind-manifest-'));
  try {
    // every organ gets a real source file (containing its own filename, so the wisp cross-ref passes)
    for (const o of ORGANS) writeFileSync(join(dir, o.file), `// ${o.file}\n`);
    // ...but the LAST organ deliberately gets NO test/gate companion
    ORGANS.slice(0, -1).forEach((o) => writeFileSync(join(dir, o.test), '// test\n'));
    const rep = verifyManifest(dir);
    assert.equal(rep.allReal, false, 'a missing gate companion must drop allReal to false — real AND gated, never real OR gated');
    const last = rep.results.find((r) => r.solid === ORGANS[ORGANS.length - 1].solid);
    assert.equal(last.gated, false);
    // now complete it → the dir argument is genuinely used (proving it is not ignored for a fallback)
    writeFileSync(join(dir, ORGANS[ORGANS.length - 1].test), '// test\n');
    assert.equal(verifyManifest(dir).allReal, true);
    // a NON-STRING dir falls back to the real source dir (where every file exists) → true. This pins
    // the `typeof dir === 'string' && dir` guard: a mutant that used the non-string value would fail.
    assert.equal(verifyManifest(12345).allReal, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('PERCEIVE stamps an explicit finite ts exactly, and defaults a non-finite ts to now rather than passing garbage to crystal', () => {
  const mind = createMind();
  const p = mind.perceive({ key: 'ts-fact', value: 'v', source: 's', ts: 5000 });
  assert.equal(p.ok, true);
  assert.equal(mind._crystal.read('ts-fact', 's').ts, 5000, 'an explicit finite ts is recorded exactly, not overwritten with now');
  // Infinity is a number but not finite: the guard must fall back to Date.now() (a value crystal
  // accepts), NOT pass Infinity through (which crystal.write would rightly refuse).
  const inf = mind.perceive({ key: 'inf', value: 'v', source: 's', ts: Infinity });
  assert.equal(inf.ok, true, 'a non-finite ts is defaulted, so the write still succeeds');
  assert.ok(Number.isFinite(mind._crystal.read('inf', 's').ts), 'what got recorded is a real finite ts');
});

test('THINK receipt: crossedIntoDodeca is true ONLY on a real promote — a decayed fact perceives but honestly reports it did NOT cross', () => {
  const mind = createMind();
  const out = mind.think(
    { key: 'weak', value: 'v', source: 's', ts: Date.now() - 1_000_000 },
    { recall: { ageMs: 1_000_000, halfLifeMs: 100000, accessCount: 0 } },
  );
  assert.equal(out.ok, true);
  assert.equal(out.hops.consolidate.decision, 'decay');
  assert.equal(out.hops.consolidate.crossedIntoDodeca, false, 'consolidate was ok:true but nothing crossed — the receipt must not overclaim');
  assert.equal(out.delta.dodecaMemories, 0);
});

test('EXPORT DOOR rejects a confirmed action that is not an export — the type guard is real, not decorative', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'mind-notexport-'));
  try {
    const gate = createConsentGate();
    const prop = gate.propose({ type: 'other', path: 'x' }, 'some non-export action'); // a foreign action in the same gate
    const mind = createMind({ consentGate: gate, exportRoots: [tmp] });
    const res = mind.confirmExport(prop.id);
    assert.equal(res.ok, false);
    assert.match(res.why, /not an export/, 'confirming a non-export action must be refused for THAT reason, not slip through to the writer');
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('EXPORT WALL config genuinely flows: a caller-supplied forbidden pattern and excluded subdir really reach the real wall (not silently dropped)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'mind-wallcfg-'));
  try {
    const mind = createMind({ exportRoots: [tmp], forbidden: [/\.secret$/], excluded: [join(tmp, 'nested')] });
    // a plain path inside the root is allowed — proving the refusals below are the CONFIG's doing
    assert.equal(mind.proposeExport(join(tmp, 'ok.json')).ok, true);
    mind.pendingExport(); // (leaves a pending slot; harmless, overwritten below)
    // the forbidden pattern must genuinely refuse a secret-shaped path
    assert.equal(mind.proposeExport(join(tmp, 'creds.secret')).ok, false, 'the forbidden pattern must actually reach the wall');
    // the excluded subdir must genuinely refuse a path inside it
    assert.equal(mind.proposeExport(join(tmp, 'nested', 'x.json')).ok, false, 'the excluded subdir must actually reach the wall');
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('CONSENT config genuinely flows: a caller-supplied tiny TTL (with an injected clock) really governs the real consent gate — a stale confirm expires', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'mind-consentcfg-'));
  try {
    let t = 1000;
    const mind = createMind({ exportRoots: [tmp], consentConfig: { ttlMs: 5, now: () => t } });
    mind.perceive({ key: 'k', value: 'v', source: 's' });
    const prop = mind.proposeExport(join(tmp, 's.json'));
    assert.equal(prop.ok, true);
    t = 2000; // advance far past the 5ms TTL the caller configured
    const res = mind.confirmExport(prop.id);
    assert.equal(res.ok, false, 'the configured TTL must genuinely reach the gate — a dropped config would use the 10-min default and wrongly succeed');
    assert.equal(existsSync(join(tmp, 's.json')), false, 'nothing was written, because consent had really expired');
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('JOURNALING: off by default (no log); on, records exactly one event per SUCCESSFUL state-change and nothing for a refusal', () => {
  const plain = createMind();
  plain.perceive({ key: 'k', value: 'v', source: 's' });
  assert.equal(plain.journaling(), false);
  assert.equal(plain.events().length, 0, 'a non-journaling mind keeps no durable log');

  const m = createMind({ journal: true });
  assert.equal(m.journaling(), true);
  assert.equal(m.perceive({ key: 'k', value: 'v', source: 's' }).ok, true);
  assert.equal(m.events().length, 1, 'a successful perceive records exactly one event');
  assert.equal(m.perceive({}).ok, false);
  assert.equal(m.events().length, 1, 'a REFUSED perceive records nothing — the log never holds a no-op');
  assert.equal(m.events()[0].t, 'perceive');
  assert.equal(m.events()[0].fact.ts !== undefined, true, 'the resolved ts is captured so replay is exact');
});

test('JOURNALING: consolidate/dream/route record only on success, with replayable args and a resolved clock', () => {
  const m = createMind({ journal: true });
  m.perceive({ key: 'k', value: 'v', source: 's' });
  assert.equal(m.consolidate({ key: 'k', source: 's', ageMs: 0, halfLifeMs: 100000, accessCount: 0 }).ok, true);
  assert.equal(m.events().filter((e) => e.t === 'consolidate').length, 1);
  assert.equal(m.consolidate({ key: 'missing', source: 'x' }).ok, false);
  assert.equal(m.events().filter((e) => e.t === 'consolidate').length, 1, 'a refused consolidate records nothing');

  m.route('sig', { now: 777 });
  const rev = m.events().find((e) => e.t === 'route');
  assert.equal(rev.opts.now, 777, 'an explicit clock is recorded exactly, so a birth timestamp replays deterministically');
  m.route('sig2');
  const rev2 = m.events().filter((e) => e.t === 'route')[1];
  assert.ok(Number.isFinite(rev2.opts.now), 'a defaulted clock is resolved to a real finite value, not left undefined');
  m.route('sig3', { now: Infinity }); // a number but not finite → must be defaulted, never passed through
  const rev3 = m.events().filter((e) => e.t === 'route')[2];
  assert.ok(Number.isFinite(rev3.opts.now), 'a non-finite clock is replaced with a real finite value');

  m.dream({ episodes: birdEpisodes(), day: 1, source: 'd' });
  assert.equal(m.events().filter((e) => e.t === 'dream').length, 1);
  assert.equal(m.dream({ episodes: 'not-an-array', day: 1, source: 'd' }).ok, false);
  assert.equal(m.events().filter((e) => e.t === 'dream').length, 1, 'a refused dream records nothing');
});

test('REBUILD: replaying a durable log reconstructs every organ to identical counts, is idempotent, and skips malformed entries without throwing', () => {
  const opts = { journal: true, tetraConfig: { noveltyThreshold: 2 } };
  const src = createMind(opts);
  src.perceive({ key: 'lesson', value: 'v', source: 'kar', ts: 100 });
  src.consolidate({ key: 'lesson', source: 'kar', ageMs: 0, halfLifeMs: 100000, accessCount: 3 }); // promotes → dodeca +1
  src.dream({ episodes: birdEpisodes(), day: 1, source: 'dream' });                                 // generates + loops back
  src.route('domain-x', { now: 5 }); src.route('domain-x', { now: 6 });                             // born at threshold 2
  const events = src.events();
  const snap = src.snapshot();

  const rb = rebuildMind(events, { tetraConfig: { noveltyThreshold: 2 } });
  assert.equal(rb.ok, true);
  assert.equal(rb.replayed, events.length);
  const r = rb.mind.snapshot();
  assert.deepEqual(
    { c: r.crystalFacts, d: r.dodecaMemories, dr: r.dreamFacts, b: r.bornDomains },
    { c: snap.crystalFacts, d: snap.dodecaMemories, dr: snap.dreamFacts, b: snap.bornDomains },
    'the rebuilt mind reaches identical organ counts — real reconstruction, not an empty shell',
  );
  assert.deepEqual(rb.mind.events(), events, 'the rebuilt log deep-equals the original — idempotent, so it can keep persisting from where it left off');

  const rb2 = rebuildMind([{ t: 'perceive', fact: { key: 'k', value: 'v', source: 's', ts: 1 } }, null, { t: 'bogus' }, 42, { t: 'perceive', fact: {} }], {});
  assert.equal(rb2.ok, true);
  assert.equal(rb2.replayed, 1);
  assert.equal(rb2.skipped, 4, 'malformed entries AND a matched-but-refused verb are all counted as skipped, never as replayed');
  assert.equal(rebuildMind('not-an-array').ok, false);
});

test('TOTALITY: the orchestrator surface never throws on garbage — every bad call returns {ok:false, why}', () => {
  const mind = createMind();
  assert.equal(mind.perceive({}).ok, false);
  assert.equal(mind.perceive({ key: 'k' }).ok, false);          // missing value/source
  assert.equal(mind.verify('never-written').ok, false);
  assert.equal(mind.consolidate({ key: 'nope', source: 'x' }).ok, false);
  assert.equal(mind.dream({ episodes: 'not-an-array', day: 1, source: 'x' }).ok, false);
  assert.equal(mind.route(123).ok, false);
  assert.equal(mind.think({}).ok, false, 'think() surfaces a refused perceive honestly rather than pressing on');
});
