#!/usr/bin/env node
// pattern-measure.mjs — SIMON'S PATTERN, SEALED BEFORE IT IS MEASURED (Kar, 2026-10-01; queue item 3).
// Simon, relayed verbatim: "yes go kar do the fix pass then my pattern lfg".
//
// Reads Simon's own sessions on this machine (they never leave it), finds every moment he was asked to decide and
// what he said, builds his director profile from the decisions BEFORE the split date, and predicts each decision
// AFTER it. What is published is aggregate: the profile's counts per type, and for each held-out decision only its
// date, type, his verdict and the predicted one, under an id salted with a key that stays on this machine. The
// words stay private (~/.si-didy/brain/pattern/).
//
//   node tools/pattern-measure.mjs --seal     write data/pattern-prereg.json (refuses to overwrite) — commit + push it first
//   node tools/pattern-measure.mjs --check    exit 1 unless the pre-registration is what this script seals
//   node tools/pattern-measure.mjs --run      refuses unless sealed, committed and on GitHub; runs once on THIS machine
//   node tools/pattern-measure.mjs --verify   recomputes every prediction and rate from the published counts; exit 1 unless it matches
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import P from '../pattern.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRE = join(ROOT, 'data', 'pattern-prereg.json'), OUT = join(ROOT, 'data', 'pattern-run.json');
const PRIVATE = join(homedir(), '.si-didy', 'brain', 'pattern');
const SESSIONS = join(homedir(), '.claude', 'projects', 'C--Users-sjgan--claude');
const text = (f) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const stable = (o) => JSON.stringify(o, null, 1) + '\n';
const die = (m) => { console.error(m); process.exit(1); };
const has = (f) => process.argv.includes(f);
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' });
const atCommit = (c) => (f) => git('show', c + ':' + f).replace(/\r\n/g, '\n');

export function prereg() {
  return {
    kind: 'kar-mind-pattern-prereg', v: 1, written: '2026-10-01',
    approvedBy: 'Simon, relayed verbatim: "yes go kar do the fix pass then my pattern lfg"',
    statement: 'Sealed, committed and pushed before the held-out decisions are scored. Run once, on this machine, over Simon\'s own sessions, which never leave it. Published whichever way it lands.',
    question: 'From his history alone, how well can Kar predict Simon\'s call on a decision — and is there any kind of decision he makes so predictably (95% or more) that it could stop needing him?',
    data: {
      source: 'Simon\'s sessions in this window (~/.claude/projects/C--Users-sjgan--claude/*.jsonl), read with si-didy sessions.mjs\'s gated rule for what Simon himself typed (not tool output, not injected text, not subagents)',
      decision: 'a reply to Simon that ends by asking him to choose (pattern.mjs isDecision), paired with his next message; the same exchange carried twice by a resumed session counts once (dedupe)',
      verdict: 'his answer as go (do it), all (when offered options, all of them) or no (not this, not now), by fixed rules (verdictOf); an answer that is a new instruction, a question back or a status has no verdict and is left out of the rates, counted',
      types: 'money, post (posting or outreach on his behalf), destroy, standing (schedules, startup, settings), choose (options offered), build, other — first match wins, in that order, read from the question itself (typeOf)',
      split: { trainBefore: '2026-09-24', heldFrom: '2026-09-24', heldTo: '2026-09-30', note: 'held out by date: the profile never sees a decision on or after 2026-09-24; decisions from 2026-10-01 (the day this was sealed) are not used at all' },
      privacy: 'the words stay on this machine; published are the profile\'s counts per type and, per held-out decision, its date, type, verdict and prediction under an id salted by a key that never leaves the machine',
    },
    profile: 'for each type, the verdict Simon gave most often before the split (ties go, then all, then no); a type never seen falls back to his most frequent verdict overall',
    bars: { overallAtLeast: 0.75, minHeld: 20, typeBar: 0.95, typeMinN: 10 },
    rules: [
      { id: 'enough', rule: 'at least 20 held-out decisions carry a verdict' },
      { id: 'overall', rule: 'the profile calls at least 75% of them right' },
      { id: 'beats-always-go', rule: 'it calls more right than simply predicting go every time' },
      { id: 'a-type-clears', rule: 'at least one type not on his key is called right 95% of the time or more, over at least 10 held-out decisions' },
    ],
    standing: 'A type that clears is only named; whether it stops needing Simon is his switch. Money, posting on his behalf and anything destructive stay his by his standing rule, however well they are predicted, and are never named.',
    disclosures: [
      'Kar has read some of the held-out sessions while working in them (this is the session that built the profile). The profile itself is only counts from before the split; the rules that read a decision were written from the training period.',
      'The verdict rules are deliberately strict: an answer that mixes a yes with a new instruction ("yes and also …") counts as go; one that does not start with a verdict counts as none. A human reading every answer would label some differently.',
      'Held out are the last seven days before the seal. Small numbers per type are expected; the Wilson lower bound is published beside every rate.',
    ],
    predictions: {
      said: 'before the held-out decisions were scored, by Kar',
      enough: 'pass — about 25 to 40 held-out decisions with a verdict',
      overall: 'unsure, around the bar — the profile called 73% of the training decisions right in-sample; held out it should be close to that',
      'beats-always-go': 'pass, narrowly — "go" is his commonest answer, so the profile wins only where he says no or all',
      'a-type-clears': 'fail — build is his most predictable kind and sat near 80% in training; I do not expect any type to reach 95% on ten or more',
    },
  };
}

