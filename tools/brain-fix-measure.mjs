#!/usr/bin/env node
// brain-fix-measure.mjs — THE BRAIN'S FIX PASS, SEALED BEFORE IT IS MEASURED (Kar, 2026-10-01).
// Simon, relayed verbatim: "yes go kar do the fix pass then my pattern lfg".
//
// The first measurement (data/brain-prereg.json, sealed ff14f88) landed 5 of 6: the cockpit's local 7B got 14 of 20
// with the brain against 0 of 20 without, under the bar of 16. Reading its replies: the 7B detoured into tools for
// facts the digest already held, and one build's facts never reached the digest. The fix: each recent build carries
// its own key facts (brain.mjs keyFactsOf), the window holds 8 builds where it held 6, and the local line answers
// from the brain in a first turn with no tools — only a reply that puts off answering or admits it does not know
// (brain.mjs needsLook) earns the tool turns. This measures the fix against the brain as first switched on, on the
// first measurement's 20 questions plus 10 held out, through a frozen copy of the cockpit's route.
//
//   node tools/brain-fix-measure.mjs --seal     write data/brain-fix-prereg.json (refuses to overwrite) — commit + push it first
//   node tools/brain-fix-measure.mjs --check    exit 1 unless the pre-registration is what this script seals
//   node tools/brain-fix-measure.mjs --run      refuses unless sealed, committed and on GitHub; runs once on THIS machine
//   node tools/brain-fix-measure.mjs --verify   re-grades every recorded reply; exit 1 unless it matches
//
// Everything runs on this machine (Ollama and the frozen local cockpit route). Nothing is sent out.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { scoreAnswers, judgeFix } from '../brain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRE = join(ROOT, 'data', 'brain-fix-prereg.json'), OUT = join(ROOT, 'data', 'brain-fix-run.json');
const FROZEN = 'C:/Users/sjgan/si-didy/kar-cockpit.fix-measure.mjs';
const FROZEN_SHA = '974d43fe94c08c1549b889c6f00885ef51522e8bdc3c952cdd19251d15b44692';
const text = (f) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const stable = (o) => JSON.stringify(o, null, 1) + '\n';
const die = (m) => { console.error(m); process.exit(1); };
const has = (f) => process.argv.includes(f);
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' });
const atCommit = (c) => (f) => git('show', c + ':' + f).replace(/\r\n/g, '\n');

const Q = (q, expect, from) => ({ q, expect, from });
// written after the fix was built and never used to build it; each is a fact the brain's memory carries
const HELD_OUT = [
  Q('By which generation had kard-evolve\'s champion swept all 48 damaged seals?', '\\b21\\b', 'kard-evolve'),
  Q('On the real reads, how many did kard-evolve\'s champion get right, against how many for the reader it replaced?', '96[\\s\\S]{0,40}94', 'kard-evolve'),
  Q('In fallkard-forge\'s sealed survival run, how many of the realistic copies resolved?', '576\\s*\\/\\s*576', 'fallkard-forge'),
  Q('How many staff hours a year does fallfloor-enterprise say the local-first route gives back?', '61\\s*k|61,0', 'fallfloor-enterprise'),
  Q('How many signed hops did fallfloor\'s laptop mesh record?', '\\b898\\b', 'fallfloor'),
  Q('How many of fallfloor\'s pre-registered rules passed?', '\\b3\\s*(\\/|of|out of)\\s*5\\b', 'fallfloor'),
  Q('In Fall World\'s sealed trial of rules, how many of the 60 did the 7B model get right?', '\\b19\\b', 'fallworld'),
  Q('What is the newest build in the estate?', 'kar-brain-on|brain switched on|switched the brain on|the brain', 'kar-brain-on'),
  Q('In the brain\'s first sealed measurement, how many of the 20 did the cockpit get right with the brain, and how many without it?', '\\b14\\b[\\s\\S]{0,60}\\b0\\b', 'kar-brain-on'),
  Q('Which commit is kar-mind live at?', 'e13b713', 'kar-brain-on'),
];

