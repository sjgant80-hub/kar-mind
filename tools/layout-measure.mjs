// tools/layout-measure.mjs — does re-laying the digest (layout.mjs) make Kar's 7B read it right more often?
// (Kar 2026-10-05, the weekly choosing-session; the NEXT PASS the watch named.)
//
// The watch found the misses are reading misses on crowded lines, and a playbook rule did not fix them. This test
// changes the INPUT instead. Two arms, both the frozen watch route, greedy, the pinned system prompt, no playbook:
//   old    — the pinned system prompt exactly as the watch ran it (its digest in the old layout)
//   layout — the same prompt with only its digest re-laid by layout.mjs (lossless: every fact token survives)
// The 20 held-out questions are the watch's own. The re-laid prompt lives beside the pinned one (local, because the
// prompt carries sandbox lines); its sha256 is sealed here.
//
//   node tools/layout-measure.mjs --seal     write data/layout-prereg.json (refuses to overwrite) — commit + push first
//   node tools/layout-measure.mjs --check    exit 1 unless the seal is what this script writes
//   node tools/layout-measure.mjs --run      run both arms once on the local 7B, write data/layout-run.json
//   node tools/layout-measure.mjs --verify   re-grade every reply; exit 1 unless it matches the committed result
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { scoreAnswers } from '../brain.mjs';
import W from '../watch.mjs';
import { relayout, missingFacts } from '../layout.mjs';
import { HELD_OUT } from './watch-measure.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRE = 'data/layout-prereg.json', OUT = 'data/layout-run.json', WATCH_RUN = 'data/watch-run.json';
const FROZEN = 'C:/Users/sjgan/si-didy/kar-cockpit.watch-measure.mjs';
const FROZEN_SHA = '5f2117d48f3fe305aee64dbc55948e00f8acd03ebd494548490f7217511ec7b0';
const SYSTEM = join(homedir(), '.si-didy', 'brain', 'watch', 'system.txt');
const SYSTEM_SHA = 'f51ca2b315900ff926eb7148d99685133fb65665f04d3d3b67afff3ec6eebe51';
const LAID = join(homedir(), '.si-didy', 'brain', 'watch', 'system-layout.txt');
const text = (f) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const json = (f) => JSON.parse(text(f));
const sha = (s) => createHash('sha256').update(s).digest('hex');
const stable = (o) => JSON.stringify(o, null, 1) + '\n';
const die = (m) => { console.error(m); process.exit(1); };
const has = (f) => process.argv.includes(f);
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' });

function laid() {
  const sys = readFileSync(SYSTEM, 'utf8');
  if (sha(sys) !== SYSTEM_SHA) die('the pinned system prompt is not the sealed one');
  const out = relayout(sys.replace(/\r\n/g, '\n'));
  return { sys, out, lost: missingFacts(sys, out) };
}

export function prereg() {
  const { sys, out, lost } = laid();
  return {
    kind: 'kar-mind-layout-prereg', v: 1,
    question: 'If the digest Kar\'s direct line reads is re-laid so each fact sits on its own labelled line and the build list names newest, oldest and order, does his 7B answer more of the same questions right?',
    why: 'The watch (sealed cd4913b) found the misses are reading misses on crowded lines, and a playbook rule telling the model to read carefully did not cut them (11 repeats with it vs 10 without). This changes the input, not the instructions.',
    design: {
      arms: { old: 'the pinned system prompt exactly as the watch ran it', layout: 'the same prompt with only its digest re-laid by layout.mjs' },
      sameIn: 'both arms: the frozen watch route, greedy decoding, the brain pinned, no playbook, the 20 held-out questions of the watch, "Answer in one short line."',
      layout: 'layout.mjs relayout(): the ESTATE line and every recent build split into one clause per line at dashes, semicolons, middle dots, colons, commas, pluses, "but", "vs" and parentheses; the builds numbered #1 newest to #N oldest, each naming the build just before it. Nothing added that the digest did not say.',
      systemSha256: SYSTEM_SHA, laidSha256: sha(out), frozenSha256: FROZEN_SHA,
      chars: { old: sys.length, layout: out.length },
      factsLost: lost,
    },
    heldOut: HELD_OUT,
    rules: [
      { id: 'lossless', rule: 'every fact token of the old prompt is still in the re-laid one (decided at seal)' },
      { id: 'more-right', rule: 'the layout arm answers at least 2 more of the 20 right than the old arm' },
      { id: 'fewer-wrong-number', rule: 'the layout arm has at least 2 fewer wrong-number misses than the old arm' },
      { id: 'no-regression', rule: 'every question the old arm answers right, the layout arm answers right' },
      { id: 'floor-holds', rule: 'the old arm gives exactly the replies the watch\'s without-arm gave (greedy is greedy — else the noise floor is not zero)' },
    ],
    shipRule: 'the live digest switches to the new layout only if more-right AND no-regression both pass; otherwise the finding is recorded and the live digest stays as it is',
    predictions: {
      lossless: 'pass (checked at seal)',
      'more-right': 'unsure — the reading misses are the layout\'s target, but some clauses lose their label when split ("1 of 4" on its own line)',
      'fewer-wrong-number': 'pass, leaning — 8 of the old arm\'s 10 misses are wrong-number',
      'no-regression': 'fail, likely — the prompt changes in 700 characters and greedy outputs move everywhere',
      'floor-holds': 'pass',
    },
    honesty: [
      'Kar saw these 20 questions when he wrote them for the watch, and before he wrote layout.mjs. The layout was not tuned against them: it was written from the miss SHAPES the watch named, and sealed on first output without a dry run on the questions.',
      'One run of 20 questions on one 7B is a small test: a difference of one or two answers can be noise in what the changed text does to the model.',
    ],
  };
}