// every exchange in his sessions: the reply that asked, his answer, the date
async function readExchanges() {
  const { isUser, textOf } = await import(pathToFileURL(join(homedir(), 'si-didy', 'sessions.mjs')).href);
  const out = [];
  for (const f of readdirSync(SESSIONS).filter((x) => x.endsWith('.jsonl')).sort()) {
    let last = '';
    for await (const line of createInterface({ input: createReadStream(join(SESSIONS, f)), crlfDelay: Infinity })) {
      let o; try { o = JSON.parse(line); } catch { continue; }
      if (o.type === 'assistant' && !o.isSidechain) {
        const c = o.message && o.message.content;
        const t = Array.isArray(c) ? c.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n').trim() : '';
        if (t) last = t;
        continue;
      }
      if (isUser(o)) { out.push({ at: String(o.timestamp || '').slice(0, 10), ask: last, reply: textOf(o) }); last = ''; }
    }
  }
  return out;
}

// from the published counts alone: the predictions, the rates, the rules
export function gradePattern(pre, run) {
  const prof = { byType: run.profile.byType, overall: run.profile.overall };
  const held = run.held.map((h) => ({ type: h.type, verdict: h.actual }));
  const s = P.score(prof, held, { bar: pre.bars.typeBar, minN: pre.bars.typeMinN });
  const predictedAsPublished = run.held.every((h, k) => s.marks[k].predicted === h.predicted);
  const { marks, ...summary } = s;
  return { summary, predictedAsPublished, judged: P.judgePattern(s, pre.bars) };
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  if (has('--seal')) {
    if (existsSync(PRE)) die('data/pattern-prereg.json exists — it is sealed');
    mkdirSync(dirname(PRE), { recursive: true });
    writeFileSync(PRE, stable(prereg()));
    console.log('sealed data/pattern-prereg.json · sha256 ' + sha(stable(prereg())));
    process.exit(0);
  }
  if (!existsSync(PRE)) die('not sealed yet — node tools/pattern-measure.mjs --seal');
  const sealedIn = existsSync(OUT) ? JSON.parse(text('data/pattern-run.json')).sealedIn : null;
  if (has('--check')) {
    const same = text('data/pattern-prereg.json') === stable(prereg()) && (!sealedIn || atCommit(sealedIn)('data/pattern-prereg.json') === text('data/pattern-prereg.json'));
    console.log(same ? 'the pattern\'s pre-registration matches its sealing' + (sealedIn ? ' in ' + sealedIn.slice(0, 7) : '') : 'data/pattern-prereg.json differs from what this script seals');
    process.exit(same ? 0 : 1);
  }
  const pre = JSON.parse(text('data/pattern-prereg.json'));
  if (has('--verify')) {
    if (!sealedIn) die('no data/pattern-run.json to verify');
    const run = JSON.parse(text('data/pattern-run.json'));
    const g = gradePattern(pre, run);
    const same = g.predictedAsPublished && JSON.stringify(g) === JSON.stringify(run.result);
    console.log(same ? 'REPRODUCED — every prediction and rate recomputes from the published counts' : 'NOT REPRODUCED');
    process.exit(same ? 0 : 1);
  }
  if (!has('--run')) die('usage: node tools/pattern-measure.mjs --seal | --check | --run | --verify');
  if (sealedIn) die('data/pattern-run.json exists — it runs once');
  if (stable(pre) !== stable(prereg())) die('the committed pre-registration is not what this script seals');
  if (git('status', '--porcelain', 'data/pattern-prereg.json', 'tools/pattern-measure.mjs', 'pattern.mjs').trim()) die('commit the seal and what it runs first');
  git('fetch', '-q', 'origin');
  try { git('merge-base', '--is-ancestor', 'HEAD', 'origin/master'); } catch { die('push first — HEAD is not on origin/master'); }
  const sealCommit = git('log', '-1', '--format=%H', '--', 'data/pattern-prereg.json').trim();

  mkdirSync(PRIVATE, { recursive: true });
  const saltFile = join(PRIVATE, 'salt');
  if (!existsSync(saltFile)) writeFileSync(saltFile, randomBytes(24).toString('hex'));
  const salt = readFileSync(saltFile, 'utf8').trim();
  const { trainBefore, heldFrom, heldTo } = pre.data.split;
  const all = P.dedupe(await readExchanges());
  const decisions = all.map((x) => ({ x, d: P.decisionOf(x) })).filter((y) => y.d);
  const train = decisions.filter((y) => y.d.at < trainBefore).map((y) => y.d);
  const heldAll = decisions.filter((y) => y.d.at >= heldFrom && y.d.at <= heldTo);
  const prof = P.profile(train);
  const held = heldAll.filter((y) => y.d.verdict);
  const id = (y) => sha(salt + '|' + y.x.at + '|' + y.x.reply + '|' + y.x.ask.slice(-400)).slice(0, 16);
  const count = (rows) => Object.fromEntries(P.TYPES.map((t) => [t, rows.filter((d) => d.type === t).length]));
  // the private record: every decision with its words, for Simon to audit on this machine
  writeFileSync(join(PRIVATE, 'decisions.json'), JSON.stringify(decisions.map((y) => ({ id: id(y), ...y.d, split: y.d.at < trainBefore ? 'train' : y.d.at <= heldTo ? 'held' : 'unused', ask: P.questionOf(y.x.ask), reply: y.x.reply.slice(0, 600) })), null, 1));
  const run = {
    kind: 'kar-mind-pattern-run', v: 1, sealedIn: sealCommit, ranAt: new Date().toISOString(),
    read: { exchanges: all.length, decisions: decisions.length, train: { decisions: decisions.filter((y) => y.d.at < trainBefore).length, withVerdict: train.filter((d) => d.verdict).length },
      held: { decisions: heldAll.length, withVerdict: held.length, withoutVerdictByType: count(heldAll.filter((y) => !y.d.verdict).map((y) => y.d)) } },
    profile: prof,
    held: held.map((y) => ({ id: id(y), at: y.d.at, type: y.d.type, actual: y.d.verdict, predicted: P.predict(prof, y.d.type) })),
  };
  run.result = gradePattern(pre, run);
  writeFileSync(OUT, stable(run));
  const j = run.result.judged;
  console.log('measured · ' + j.passed + ' of ' + j.of + ' rules · ' + j.rules.map((r) => r.id + ' ' + (r.pass ? 'PASS' : 'FAIL') + ' (' + r.value + ')').join(' · '));
}
