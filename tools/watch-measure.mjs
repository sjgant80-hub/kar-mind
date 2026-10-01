#!/usr/bin/env node
// watch-measure.mjs — KAR WATCHES HIMSELF, SEALED BEFORE IT IS MEASURED (Kar, 2026-10-01; queue item 4).
// Simon, relayed verbatim: "next watch".
//
// The loop (watch.mjs) reads every wrong answer Kar's direct line gave in the sealed runs so far — the brain's first
// measurement and both arms of its fix pass, 22 misses — for its shape, and writes playbook v1. The test: 20 new
// questions, written after the playbook, of the same shapes his misses took (several numbers on one line, a pair, a
// name). Both arms run the same frozen route with the same pinned system prompt, greedy decoding; the only difference
// is whether playbook v1 is in the prompt. A repeat mistake is a wrong answer whose shape the playbook already learned.
// Then the loop runs again on the held-out misses and writes playbook v2, which the live line carries.
//
//   node tools/watch-measure.mjs --seal     write data/watch-prereg.json + playbook v1 (refuses to overwrite) — commit + push first
//   node tools/watch-measure.mjs --check    exit 1 unless the seal and playbook v1 are what this script writes
//   node tools/watch-measure.mjs --run      refuses unless sealed, committed and on GitHub; runs once on THIS machine
//   node tools/watch-measure.mjs --verify   re-grades every reply and re-folds playbook v2; exit 1 unless it matches
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { scoreAnswers } from '../brain.mjs';
import W from '../watch.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRE = join(ROOT, 'data', 'watch-prereg.json'), OUT = join(ROOT, 'data', 'watch-run.json');
const PB1 = 'data/watch-playbook-v1.json', PB1TXT = 'data/watch-playbook-v1.txt', PB2 = 'data/watch-playbook-v2.json';
const FROZEN = 'C:/Users/sjgan/si-didy/kar-cockpit.watch-measure.mjs';
const FROZEN_SHA = '5f2117d48f3fe305aee64dbc55948e00f8acd03ebd494548490f7217511ec7b0';
const SYSTEM = join(homedir(), '.si-didy', 'brain', 'watch', 'system.txt');
const SYSTEM_SHA = 'f51ca2b315900ff926eb7148d99685133fb65665f04d3d3b67afff3ec6eebe51';
const LIVE_DIR = join(homedir(), '.si-didy', 'brain');
const text = (f) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const json = (f) => JSON.parse(text(f));
const sha = (s) => createHash('sha256').update(s).digest('hex');
const stable = (o) => JSON.stringify(o, null, 1) + '\n';
const die = (m) => { console.error(m); process.exit(1); };
const has = (f) => process.argv.includes(f);
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' });
const atCommit = (c) => (f) => git('show', c + ':' + f).replace(/\r\n/g, '\n');

// the runs the loop learns from, in order; each arm is one run of Kar's direct line with its brain
export const TRAINING = [
  { run: 1, prereg: 'data/brain-prereg.json', result: 'data/brain-run.json', arm: 'with', source: 'the brain\'s first measurement, with the brain' },
  { run: 2, prereg: 'data/brain-fix-prereg.json', result: 'data/brain-fix-run.json', arm: 'v1', source: 'the fix pass, the brain as first switched on' },
  { run: 3, prereg: 'data/brain-fix-prereg.json', result: 'data/brain-fix-run.json', arm: 'v2', source: 'the fix pass, the fixed brain' },
];
export function trainingMisses(read = json) {
  const misses = [], right = {};
  for (const t of TRAINING) {
    const qs = read(t.prereg).questions, answers = read(t.result).arms[t.arm].answers;
    misses.push(...W.missesOf(qs, answers, t.run, t.source));
    Object.assign(right, W.rightOf(qs, answers));
  }
  return { misses, right };
}
export function playbookV1(read = json) { const { misses, right } = trainingMisses(read); return W.playbook(misses, { right }); }

