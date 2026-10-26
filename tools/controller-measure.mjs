#!/usr/bin/env node
// tools/controller-measure.mjs — the controller's sealed measurement (data/controller-prereg.json, sealed before
// controller.mjs existed).
//
//   node tools/controller-measure.mjs --check    exit 1 unless the seal is the file as committed, with K1–K7
//   node tools/controller-measure.mjs --run      run it (the seal committed and pushed first) → data/controller-run.json
//   node tools/controller-measure.mjs --verify   re-route, re-run the budget, re-read and re-grade every stored reply, re-judge;
//                                                exit 1 unless it all matches the committed result (CI runs this)
//
// The ideas are asked with ONE prompt on both tiers, built from the estate index's public descriptions and a fixed
// list of public recent builds (the receipt is public; the nightly loop also gives the soul's memory, locally). Every
// raw reply is stored, so the grading can be re-run anywhere without asking a model again.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { route, walletFor, reserve, ideaPrompt, readLocalIdea, ideaChecks, nightIdea } from '../controller.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRE = 'data/controller-prereg.json', OUT = 'data/controller-run.json';
const INDEX = 'C:/Users/sjgan/.claude/projects/C--Users-sjgan--claude/memory/estate-index.json';
const RECENT = ['fall-kit', 'break-it', 'konomi-slm', 'konomi-tongue', 'immune-exchange', 'kardlings'];
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' });
const die = (m) => { console.error(m); process.exit(1); };
const has = (f) => process.argv.includes(f);
const stable = (x) => JSON.stringify(x, null, 1) + '\n';
const prereg = () => JSON.parse(readFileSync(join(ROOT, PRE), 'utf8'));