async function arm() {
  const c = await import(pathToFileURL(FROZEN).href);
  const out = [];
  for (const q of HELD_OUT) {
    const t = Date.now();
    const r = await c.route('local', [{ role: 'user', content: q.q + '\nAnswer in one short line.' }], false, true);
    out.push({ reply: r.text || '', tier: r.tier, model: r.model, ms: Date.now() - t, toolCalls: r.toolCalls || 0 });
    process.stderr.write(r.toolCalls ? 't' : '.');
  }
  process.stdout.write(JSON.stringify({ model: c.LOCAL_BIG, answers: out }));
}

export function grade(pre, run, watchRun) {
  const side = (a) => {
    const s = scoreAnswers(pre.heldOut, a.answers.map((x) => x.reply));
    const shapes = pre.heldOut.map((q, k) => (s.marks[k] ? '' : W.shapeOf({ expect: q.expect, reply: a.answers[k].reply, toolCalls: a.answers[k].toolCalls })));
    return { right: s.right, n: s.n, marks: s.marks, shapes, wrongNumber: shapes.filter((x) => x === 'wrong-number').length };
  };
  const old = side(run.arms.old), lay = side(run.arms.layout);
  const floor = watchRun.arms.without.answers.map((a) => a.reply);
  const rules = {
    lossless: pre.design.factsLost.length === 0,
    'more-right': lay.right >= old.right + 2,
    'fewer-wrong-number': lay.wrongNumber <= old.wrongNumber - 2,
    'no-regression': old.marks.every((m, k) => !m || lay.marks[k]),
    'floor-holds': run.arms.old.answers.every((a, k) => a.reply === floor[k]),
  };
  const held = Object.values(rules).filter(Boolean).length;
  return { old, layout: lay, rules, held, of: 5, ship: rules['more-right'] && rules['no-regression'] };
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  if (has('--arm')) { await arm(); process.exit(0); }
  if (has('--seal')) {
    if (existsSync(join(ROOT, PRE))) die(PRE + ' exists — the seal is written once');
    const p = prereg();
    if (p.design.factsLost.length) die('the layout loses facts: ' + p.design.factsLost.join(', '));
    writeFileSync(join(ROOT, PRE), stable(p));
    writeFileSync(LAID, laid().out);
    console.log('sealed ' + PRE + ' · sha256 ' + sha(stable(p)) + ' · laid prompt ' + p.design.laidSha256.slice(0, 12));
    process.exit(0);
  }
  if (has('--check')) { const same = text(PRE) === stable(prereg()); console.log(same ? 'the seal matches what this script writes' : 'the seal differs'); process.exit(same ? 0 : 1); }
  if (has('--verify')) {
    const pre = json(PRE), run = json(OUT);
    const same = JSON.stringify(grade(pre, run, json(WATCH_RUN))) === JSON.stringify(run.result);
    console.log(same ? 'REPRODUCED — every reply re-grades to the committed result' : 'NOT REPRODUCED'); process.exit(same ? 0 : 1);
  }
  if (!has('--run')) die('usage: node tools/layout-measure.mjs --seal | --check | --run | --verify');
  if (existsSync(join(ROOT, OUT))) die(OUT + ' exists — it runs once');
  const pre = json(PRE);
  if (text(PRE) !== stable(prereg())) die('the committed pre-registration is not what this script seals');
  if (sha(readFileSync(FROZEN)) !== FROZEN_SHA) die('the frozen route is not the sealed one');
  if (sha(readFileSync(LAID, 'utf8')) !== pre.design.laidSha256) die('the re-laid prompt is not the sealed one');
  if (git('status', '--porcelain', PRE, 'layout.mjs', 'tools/layout-measure.mjs', 'brain.mjs', 'watch.mjs').trim()) die('commit the seal and what it runs first');
  git('fetch', '-q', 'origin');
  try { git('merge-base', '--is-ancestor', 'HEAD', 'origin/master'); } catch { die('push first — HEAD is not on origin/master'); }
  const sealedIn = git('log', '-1', '--format=%H', '--', PRE).trim();
  const runArm = (file) => JSON.parse(execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--arm'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26,
    env: { ...process.env, KAR_SYSTEM_FILE: file, KAR_BRAIN: 'on', KAR_BRAIN_STYLE: 'v2', KAR_PLAYBOOK_FILE: '' }, stdio: ['ignore', 'pipe', 'inherit'] }));
  const startedAt = new Date().toISOString();
  process.stderr.write('old ');
  const old = runArm(SYSTEM);
  process.stderr.write('\nlayout ');
  const layout = runArm(LAID);
  const run = { kind: 'kar-mind-layout-run', v: 1, sealedIn, startedAt, finishedAt: new Date().toISOString(), arms: { old, layout } };
  run.result = grade(pre, run, json(WATCH_RUN));
  writeFileSync(join(ROOT, OUT), stable(run));
  const r = run.result;
  console.log('\nold ' + r.old.right + '/20 (wrong-number ' + r.old.wrongNumber + ') · layout ' + r.layout.right + '/20 (wrong-number ' + r.layout.wrongNumber + ') · ' + r.held + ' of 5 · ship ' + r.ship);
  for (const [k, v] of Object.entries(r.rules)) console.log('  ' + (v ? 'PASS ' : 'FAIL ') + k);
}