const Q = (q, expect) => ({ q, expect });
export const HELD_OUT = [
  Q('In Simon\'s pattern, how many of the 18 held-out decisions did the profile call right?', '\\b15\\b'),
  Q('In Simon\'s pattern, how many of the 18 would always saying go have called right?', '\\b17\\b'),
  Q('In Simon\'s pattern, of the 85 held-out asks, how many got a verdict from Simon?', '\\b18\\b'),
  Q('Which commit sealed Simon\'s pattern?', '4d21214'),
  Q('How many Claude models does the cockpit\'s selector list?', '\\b13\\b'),
  Q('How many of Simon\'s minted models are on the cockpit\'s selector?', '\\b7\\b'),
  Q('How many sealed rules held in the brain\'s fix pass?', '\\b4\\s*(\\/|of|out of)\\s*5\\b'),
  Q('In the brain\'s fix pass, how many of the 10 held-out questions did it get right?', '\\b8\\b'),
  Q('In the fix pass, how many times did the brain as first switched on reach for a tool?', '\\b5\\b'),
  Q('In the fix pass, how many of the 30 questions did the brain as first switched on get right?', '\\b17\\b'),
  Q('In Fall World\'s sealed trial of rules, which model scored 19 besides the 7B?', '\\b1\\s?B\\b'),
  Q('In kard-evolve\'s second experiment, at what median generation did the self-scoring creatures find U to V?', '(?:^|[^\\d.])1(?![\\d.])'),
  Q('In that experiment, at what median generation did the creatures that only had trials find it?', '\\b1\\.5\\b'),
  Q('How many repositories in the estate are private?', '\\b47\\b'),
  Q('How many repositories in the estate are public?', '\\b1,?721\\b'),
  Q('Which build did I finish just before Simon\'s pattern?', 'cockpit'),
  Q('What is the oldest build listed in my recent builds?', 'estate-basis-gate|basis'),
  Q('Which version of Claude Code does the cockpit run?', '2\\.1\\.284'),
  Q('How many wings and how many rooms did the living world add to Fall World?', '\\b2\\b[\\s\\S]{0,40}\\b10\\b'),
  Q('Against how many real model misreads were kard-evolve\'s creatures bred?', '\\b192\\b'),
];

export function prereg() {
  const pb = playbookV1();
  return {
    kind: 'kar-mind-watch-prereg', v: 1, written: '2026-10-01',
    approvedBy: 'Simon, relayed verbatim: "next watch"',
    statement: 'Sealed, committed and pushed before either arm is asked anything. Both arms run once, on this machine, through a frozen copy of the cockpit\'s local route. Published whichever way it lands.',
    question: 'When Kar\'s own misses are folded into a playbook he reads before answering, does his direct line repeat those kinds of mistake less on work it has not seen?',
    loop: {
      misses: 'every wrong answer Kar\'s direct line gave, with his brain, in the sealed runs so far (watch.mjs missesOf over ' + TRAINING.map((t) => t.source).join('; ') + ')',
      shapes: 'each miss read for its shape (watch.mjs shapeOf): tool-detour (went looking instead of reading the brain), wrong-number (a neighbouring number), half-pair (one of two asked), wrong-name (a neighbouring build, commit or name), no-answer',
      playbook: 'one rule per shape that has happened, ordered by count, with the latest real misses as examples (watch.mjs playbook); a shape not seen for three runs is retired; after every run the loop folds the new misses and writes the next version',
      v1: { file: PB1, text: PB1TXT, version: pb.version, learnedFrom: pb.learnedFrom, rules: pb.rules.map((r) => r.shape + ' ' + r.count) },
    },
    call: {
      route: 'si-didy/kar-cockpit.watch-measure.mjs route("local", [question], hasImages=false, hasFiles=true) — the fix pass\'s frozen route plus three changes, all the same for both arms: the system prompt read from a pinned file, greedy decoding (temperature 0, seed 7), and an 8k window',
      frozenSha256: FROZEN_SHA,
      systemSha256: SYSTEM_SHA,
      system: 'Kar\'s persona and live state (the brain as of the seal, morning line, shares, asks, lesson shapes) snapshotted once at the seal to ~/.si-didy/brain/watch/system.txt — kept on this machine because it carries his sandbox lines; pinned by its sha256',
      model: 'qwen2.5:7b through Ollama on this machine',
      arms: { without: 'the pinned system prompt alone', withLoop: 'the same, with playbook v1 appended' },
      order: 'without first, then with, each as its own process',
      ask: 'each question alone, no history, followed by: Answer in one short line.',
      graded: 'brain.mjs gradeAnswer: the reply matches the question\'s pattern, case-insensitive; a wrong reply\'s shape by watch.mjs shapeOf',
    },
    heldOut: HELD_OUT,
    bars: { fewerBy: 2 },
    rules: [
      { id: 'fewer-repeats', rule: 'with the playbook, at least 2 fewer wrong answers of a shape it learned than without' },
      { id: 'not-worse', rule: 'with the playbook, at least as many answers right as without' },
      { id: 'no-regression', rule: 'every question answered right without the playbook is answered right with it' },
      { id: 'loop-closes', rule: 'after the run, the loop folds the held-out misses into playbook v2, and the live direct line carries v2' },
    ],
    disclosures: [
      'The 20 held-out questions were written after playbook v1 and are deliberately of the shapes Kar\'s misses took — that is what a repeat mistake is. They were never used to build the playbook, and no held-out question appears in it.',
      'The playbook\'s rule wording was written by Kar once, per shape; which rules appear, in what order and with which examples is decided by the loop from the misses alone.',
      'Greedy decoding and a pinned prompt make both arms deterministic up to the playbook text, but one run of 20 questions on one 7B is a small test: a difference of one or two answers can be noise in what the extra text does to the model.',
      'The fix pass ran with the default window, which may have cut long tool turns; this test gives both arms an 8k window.',
    ],
    predictions: {
      said: 'before either arm was asked anything, by Kar',
      'fewer-repeats': 'unsure — the misses were mostly a neighbouring number on a crowded line; a rule plus two real examples should help a 7B a little, and two fewer is a real bar on 20 questions',
      'not-worse': 'pass',
      'no-regression': 'fail, likely — adding 2,000 characters changes greedy outputs everywhere, and one answer that flips from right to wrong fails this',
      'loop-closes': 'pass',
    },
  };
}

