#!/usr/bin/env node
// codec-measure.mjs — THE SEED'S CODEC AGAINST SIMON'S 15×, SEALED BEFORE IT IS MEASURED (Kar, 2026-10-01).
// Simon, relayed verbatim: "ok then we have to look in the v25 seed dude its all inthere lets grow it its the also in all
// my chat from claude lets get this done 15x is there we have the skills to build it".
//
// The real workload, gathered privately (tools/codec-material.mjs, sha256 pinned): the session-start digest, a cockpit
// brain refresh, today's organ-to-organ messages between claudedidy and Kar, and a cockpit Claude session's first turn.
// Each is coded by seedcodec.mjs against what its receiver ALREADY HOLDS — and only that: the session start's reader
// holds MEMORY.md; a cockpit session holds the digest it was given; claudedidy and Kar both hold MEMORY.md; a fresh
// cockpit session holds nothing. Counted in Claude tokens through the official CLI on Simon's login.
//
//   node tools/codec-measure.mjs --seal | --check | --run | --verify
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import C from '../seedcodec.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRE = join(ROOT, 'data', 'codec-prereg.json'), OUT = join(ROOT, 'data', 'codec-run.json');
const MATERIAL = join(homedir(), '.si-didy', 'brain', 'codec', 'material.json');
const MATERIAL_SHA = 'aa0d53fc018a29ee34a3ede78bff519a407ae94c4a837f58f9630cdd963e31c7';
const MAX_LINE = 600;
const text = (f) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const stable = (o) => JSON.stringify(o, null, 1) + '\n';
const die = (m) => { console.error(m); process.exit(1); };
const has = (f) => process.argv.includes(f);
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' });
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export const NOTE_P1 = '(each [name] below is the line of that name in your MEMORY.md index, which you already hold)';
export const NOTE_P2 = '(my brain changed since the digest you already hold; only these lines are new or different, everything else is unchanged)';

// every payload, as sent today and as coded against what its reader already holds
export function codeAll(m) {
  const builds = m.heldIndex.recent.map((r) => ({ name: r.name, text: r.name + ' — ' + clip(r.text, MAX_LINE) }));
  const estate = m.heldIndex.estate ? [{ name: 'estate', text: 'ESTATE: ' + clip(m.heldIndex.estate, MAX_LINE) }] : [];
  const memLines = m.heldIndex.recent.map((r) => ({ name: r.name, text: '- [' + r.name + '](' + r.name + '.md) — ' + r.text }));
  const out = [];
  for (const p of m.p1) {
    const coded = C.encodeHeld(C.encodeHeld(p.digest, builds, { prefix: '· ' }), estate);
    const back = C.decodeHeld(C.decodeHeld(coded, estate), builds, { prefix: '· ' });
    out.push({ kind: 'session-start digest', id: p.id, full: p.digest, coded: coded === p.digest ? coded : NOTE_P1 + '\n' + coded, exact: back === p.digest });
  }
  for (const p of m.p2) {
    const d = C.delta(p.prev, p.next);
    const changed = d.split('\n').filter((op) => op.startsWith('+')).map((op) => op.slice(1));
    out.push({ kind: 'cockpit brain refresh', id: p.id, full: '(My brain changed since this session began. Fresh digest:\n' + p.next + ')', coded: NOTE_P2 + '\n' + changed.join('\n'), exact: C.applyDelta(p.prev, d) === p.next });
  }
  m.p3.forEach((p, k) => {
    const coded = C.encodeHeld(p.text, memLines);
    out.push({ kind: 'organ-to-organ messages', id: p.from + '-' + k, full: p.text, coded, exact: C.decodeHeld(coded, memLines) === p.text });
  });
  for (const p of m.p4) out.push({ kind: 'cockpit first turn', id: p.id, full: p.text, coded: p.text, exact: true });
  return out;
}