// ── the parts anyone can re-run ──
function routing(p) {
  const misses = [];
  let right = 0;
  for (const [words, tier] of p.routing.tasks) { const r = route(words, { left: 100000, ceiling: 30000 }); if (r.tier === tier) right++; else misses.push({ words, sealed: tier, routed: r.tier }); }
  return { right, of: p.routing.tasks.length, misses };
}
function budget() {
  let s = walletFor(null, '2026-10-25', 100000);
  const authorised = [], after = [];
  for (let i = 0; i < 6; i++) {
    const left = s.wallet.budget.total - s.wallet.budget.spent;
    const r = route('propose tonight\u2019s build idea', { left, ceiling: 30000 });
    if (r.tier === 'frontier') { const res = reserve(s.wallet, 30000); authorised.push(res.ok); if (res.ok) s = { ...s, wallet: res.wallet }; }
    else { authorised.push(false); after.push(r); }
  }
  const next = walletFor(s, '2026-10-26', 100000);
  return { authorised, spent: s.wallet.budget.spent, refusedWentLocal: after.filter((r) => r.tier === 'local' && r.fallback === true).length, nextNightFresh: next.wallet.budget.spent === 0 && next.night === '2026-10-26' };
}
function grade(pair, ideas, repos) {
  return ideas.map((x, i) => ({ pair: pair[i], ...ideaChecks(x, { pair: pair[i], repos, others: ideas.filter((_, j) => j !== i && ideas[j] && typeof ideas[j].idea === 'string').map((y) => y.idea) }) }));
}
function judge(facts) {
  const f = facts, fr = f.frontier, lo = f.local;
  const frPass = fr.checks.filter((c) => c.passes).length, loPass = lo.checks.filter((c) => c.passes).length;
  const R = {
    K1: [f.routing.right >= 27, f.routing.right + ' of ' + f.routing.of + ' jobs routed to their sealed tier' + (f.routing.misses.length ? ' (missed: ' + f.routing.misses.map((m) => m.words).join('; ') + ')' : '')],
    K2: [JSON.stringify(f.budget.authorised) === '[true,true,true,false,false,false]' && f.budget.refusedWentLocal === 3 && f.budget.nextNightFresh === true && f.budget.spent <= 100000,
      'asked for six calls of 30,000 on a budget of 100,000: authorised ' + f.budget.authorised.map((x) => (x ? 'yes' : 'no')).join(', ') + '; ' + f.budget.refusedWentLocal + ' refused ones went to the local model as a fallback; spent ' + f.budget.spent + '; the next night ' + (f.budget.nextNightFresh ? 'started fresh' : 'did NOT start fresh')],
    K3: [fr.calls.length === 6 && fr.calls.every((c) => c.tier === 'frontier' && c.turns === 1 && c.denials === 0), fr.calls.filter((c) => c.tier === 'frontier').length + ' of 6 calls answered on the frontier; turns ' + fr.calls.map((c) => c.turns).join(',')],
    K4: [frPass >= 5, frPass + ' of 6 frontier ideas pass all five checks'],
    K5: [loPass <= frPass - 2, 'the local model: ' + loPass + ' of 6 pass the same checks, against the frontier\u2019s ' + frPass],
    K6: [f.fallback.tier === 'local' && f.fallback.fallback === true && /did not answer/.test(f.fallback.why) && f.fallback.model !== null && !/^claude/.test(f.fallback.model), 'with the frontier unreachable: tier ' + f.fallback.tier + ', marked a fallback: ' + f.fallback.fallback + ' (' + f.fallback.why + '), made by ' + f.fallback.model],
    K7: [fr.tokens <= 60000, 'the six frontier ideas used ' + fr.tokens + ' tokens in all (every model the CLI ran, cache included)'],
  };
  R.K3[1] = R.K3[1] + '; permission denials ' + fr.calls.reduce((s, c) => s + c.denials, 0) + '; no tools were offered';
  const verdicts = prereg().claims.map((c) => ({ id: c.id, claim: c.claim, held: R[c.id] ? R[c.id][0] === true : null, measured: R[c.id] ? R[c.id][1] : 'not measured', predicted: c.predicted }));
  return { verdicts, held: verdicts.filter((v) => v.held === true).length, failed: verdicts.filter((v) => v.held === false).length };
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const p = prereg();
  if (has('--check')) {
    const sealedIn = git('log', '--diff-filter=A', '--format=%H', '--', PRE).trim().split('\n').pop();
    const atSeal = execFileSync('git', ['-C', ROOT, 'show', sealedIn + ':' + PRE], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
    const same = atSeal === readFileSync(join(ROOT, PRE), 'utf8').replace(/\r\n/g, '\n') && p.claims.map((c) => c.id).join() === 'K1,K2,K3,K4,K5,K6,K7';
    console.log(same ? 'the seal is the file committed in ' + sealedIn.slice(0, 7) : 'the seal has changed since ' + sealedIn.slice(0, 7));
    process.exit(same ? 0 : 1);
  }
  if (has('--verify')) {
    if (!existsSync(join(ROOT, OUT))) { console.log('no run yet — sealed, not yet measured'); process.exit(0); }
    const run = JSON.parse(readFileSync(join(ROOT, OUT), 'utf8'));
    const repos = new Set(run.publicRepos);
    const f = { ...run.facts, routing: routing(p), budget: budget() };
    f.frontier = { ...run.facts.frontier, checks: grade(p.ideas.pairs, run.facts.frontier.calls.map((c) => c.idea), repos) };
    f.local = { ...run.facts.local, checks: grade(p.ideas.pairs, run.facts.local.calls.map((c) => readLocalIdea(c.reply)), repos) };
    const j = judge(f);
    const same = JSON.stringify(f) === JSON.stringify(run.facts) && JSON.stringify(j.verdicts) === JSON.stringify(run.verdicts);
    for (const v of j.verdicts) console.log((v.held ? '  HELD    ' : '  FAILED  ') + v.id + ' — ' + v.measured);
    console.log(same ? 'CONTROLLER RECEIPT VERIFIED — re-graded from the stored replies' : 'CONTROLLER RECEIPT DIFFERS from what its stored replies grade to');
    process.exit(same ? 0 : 1);
  }
  if (!has('--run')) die('usage: node tools/controller-measure.mjs --check | --run | --verify');
  if (git('status', '--porcelain', PRE).trim()) die('commit the seal first');
  git('fetch', '-q', 'origin');
  try { git('merge-base', '--is-ancestor', git('log', '-1', '--format=%H', '--', PRE).trim(), 'origin/master'); } catch { die('push the seal first'); }
  const sealedIn = git('log', '--diff-filter=A', '--format=%H', '--', PRE).trim().split('\n').pop();
  const startedAt = new Date().toISOString();
  const index = JSON.parse(readFileSync(INDEX, 'utf8')).nodes || [];
  const publicRepos = index.filter((n) => !n.private).map((n) => n.name).sort();
  const what = Object.fromEntries(index.filter((n) => !n.private).map((n) => [n.name, String(n.desc || '').slice(0, 200)]));
  const repos = new Set(publicRepos);
  const { think } = await import('./cortex.mjs');
  const W = await import(pathToFileURL('C:/Users/sjgan/si-didy/local-wire.mjs').href);
  const chosen = await W.pickModel(['qwen2.5:7b'], { extraBytes: 1.5e9 });
  if (!chosen.ok) die('the local model does not fit tonight: ' + chosen.why);
  const local = async (prompt) => ({ text: await W.generate(chosen.model, prompt, { numPredict: 260, keepAlive: '10m', seed: 7 }), model: chosen.model });
  const fr = [], lo = [];
  for (const pair of p.ideas.pairs) {
    // the frontier arm goes through the controller itself, a fresh night each, so a call that does not answer is recorded
    // as the fallback it became, and its local idea is never graded as the frontier's
    const r = await nightIdea({ pair, what, recent: RECENT, night: 'k4-' + pair.join('+'), budget: 100000, ceiling: 30000, think, local });
    const onFrontier = r.tier === 'frontier';
    fr.push({ pair, tier: r.tier, why: r.why, idea: onFrontier ? r.idea : null, tokens: r.tokens, turns: r.turns, denials: r.denials, model: r.model });
    console.log('frontier ' + pair.join(' + ') + ': ' + (onFrontier ? r.idea && r.idea.idea : 'FELL BACK — ' + r.why));
    const prompt = ideaPrompt({ pair, what, recent: RECENT });
    if (prompt !== r.prompt) die('the two arms were not given the same prompt');
    const l = await local(prompt);
    lo.push({ pair, reply: l.text, model: l.model });
    console.log('local    ' + pair.join(' + ') + ': ' + String(l.text).replace(/\s+/g, ' ').slice(0, 160));
  }
  await W.unload(chosen.model);
  // K6: the frontier made unreachable — the CLI path broken
  const fb = await nightIdea({ pair: p.ideas.pairs[0], what, recent: RECENT, night: 'k6', budget: 100000, ceiling: 30000,
    think: (c) => think({ ...c, cli: 'C:/no/such/claude.exe' }), local });
  await W.unload(chosen.model);
  const facts = {
    routing: routing(p), budget: budget(),
    frontier: { calls: fr, tokens: fr.reduce((s, c) => s + c.tokens, 0), checks: grade(p.ideas.pairs, fr.map((c) => c.idea), repos) },
    local: { model: chosen.model, calls: lo, checks: grade(p.ideas.pairs, lo.map((c) => readLocalIdea(c.reply)), repos) },
    fallback: { tier: fb.tier, fallback: fb.fallback, why: fb.why, model: fb.model, idea: fb.idea },
  };
  const j = judge(facts);
  const run = { kind: 'kar-mind-controller-run', v: 1, sealedIn, startedAt, finishedAt: new Date().toISOString(), node: process.version, recent: RECENT, publicRepos, facts, verdicts: j.verdicts, held: j.held, failed: j.failed };
  writeFileSync(join(ROOT, OUT), stable(run));
  for (const v of j.verdicts) console.log((v.held ? '  HELD    ' : '  FAILED  ') + v.id + ' — ' + v.measured);
  console.log(j.held + ' held, ' + j.failed + ' failed · wrote ' + OUT);
}