// one arm, its own process
async function arm() {
  const pre = json('data/watch-prereg.json');
  if (sha(readFileSync(FROZEN)) !== pre.call.frozenSha256) die('the frozen route is not the sealed one');
  if (sha(readFileSync(SYSTEM, 'utf8')) !== pre.call.systemSha256) die('the pinned system prompt is not the sealed one');
  const c = await import(pathToFileURL(FROZEN).href);
  const out = [];
  for (const q of pre.heldOut) {
    const t = Date.now();
    const r = await c.route('local', [{ role: 'user', content: q.q + '\nAnswer in one short line.' }], false, true);
    out.push({ reply: r.text || '', tier: r.tier, model: r.model, ms: Date.now() - t, toolCalls: r.toolCalls || 0, brainFirst: r.brainFirst || null, note: r.note || null });
    process.stderr.write(r.toolCalls ? 't' : '.');
  }
  process.stdout.write(JSON.stringify({ playbook: process.env.KAR_PLAYBOOK_FILE ? 'v1' : null, model: c.LOCAL_BIG, answers: out }));
}

// what the run's own misses make of the playbook: everything the loop has seen, the held-out run as run 4
export function playbookV2(pre, run, read = json) {
  const { misses, right } = trainingMisses(read);
  const held = [...W.missesOf(pre.heldOut, run.arms.without.answers, 4, 'the watch test, without the playbook'), ...W.missesOf(pre.heldOut, run.arms.withLoop.answers, 4, 'the watch test, with playbook v1')];
  Object.assign(right, W.rightOf(pre.heldOut, run.arms.without.answers), W.rightOf(pre.heldOut, run.arms.withLoop.answers));
  return W.playbook([...misses, ...held], { right, prevVersion: 1 });
}

export function gradeWatch(pre, run) {
  const side = (a) => {
    const s = scoreAnswers(pre.heldOut, a.answers.map((x) => x.reply));
    const shapes = pre.heldOut.map((q, k) => (s.marks[k] ? '' : W.shapeOf({ expect: q.expect, reply: a.answers[k].reply, toolCalls: a.answers[k].toolCalls })));
    return { right: s.right, n: s.n, marks: s.marks, shapes };
  };
  const without = side(run.arms.without), withLoop = side(run.arms.withLoop);
  const learned = pre.loop.v1.rules.map((r) => r.split(' ')[0]);
  return { without, withLoop, learned, judged: W.judgeWatch({ without, withLoop, learned, loopCloses: run.loop.closes, bars: pre.bars }) };
}