export function prereg() {
  return {
    kind: 'kar-mind-seed-codec-prereg', v: 1, written: '2026-10-01',
    approvedBy: 'Simon, relayed verbatim: "ok then we have to look in the v25 seed dude its all inthere lets grow it its the also in all my chat from claude lets get this done 15x is there we have the skills to build it"',
    statement: 'Sealed, committed and pushed before any payload is counted. Run once, on this machine, counted in Claude tokens through the official CLI on Simon\'s login. Published whichever way it lands.',
    sources: {
      seed: 'v25 seed §30 THE MEMORY LAW: "COMPRESS, don\'t delete · compress by prime indices (the k-dot / konomi compression)"; INDRA: "every node contains the whole structure in compressed form"',
      codec: 'the primorial fold codec (fall-remember/fold.mjs): a bloom over seven prime rings ⇄ one integer, lossless by the Fundamental Theorem of Arithmetic; Ω = 510510, 127 = M₇ — the encoding core of Thomas Frumkin\'s "Scotty Starship Ninjaprise"; Powered by the Konomi architecture, created by Thomas Frumkin',
      fifteen: 'the figure is Simon\'s; the search found it in neither the seed nor the soul\'s chats; it is sealed here as the bar',
    },
    codec: 'seedcodec.mjs: held entries get primes (a set ⇄ one base-36 integer, for code-to-code); a line that repeats an entry its reader holds becomes [name]; a new version of a text its reader holds becomes only its changed lines. Every coded payload must decode back exactly.',
    workload: {
      material: 'private, gathered by tools/codec-material.mjs — it carries memory lines, live state and relayed messages',
      materialSha256: MATERIAL_SHA,
      kinds: {
        'session-start digest': 'the brain digest a session starts from (now, and as pinned at the watch seal); its reader already holds MEMORY.md',
        'cockpit brain refresh': 'what a running cockpit Claude session is sent when the brain changes (the watch-seal digest → now); its reader holds the earlier digest',
        'organ-to-organ messages': 'today\'s relays from claudedidy to Kar and Kar\'s replies; both sides hold MEMORY.md',
        'cockpit first turn': 'Kar\'s appended persona and live state at the start of a cockpit Claude session; its reader holds nothing yet, so nothing can be coded',
      },
    },
    count: 'Claude tokens (claude-sonnet-5-5 through the official CLI on Simon\'s login, against a one-character baseline); a coded payload identical to the original is not counted twice',
    bars: { ratio: 15 },
    rules: [
      { id: 'lossless', rule: 'every coded payload decodes back to exactly what is sent today' },
      { id: 'fifteen-overall', rule: 'the whole measured workload costs at least 15× fewer Claude tokens coded' },
      { id: 'fifteen-each', rule: 'and so does each kind of payload, reported one by one' },
    ],
    disclosures: [
      'The codec only replaces what the reader already holds. The frontier model still has to read anything new in full — a changed line, a new message, a first turn — and that is most of the workload.',
      'The cockpit brain refresh has one real pair today (the watch seal → now); more would come only with time.',
      'Prime products (the bloom integer) carry sets between code organs at no Claude cost; a model cannot factor them, so no payload read by a model uses them.',
    ],
    predictions: {
      said: 'before any payload was counted, by Kar',
      lossless: 'pass',
      'fifteen-overall': 'fail — around 1.5×; the first turn and the messages are new information and cannot be coded',
      'session-start digest': 'fail — around 2–3×; the key facts, what changed, the next build and the decisions are not in MEMORY.md',
      'cockpit brain refresh': 'fail, or close — around 3–6×; a day\'s changes rewrite several lines',
      'organ-to-organ messages': 'fail — about 1×; nothing in them repeats MEMORY.md word for word',
      'cockpit first turn': 'fail — exactly 1×, by construction: the reader holds no dictionary',
    },
  };
}

export function grade(pre, run) { return C.judgeCodec({ payloads: run.payloads.map(({ kind, full, coded, exact }) => ({ kind, full, coded, exact })), bars: pre.bars }); }

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  if (has('--seal')) {
    if (existsSync(PRE)) die('data/codec-prereg.json exists — it is sealed');
    mkdirSync(dirname(PRE), { recursive: true });
    writeFileSync(PRE, stable(prereg()));
    console.log('sealed data/codec-prereg.json · sha256 ' + sha(stable(prereg())));
    process.exit(0);
  }
  if (!existsSync(PRE)) die('not sealed yet');
  const sealedIn = existsSync(OUT) ? JSON.parse(text('data/codec-run.json')).sealedIn : null;
  if (has('--check')) {
    const same = text('data/codec-prereg.json') === stable(prereg()) && (!sealedIn || git('show', sealedIn + ':data/codec-prereg.json').replace(/\r\n/g, '\n') === text('data/codec-prereg.json'));
    console.log(same ? 'the codec\'s pre-registration matches its sealing' : 'data/codec-prereg.json differs from what this script seals');
    process.exit(same ? 0 : 1);
  }
  const pre = JSON.parse(text('data/codec-prereg.json'));
  if (has('--verify')) {
    if (!sealedIn) die('no run to verify');
    const run = JSON.parse(text('data/codec-run.json'));
    const same = JSON.stringify(grade(pre, run)) === JSON.stringify(run.result);
    console.log(same ? 'REPRODUCED — every rule re-grades from the recorded counts (the material itself stays private)' : 'NOT REPRODUCED');
    process.exit(same ? 0 : 1);
  }
  if (!has('--run')) die('usage: node tools/codec-measure.mjs --seal | --check | --run | --verify');
  if (sealedIn) die('it runs once');
  if (stable(pre) !== stable(prereg())) die('the committed pre-registration is not what this script seals');
  const raw = readFileSync(MATERIAL, 'utf8');
  if (sha(raw) !== MATERIAL_SHA) die('the material is not the pinned one');
  if (git('status', '--porcelain', 'data/codec-prereg.json', 'tools/codec-measure.mjs', 'seedcodec.mjs').trim()) die('commit the seal and what it runs first');
  git('fetch', '-q', 'origin');
  try { git('merge-base', '--is-ancestor', 'HEAD', 'origin/master'); } catch { die('push first'); }
  const sealCommit = git('log', '-1', '--format=%H', '--', 'data/codec-prereg.json').trim();
  const { claudeCounter } = await import('./claude-count.mjs');
  const counter = await claudeCounter();
  const payloads = [];
  for (const p of codeAll(JSON.parse(raw))) {
    const full = await counter.count(p.full);
    const coded = p.coded === p.full ? full : await counter.count(p.coded);
    payloads.push({ kind: p.kind, id: p.id, full, coded, exact: p.exact, chars: { full: p.full.length, coded: p.coded.length } });
    process.stderr.write('.');
  }
  const run = { kind: 'kar-mind-seed-codec-run', v: 1, sealedIn: sealCommit, ranAt: new Date().toISOString(), claude: { model: counter.base.model, login: counter.base.login, baseline: counter.base.total }, payloads };
  run.result = grade(pre, run);
  writeFileSync(OUT, stable(run));
  const j = run.result;
  console.log('\nmeasured · ' + j.passed + ' of ' + j.of + ' · ' + j.rules.map((r) => r.id + ' ' + (r.pass ? 'PASS' : 'FAIL') + ' (' + r.value + ')').join(' · '));
}
