#!/usr/bin/env node
// brain-measure.mjs — DOES THE SWITCHED-ON BRAIN REACH KAR'S DIRECT LINE? Sealed before it is measured.
//
// The cockpit (si-didy/kar-cockpit.mjs, Simon's direct line to Kar) answered from a persona and a small
// bundle; asked on the local tier what Kar had built, it confabulated (2026-09-22, kar-covenant-design).
// The brain now rides in every message. This asks the cockpit's own local route the same 20 questions
// about the estate's real recent state twice — once as it was (KAR_BRAIN=off) and once with the brain —
// and grades every reply by a rule. Plus the two wire checks: the soul takes a new memory in without a
// restart, and the session-start digest carries the last build and the next one with nobody relaying.
//
//   node brain-measure.mjs --seal     write data/brain-prereg.json (refuses to overwrite) — commit + push it first
//   node brain-measure.mjs --check    exit 1 unless the pre-registration is what this script seals
//   node brain-measure.mjs --run      refuses unless sealed, committed and on GitHub; runs once on THIS machine
//   node brain-measure.mjs --verify   re-grades every recorded reply; exit 1 unless it matches
//
// Everything runs on this machine (Ollama, the local cockpit route, the local soul). Nothing is sent out.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { scoreAnswers, judgeBrain } from './brain.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PRE = join(ROOT, 'data', 'brain-prereg.json'), OUT = join(ROOT, 'data', 'brain-run.json');
const COCKPIT = 'C:/Users/sjgan/si-didy/kar-cockpit.mjs', SOUL = 'http://127.0.0.1:8791';
const MEM = join(homedir(), '.claude', 'projects', 'C--Users-sjgan--claude', 'memory');
const text = (f) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const stable = (o) => JSON.stringify(o, null, 1) + '\n';
const die = (m) => { console.error(m); process.exit(1); };
const has = (f) => process.argv.includes(f);
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' });
const atCommit = (c) => (f) => git('show', c + ':' + f).replace(/\r\n/g, '\n');