function prereg() {
  const first = JSON.parse(text('data/brain-prereg.json'));
  return {
    kind: 'kar-mind-brain-fix-prereg', v: 1, written: '2026-10-01',
    approvedBy: 'Simon, relayed verbatim: "yes go kar do the fix pass then my pattern lfg"',
    statement: 'Sealed, committed and pushed before either arm is asked anything. Both arms run once, on this machine, through a frozen copy of the cockpit\'s local route. Published whichever way it lands.',
    question: 'The brain\'s first measurement got 14 of 20 against a bar of 16: the 7B detoured into tools for facts its digest held, and one build\'s facts never reached the digest. With the fix, does the line clear the bar — and does it hold on questions written after the fix?',
    fix: {
      keyFacts: 'under each recent build, the facts from its own memory description that its index line leaves out (brain.mjs keyFactsOf)',
      window: 'the digest lists the 8 newest builds, where it listed 6',
      brainFirst: 'the local line answers in a first turn with no tools; only a reply that puts off answering or admits it does not know (brain.mjs needsLook) earns the turns with tools',
    },
    disclosures: [
      'The 10 held-out questions were written after the fix was built and were never used to tune it. Each asks for a fact the brain\'s memory carries, so this measures whether the line answers from its brain — not whether the brain knows more than its memory.',
      'The window grew from 6 builds to 8, so three held-out questions (fallfloor-enterprise and fallfloor) are about builds the v1 digest no longer lists; v1 can still reach them with its tools.',
      'fallworld\'s memory description was corrected while the brain was built; the first measurement\'s 20 questions are asked here unchanged.',
      'The cockpit has since been rebuilt (Claude Code under it). This measures a frozen copy of the route as it stood when the fix was made, named by its sha256 below; --run refuses any other file.',
      'A new memory written while the arms run would change the digest between them; nothing is written to memory during the run.',
    ],
    call: {
      route: 'si-didy/kar-cockpit.fix-measure.mjs route("local", [question], hasImages=false, hasFiles=true) — the cockpit\'s local route frozen at the fix, its read tools offered and its write tools withheld; no HTTP layer, no conversation history',
      frozenSha256: FROZEN_SHA,
      model: 'qwen2.5:7b through Ollama on this machine',
      arms: {
        v1: 'KAR_BRAIN_STYLE=v1: the brain exactly as first switched on — the old digest (6 recent builds, no key facts) and tools offered from the first turn',
        v2: 'the fix: key facts in the digest over 8 recent builds, and the brain answered from before any tool is offered',
      },
      order: 'v1 first, then v2, each as its own process',
      ask: 'each question alone, no conversation history, followed by: Answer in one short line.',
      graded: 'brain.mjs gradeAnswer: the reply matches the question\'s pattern, case-insensitive',
    },
    questions: [...first.questions, ...HELD_OUT],
    original: first.questions.length,
    bars: { originalAtLeast: 16, heldAtLeast: 8, beatsBy: 5 },
    rules: [
      { id: 'original-bar', rule: 'the fixed line gets at least 16 of the first measurement\'s 20 right' },
      { id: 'held-out-bar', rule: 'and at least 8 of the 10 held-out questions' },
      { id: 'beats-v1', rule: 'it gets at least 5 more of the 30 right than the brain as first switched on' },
      { id: 'no-regression', rule: 'every one of the 20 the first brain gets right, the fixed one gets right too' },
      { id: 'fewer-tools', rule: 'it reaches for a tool on fewer questions than the first brain' },
    ],
    predictions: {
      said: 'before either arm was asked anything, by Kar',
      'original-bar': 'pass — 17 or 18: the facts it missed are in the digest now and it no longer wanders off to look; the U-to-V and 57-then-64 questions are still the ones a 7B can fumble',
      'held-out-bar': 'pass, narrowly — 8 or 9; the two-number questions (96 vs 94, 14 and 0) are the risk',
      'beats-v1': 'pass — v1 should score near its first 14 on the 20 and lose most of the held-out builds that fell out of its window',
      'no-regression': 'unsure — a 7B is noisy, and one question v1 gets right by luck that v2 misses fails this rule',
      'fewer-tools': 'pass — v2 should reach for a tool on only a handful of questions; v1 reached for one on most',
    },
  };
}

// one arm, run as its own process so KAR_BRAIN_STYLE is set before the frozen route loads
async function arm() {
  const pre = JSON.parse(text('data/brain-fix-prereg.json'));
  if (sha(readFileSync(FROZEN)) !== pre.call.frozenSha256) die('the frozen route is not the sealed one');
  const c = await import(pathToFileURL(FROZEN).href);
  const brain = await c.brainNow();
  const out = [];
  for (const q of pre.questions) {
    const t = Date.now();
    const r = await c.route('local', [{ role: 'user', content: q.q + '\nAnswer in one short line.' }], false, true);
    out.push({ reply: r.text || '', tier: r.tier, model: r.model, ms: Date.now() - t, toolCalls: r.toolCalls || 0, brainFirst: r.brainFirst || null, note: r.note || null });
    process.stderr.write(r.toolCalls ? 't' : '.');
  }
  process.stdout.write(JSON.stringify({ style: process.env.KAR_BRAIN_STYLE === 'v1' ? 'v1' : 'v2', brainSha256: brain ? sha(brain) : null, brainChars: brain.length, model: c.LOCAL_BIG, answers: out }));
}