// THE LOOP, kept running: every session start folds every sealed run it knows into the live playbook
// (si-didy morning-surface.mjs calls this), which the direct line reads with the brain.
export function refold() {
  const pre = existsSync(PRE) ? json('data/watch-prereg.json') : null;
  const run = existsSync(OUT) ? json('data/watch-run.json') : null;
  const pb = pre && run ? playbookV2(pre, run) : playbookV1();
  mkdirSync(LIVE_DIR, { recursive: true });
  writeFileSync(join(LIVE_DIR, 'playbook.json'), stable(pb));
  writeFileSync(join(LIVE_DIR, 'playbook.txt'), W.renderPlaybook(pb) + '\n');
  return pb;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  if (has('--arm')) { await arm(); process.exit(0); }
  if (has('--refold')) { const pb = refold(); console.log('playbook v' + pb.version + ' · ' + pb.rules.map((r) => r.shape + ' ' + r.count).join(', ')); process.exit(0); }
  if (has('--seal')) {
    if (existsSync(PRE)) die('data/watch-prereg.json exists — it is sealed');
    mkdirSync(dirname(PRE), { recursive: true });
    const pb = playbookV1();
    writeFileSync(join(ROOT, PB1), stable(pb));
    writeFileSync(join(ROOT, PB1TXT), W.renderPlaybook(pb) + '\n');
    writeFileSync(PRE, stable(prereg()));
    console.log('sealed data/watch-prereg.json · sha256 ' + sha(stable(prereg())) + ' · playbook v1: ' + pb.rules.map((r) => r.shape + ' ' + r.count).join(', '));
    process.exit(0);
  }
  if (!existsSync(PRE)) die('not sealed yet — node tools/watch-measure.mjs --seal');
  const sealedIn = existsSync(OUT) ? json('data/watch-run.json').sealedIn : null;
  if (has('--check')) {
    const pb = playbookV1();
    const same = text('data/watch-prereg.json') === stable(prereg()) && text(PB1) === stable(pb) && text(PB1TXT) === W.renderPlaybook(pb) + '\n'
      && (!sealedIn || atCommit(sealedIn)('data/watch-prereg.json') === text('data/watch-prereg.json'));
    console.log(same ? 'the watch\'s pre-registration and playbook v1 match their sealing' + (sealedIn ? ' in ' + sealedIn.slice(0, 7) : '') : 'the watch\'s seal differs from what this script writes');
    process.exit(same ? 0 : 1);
  }
  const pre = json('data/watch-prereg.json');
  if (has('--verify')) {
    if (!sealedIn) die('no data/watch-run.json to verify');
    const run = json('data/watch-run.json');
    const same = JSON.stringify(gradeWatch(pre, run)) === JSON.stringify(run.result) && text(PB2) === stable(playbookV2(pre, run));
    console.log(same ? 'REPRODUCED — every reply re-grades to the committed result, and playbook v2 re-folds from the runs' : 'NOT REPRODUCED');
    process.exit(same ? 0 : 1);
  }
  if (!has('--run')) die('usage: node tools/watch-measure.mjs --seal | --check | --run | --verify');
  if (sealedIn) die('data/watch-run.json exists — it runs once');
  if (stable(pre) !== stable(prereg())) die('the committed pre-registration is not what this script seals');
  if (sha(readFileSync(FROZEN)) !== FROZEN_SHA) die('the frozen route is not the sealed one');
  if (sha(readFileSync(SYSTEM, 'utf8')) !== SYSTEM_SHA) die('the pinned system prompt is not the sealed one');
  if (git('status', '--porcelain', 'data/watch-prereg.json', PB1, PB1TXT, 'tools/watch-measure.mjs', 'watch.mjs', 'brain.mjs').trim()) die('commit the seal and what it runs first');
  git('fetch', '-q', 'origin');
  try { git('merge-base', '--is-ancestor', 'HEAD', 'origin/master'); } catch { die('push first — HEAD is not on origin/master'); }
  const sealCommit = git('log', '-1', '--format=%H', '--', 'data/watch-prereg.json').trim();
  const runArm = (env) => JSON.parse(execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--arm'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26,
    env: { ...process.env, KAR_SYSTEM_FILE: SYSTEM, KAR_BRAIN: 'on', KAR_BRAIN_STYLE: 'v2', ...env }, stdio: ['ignore', 'pipe', 'inherit'] }));
  const started = new Date().toISOString();
  process.stderr.write('without ');
  const without = runArm({ KAR_PLAYBOOK_FILE: '' });
  process.stderr.write('\nwith ');
  const withLoop = runArm({ KAR_PLAYBOOK_FILE: join(ROOT, PB1TXT) });
  const run = { kind: 'kar-mind-watch-run', v: 1, sealedIn: sealCommit, startedAt: started, finishedAt: new Date().toISOString(), arms: { without, withLoop } };
  // THE LOOP CLOSES: the held-out misses rewrite the playbook; the live line reads the new version
  const v2 = playbookV2(pre, run);
  writeFileSync(join(ROOT, PB2), stable(v2));
  mkdirSync(LIVE_DIR, { recursive: true });
  writeFileSync(join(LIVE_DIR, 'playbook.json'), stable(v2));
  writeFileSync(join(LIVE_DIR, 'playbook.txt'), W.renderPlaybook(v2) + '\n');
  const cockpit = await import(pathToFileURL('C:/Users/sjgan/si-didy/kar-cockpit.mjs').href);
  const carries = cockpit.karLiveState('').includes('MY PLAYBOOK — rules I wrote from my own past misses (version 2,');
  run.loop = { closes: v2.version === 2 && v2.learnedFrom > json(PB1).learnedFrom && carries, v2: { version: v2.version, learnedFrom: v2.learnedFrom, rules: v2.rules.map((r) => r.shape + ' ' + r.count), retired: v2.retired }, liveCarries: carries };
  run.result = gradeWatch(pre, run);
  writeFileSync(OUT, stable(run));
  const j = run.result.judged;
  console.log('\nmeasured · ' + j.passed + ' of ' + j.of + ' rules · ' + j.rules.map((r) => r.id + ' ' + (r.pass ? 'PASS' : 'FAIL') + ' (' + r.value + ')').join(' · '));
}
