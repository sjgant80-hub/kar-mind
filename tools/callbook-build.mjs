#!/usr/bin/env node
// tools/callbook-build.mjs — the controller's measured run, kept as a LIGHT call book (data/controller-calls.lcb):
// every frontier call, every local call and the fallback call, each with the exact prompt it was asked, the mind that
// answered, what came back and what it cost. Estate go-live Phase 2, pass 3 (claim I1).
//
//   node tools/callbook-build.mjs           build the book from data/controller-run.json (the prompts are re-made by the
//                                           controller's own ideaPrompt from the estate index's public descriptions)
//   node tools/callbook-build.mjs --verify  read the book back and check it, call by call, against the run (CI runs this)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendBook, readBook } from '../callbook.mjs';
import { ideaPrompt } from '../controller.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUN = join(ROOT, 'data', 'controller-run.json'), BOOK = join(ROOT, 'data', 'controller-calls.lcb');
const INDEX = 'C:/Users/sjgan/.claude/projects/C--Users-sjgan--claude/memory/estate-index.json';

/** The calls of the run, in order, with everything but the prompt (the run keeps the inputs, not the prompt text). */
export function callsOf(run) {
  const f = run.facts, out = [];
  for (const c of f.frontier.calls) out.push({ at: run.frontierAskedAt, tier: c.tier, model: c.model, fallback: c.tier !== 'frontier', why: c.why, pair: c.pair, reply: c.idea, tokens: c.tokens, turns: c.turns });
  for (const c of f.local.calls) out.push({ at: run.finishedAt, tier: 'local', model: c.model, fallback: false, why: 'the local arm of the sealed measurement: the same prompt, on the local model', pair: c.pair, reply: c.reply, tokens: 0, turns: 0 });
  const b = f.fallback;
  out.push({ at: run.finishedAt, tier: b.tier, model: b.model, fallback: b.fallback, why: b.why, pair: run.facts.frontier.calls[0].pair, reply: b.idea, tokens: 0, turns: 0 });
  return out;
}

/** Does the book hold exactly the run's calls, in order (the prompt checked for being there, not for its words)? */
export function bookMatches(records, calls) {
  if (!Array.isArray(records) || records.length !== calls.length) return { ok: false, why: 'the book holds ' + (Array.isArray(records) ? records.length : 0) + ' records for ' + calls.length + ' calls' };
  for (let i = 0; i < calls.length; i++) {
    const r = records[i], c = calls[i];
    for (const k of ['at', 'tier', 'model', 'fallback', 'why', 'tokens', 'turns']) if (r[k] !== c[k]) return { ok: false, why: 'record ' + i + ': ' + k + ' differs' };
    if (JSON.stringify(r.reply) !== JSON.stringify(c.reply === undefined ? null : c.reply)) return { ok: false, why: 'record ' + i + ': the reply differs' };
    if (!c.pair.every((p) => r.prompt.includes('- ' + p))) return { ok: false, why: 'record ' + i + ': the prompt does not name its pair' };
  }
  return { ok: true, records: records.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const run = JSON.parse(readFileSync(RUN, 'utf8'));
  const calls = callsOf(run);
  if (process.argv.includes('--verify')) {
    if (!existsSync(BOOK)) { console.log('no call book yet'); process.exit(1); }
    const r = readBook(new Uint8Array(readFileSync(BOOK)));
    if (!r.ok) { console.log('CALL BOOK REFUSED: ' + r.why); process.exit(1); }
    const m = bookMatches(r.records, calls);
    console.log(m.ok ? 'CALL BOOK VERIFIED — ' + m.records + ' records read back, each the run\'s call' : 'CALL BOOK DIFFERS: ' + m.why);
    process.exit(m.ok ? 0 : 1);
  }
  const what = Object.fromEntries((JSON.parse(readFileSync(INDEX, 'utf8')).nodes || []).filter((n) => !n.private).map((n) => [n.name, String(n.desc || '').slice(0, 200)]));
  let book = null;
  for (const c of calls) {
    const { pair, ...rest } = c;
    const a = appendBook(book, { ...rest, prompt: ideaPrompt({ pair, what, recent: run.recent }) });
    if (!a.ok) { console.error('could not record a call: ' + a.why); process.exit(1); }
    book = a.bytes;
  }
  const back = readBook(book);
  const m = back.ok ? bookMatches(back.records, calls) : back;
  if (!m.ok) { console.error('the book did not read back: ' + m.why); process.exit(1); }
  writeFileSync(BOOK, book);
  console.log('wrote data/controller-calls.lcb: ' + calls.length + ' calls, ' + book.length + ' bytes (the same records as JSON: ' + Buffer.byteLength(JSON.stringify(back.records)) + ' bytes)');
}