export function gradeFix(pre, run) {
  const s = (a) => scoreAnswers(pre.questions, a.answers.map((x) => x.reply));
  const v1 = s(run.arms.v1), v2 = s(run.arms.v2);
  const tools = (a) => a.answers.map((x) => x.toolCalls || 0);
  return { v1, v2, judged: judgeFix({ v1: { marks: v1.marks, tools: tools(run.arms.v1) }, v2: { marks: v2.marks, tools: tools(run.arms.v2) }, original: pre.original, bars: pre.bars }) };
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  if (has('--arm')) { await arm(); process.exit(0); }
  if (has('--seal')) {
    if (existsSync(PRE)) die('data/brain-fix-prereg.json exists — it is sealed');
    mkdirSync(dirname(PRE), { recursive: true });
    writeFileSync(PRE, stable(prereg()));
    console.log('sealed data/brain-fix-prereg.json · sha256 ' + sha(stable(prereg())));
    process.exit(0);
  }
  if (!existsSync(PRE)) die('not sealed yet — node tools/brain-fix-measure.mjs --seal');
  const sealedIn = existsSync(OUT) ? JSON.parse(text('data/brain-fix-run.json')).sealedIn : null;
  if (has('--check')) {
    const same = text('data/brain-fix-prereg.json') === stable(prereg()) && (!sealedIn || atCommit(sealedIn)('data/brain-fix-prereg.json') === text('data/brain-fix-prereg.json'));
    console.log(same ? 'the fix pass\'s pre-registration matches its sealing' + (sealedIn ? ' in ' + sealedIn.slice(0, 7) : '') : 'data/brain-fix-prereg.json differs from what this script seals');
    process.exit(same ? 0 : 1);
  }
  const pre = JSON.parse(text('data/brain-fix-prereg.json'));
  if (has('--verify')) {
    if (!sealedIn) die('no data/brain-fix-run.json to verify');
    const run = JSON.parse(text('data/brain-fix-run.json'));
    const same = JSON.stringify(gradeFix(pre, run)) === JSON.stringify(run.result);
    console.log(same ? 'REPRODUCED — every recorded reply re-grades to the committed result' : 'NOT REPRODUCED');
    process.exit(same ? 0 : 1);
  }
  if (!has('--run')) die('usage: node tools/brain-fix-measure.mjs --seal | --check | --run | --verify');
  if (sealedIn) die('data/brain-fix-run.json exists — it runs once');
  if (stable(pre) !== stable(prereg())) die('the committed pre-registration is not what this script seals');
  if (sha(readFileSync(FROZEN)) !== FROZEN_SHA) die('the frozen route ' + FROZEN + ' is not the sealed one');
  if (git('status', '--porcelain', 'data/brain-fix-prereg.json', 'tools/brain-fix-measure.mjs', 'brain.mjs', 'brain-cli.mjs').trim()) die('commit the seal and what it runs first');
  git('fetch', '-q', 'origin');
  try { git('merge-base', '--is-ancestor', 'HEAD', 'origin/master'); } catch { die('push first — HEAD is not on origin/master'); }
  const sealCommit = git('log', '-1', '--format=%H', '--', 'data/brain-fix-prereg.json').trim();
  const runArm = (env) => JSON.parse(execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--arm'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'inherit'] }));
  const started = new Date().toISOString();
  process.stderr.write('v1 ');
  const v1 = runArm({ KAR_BRAIN_STYLE: 'v1', KAR_BRAIN: 'on' });
  process.stderr.write('\nv2 ');
  const v2 = runArm({ KAR_BRAIN_STYLE: 'v2', KAR_BRAIN: 'on' });
  const run = { kind: 'kar-mind-brain-fix-run', v: 1, sealedIn: sealCommit, startedAt: started, finishedAt: new Date().toISOString(), arms: { v1, v2 } };
  run.result = gradeFix(pre, run);
  writeFileSync(OUT, stable(run));
  const j = run.result.judged;
  console.log('\nmeasured · ' + j.passed + ' of ' + j.of + ' rules · ' + j.rules.map((r) => r.id + ' ' + (r.pass ? 'PASS' : 'FAIL') + ' (' + r.value + ')').join(' · '));
}