const Q = (q, expect, from) => ({ q, expect, from });
function prereg() {
  return {
    kind: 'kar-mind-brain-prereg', v: 1, written: '2026-10-01',
    approvedBy: 'Simon, relayed verbatim: "yes go kar build the brain after the ecosystem lfg"',
    statement: 'Sealed, committed and pushed before the cockpit is asked anything. Both arms run once, on this machine, through the cockpit\'s own local route. Published whichever way it lands.',
    question: 'With the brain switched on, does Kar\'s direct line know the estate\'s real recent state, where without it the same line guesses?',
    call: {
      route: 'si-didy/kar-cockpit.mjs route("local", [question], hasImages=false, hasFiles=true) — the same function a cockpit message goes through, its read tools offered and its write tools withheld for the test; the HTTP layer and Simon\'s conversation history are not touched',
      model: 'the cockpit\'s local model (KAR_LOCAL, default qwen2.5:7b), through Ollama on this machine',
      arms: { without: 'KAR_BRAIN=off: the cockpit exactly as it was (its persona, morning line, shares, asks and lesson shapes)', with: 'the same, plus the brain digest read from the persistent journal on every message' },
      ask: 'each question alone, no conversation history, followed by: Answer in one short line.',
      graded: 'brain.mjs gradeAnswer: the reply matches the question\'s pattern, case-insensitive',
    },
    questions: [
      Q('Which commit is Fall World live at?', '2d57105', 'fallworld'),
      Q('How many cards are in Fall World\'s deck?', '\\b664\\b', 'fallworld'),
      Q('In Fall World\'s sealed trial of rules, how many of the 60 cards did the 14B model get right?', '\\b37\\b', 'fallworld'),
      Q('What was the bar in that trial, out of 60?', '\\b57\\b', 'fallworld'),
      Q('How many of that trial\'s sealed rules held?', '\\b2\\s*(\\/|of|out of)\\s*4\\b', 'fallworld'),
      Q('In that trial, how many of the 60 did the 1B model get right?', '\\b19\\b', 'fallworld'),
      Q('How many NFT mechanics does Fall World\'s explainer map?', '\\b14\\b', 'fallworld'),
      Q('Which commit is fallkard-forge live at?', 'c24f5e4', 'fallkard-forge'),
      Q('Read rule 0.2 makes the card reader read which letter as which?', '\\bU\\b[^.]{0,60}\\bV\\b', 'fallkard-forge'),
      Q('Across how many reads was read rule 0.2 measured?', '\\b960\\b', 'fallkard-forge'),
      Q('At 35% size, how many of the 64 copies resolved to the right card before read rule 0.2, and how many after?', '\\b57\\b[\\s\\S]{0,80}\\b64\\b', 'fallkard-forge'),
      Q('What did fallkard-forge\'s paid vision read cost, in dollars?', '0?\\.207', 'fallkard-forge'),
      Q('What is the key of kard-evolve\'s champion creature?', 'UV\\s*\\|\\s*515', 'kard-evolve'),
      Q('How many held-out cards did that champion get right?', '\\b352\\b', 'kard-evolve'),
      Q('How many held-out cards did generation 0 get right?', '\\b244\\b', 'kard-evolve'),
      Q('In the second creature experiment, at what median generation did the blind creatures find U to V?', '\\b6\\.5\\b', 'kard-evolve'),
      Q('How many repositories are in the estate index?', '\\b1,?768\\b', 'the estate'),
      Q('How many of the estate\'s pages are HTTP-verified live?', '\\b540\\b', 'the estate'),
      Q('What did fallfloor-enterprise\'s mutation gate score?', '\\b269\\s*\\/\\s*269\\b', 'fallfloor-enterprise'),
      Q('Which decision is waiting on Simon right now?', 'log ?on|startup|start up|at login', 'the queue'),
    ],
    bars: { withAtLeast: 16, withoutAtMost: 4, liftAtLeast: 10 },
    live: {
      soulLive: 'a memory file written after the soul booted, carrying a token nothing else holds, is found by the soul\'s /find within 60 seconds, with no restart',
      loopCloses: 'the digest the session start reads (brain-cli readDigest, the call morning-surface.mjs makes) names the newest build in MEMORY.md and the next build in the queue',
    },
    rules: [
      { id: 'brain-grounds', rule: 'with the brain, at least 16 of the 20 replies are right' },
      { id: 'without-guesses', rule: 'without it, at most 4 of the 20 are right' },
      { id: 'lift', rule: 'the brain adds at least 10 right answers' },
      { id: 'keeps-what-it-knew', rule: 'every question answered right without the brain is still answered right with it' },
      { id: 'soul-live', rule: 'the soul finds a newly written memory without a restart' },
      { id: 'loop-closes', rule: 'the session start carries the newest build and the next one from the journal, with nobody relaying' },
    ],
    predictions: {
      said: 'before the cockpit was asked anything, by Kar',
      'brain-grounds': 'pass — I expect 17 to 19: a 7B reading a short, true digest should find most numbers; the U-to-V and 57-then-64 questions are the ones it may fumble',
      'without-guesses': 'pass — I expect 0 to 2; it has read tools, but on 2026-09-22 the same line confabulated rather than look',
      lift: 'pass',
      'keeps-what-it-knew': 'pass',
      'soul-live': 'pass',
      'loop-closes': 'pass',
    },
  };
}

// one arm, run as its own process so KAR_BRAIN is set before the cockpit module loads
async function arm() {
  const pre = JSON.parse(text('data/brain-prereg.json'));
  const c = await import(pathToFileURL(COCKPIT).href);
  const brain = await c.brainNow();
  const out = [];
  for (const q of pre.questions) {
    const t = Date.now();
    const r = await c.route('local', [{ role: 'user', content: q.q + '\nAnswer in one short line.' }], false, true);
    out.push({ reply: r.text || '', tier: r.tier, model: r.model, ms: Date.now() - t, note: r.note || null });
    process.stderr.write('.');
  }
  process.stdout.write(JSON.stringify({ brainSha256: brain ? sha(brain) : null, brainChars: brain.length, model: c.LOCAL_BIG, answers: out }));
}

function grade(pre, run) {
  const withBrain = scoreAnswers(pre.questions, run.arms.with.answers.map((a) => a.reply));
  const without = scoreAnswers(pre.questions, run.arms.without.answers.map((a) => a.reply));
  return { withBrain, without, judged: judgeBrain({ withBrain, without, live: { soulLive: run.live.soulLive.ok, loopCloses: run.live.loopCloses.ok }, bars: pre.bars }) };
}

if (has('--arm')) { await arm(); process.exit(0); }
if (has('--seal')) {
  if (existsSync(PRE)) die('data/brain-prereg.json exists — it is sealed');
  mkdirSync(dirname(PRE), { recursive: true });
  writeFileSync(PRE, stable(prereg()));
  console.log('sealed data/brain-prereg.json · sha256 ' + sha(stable(prereg())));
  process.exit(0);
}
if (!existsSync(PRE)) die('not sealed yet — node brain-measure.mjs --seal');
const sealedIn = existsSync(OUT) ? JSON.parse(text('data/brain-run.json')).sealedIn : null;
if (has('--check')) {
  const same = text('data/brain-prereg.json') === stable(prereg()) && (!sealedIn || atCommit(sealedIn)('data/brain-prereg.json') === text('data/brain-prereg.json'));
  console.log(same ? 'the brain\'s pre-registration matches its sealing' + (sealedIn ? ' in ' + sealedIn.slice(0, 7) : '') : 'data/brain-prereg.json differs from what this script seals');
  process.exit(same ? 0 : 1);
}
const pre = JSON.parse(text('data/brain-prereg.json'));
if (has('--verify')) {
  if (!sealedIn) die('no data/brain-run.json to verify');
  const run = JSON.parse(text('data/brain-run.json'));
  const same = JSON.stringify(grade(pre, run)) === JSON.stringify(run.result);
  console.log(same ? 'REPRODUCED — every recorded reply re-grades to the committed result' : 'NOT REPRODUCED');
  process.exit(same ? 0 : 1);
}
if (!has('--run')) die('usage: node brain-measure.mjs --seal | --check | --run | --verify');
if (sealedIn) die('data/brain-run.json exists — it runs once');
if (stable(pre) !== stable(prereg())) die('the committed pre-registration is not what this script seals');
if (git('status', '--porcelain', 'data/brain-prereg.json', 'brain-measure.mjs', 'brain.mjs', 'brain-cli.mjs').trim()) die('commit the seal and what it runs first');
git('fetch', '-q', 'origin');
try { git('merge-base', '--is-ancestor', 'HEAD', 'origin/master'); } catch { die('push first — HEAD is not on origin/master'); }
const sealCommit = git('log', '-1', '--format=%H', '--', 'data/brain-prereg.json').trim();

const runArm = (env) => JSON.parse(execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--arm'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'inherit'] }));
const started = new Date().toISOString();
const arms = { without: runArm({ KAR_BRAIN: 'off' }), with: runArm({ KAR_BRAIN: 'on' }) };

// the two wire checks
const token = 'brainwire' + [...randomBytes(6)].map((b) => 'abcdefghijklmnopqrstuvwxyz'[b % 26]).join('');
const memFile = join(MEM, 'kar-brain-on.md');
writeFileSync(memFile, '---\nname: kar-brain-on\ndescription: "The brain switched on (2026-10-01): the persistent journal as Kar\'s working memory, the soul taking memory in live, the cockpit carrying the brain, the build loop from the queue. Live-ingest probe ' + token + '."\nmetadata:\n  type: project\n---\n\nThe soul\'s live-ingest probe for the sealed brain measurement: ' + token + '.\n');
const t0 = Date.now();
let found = false, waited = 0, findHits = 0;
while (Date.now() - t0 < 60000 && !found) {
  await new Promise((r) => setTimeout(r, 2000));
  try {
    const j = await (await fetch(SOUL + '/find?q=' + token + '&k=3', { signal: AbortSignal.timeout(10000) })).text();
    findHits = (j.match(new RegExp(token, 'g')) || []).length;
    found = findHits > 0;
  } catch { /* soul busy — keep polling inside the minute */ }
  waited = Date.now() - t0;
}
const cli = await import('./brain-cli.mjs');
await cli.ingest();
const digestText = await cli.readDigest({ mark: false, now: 0 });
let newest = null;
try { newest = (readFileSync(join(MEM, 'MEMORY.md'), 'utf8').match(/^\*\*Recent builds[^\n]*\n- \[([^\]]+)\]/m) || [])[1] || null; } catch { /* */ }
const nextLine = (digestText.match(/^NEXT BUILD[^\n]*$/m) || [''])[0];
const live = {
  soulLive: { ok: found, token, waitedMs: waited, hits: findHits },
  loopCloses: { ok: !!newest && digestText.includes('· ' + newest + ' — ') && /^NEXT BUILD \(Simon's approved order\): \d+ · /.test(nextLine), newest, nextLine, wiredInSessionStart: /brain-cli\.mjs/.test(readFileSync('C:/Users/sjgan/si-didy/morning-surface.mjs', 'utf8')) },
};
const run = { kind: 'kar-mind-brain-run', v: 1, sealedIn: sealCommit, startedAt: started, finishedAt: new Date().toISOString(), arms, live };
run.result = grade(pre, run);
writeFileSync(OUT, stable(run));
console.log('\nmeasured · ' + run.result.judged.passed + ' of ' + run.result.judged.of + ' rules · with ' + run.result.withBrain.right + '/20 · without ' + run.result.without.right + '/20 · soul-live ' + found + ' · loop ' + live.loopCloses.ok);
