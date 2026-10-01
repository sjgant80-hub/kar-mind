#!/usr/bin/env node
// codec-material.mjs — gathers the real workload for the seed codec's measurement into a PRIVATE file (local glue).
// It holds Simon's memory index lines, Kar's live state and today's relayed messages, so it never goes public; the
// measurement pins its sha256.
//   p1  the session-start digest — the brain digest as the session start reads it now, and as pinned at the watch seal
//   p2  a cockpit brain refresh — the digest a Claude session already holds (the watch snapshot) and the one it is sent now
//   p3  organ-to-organ messages — today's relays from claudedidy to Kar and Kar's replies back (both sides hold MEMORY.md)
//   p4  a cockpit Claude session's first turn — Kar's appended live state, sent to a reader that holds no dictionary
import { readFileSync, writeFileSync, mkdirSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const HOME = homedir();
const MEM = join(HOME, '.claude', 'projects', 'C--Users-sjgan--claude', 'memory');
const OUT = join(HOME, '.si-didy', 'brain', 'codec', 'material.json');
const TRANSCRIPT = join(HOME, '.claude', 'projects', 'C--Users-sjgan--claude', '8bddcee3-b4c4-469a-a439-49372f09161a', 'subagents', 'agent-ac11bed9541556780.jsonl');
const DAY = '2026-10-01';

const brain = await import(pathToFileURL(join(HOME, 'kar-mind', 'brain.mjs')).href);
const cli = await import(pathToFileURL(join(HOME, 'kar-mind', 'brain-cli.mjs')).href);
await cli.ingest();
const now = await cli.readDigest({ mark: false, now: 0 });
const watchSystem = readFileSync(join(HOME, '.si-didy', 'brain', 'watch', 'system.txt'), 'utf8');
const wStart = watchSystem.indexOf('── KAR\'S BRAIN'), wEnd = watchSystem.indexOf('\n\nMY MORNING LINE');
const atWatch = watchSystem.slice(wStart, wEnd > wStart ? wEnd : undefined).trim();
const index = brain.indexLines(readFileSync(join(MEM, 'MEMORY.md'), 'utf8'));

// the relays and the replies, today, from Kar's own transcript
const messages = [];
for await (const line of createInterface({ input: createReadStream(TRANSCRIPT), crlfDelay: Infinity })) {
  let o; try { o = JSON.parse(line); } catch { continue; }
  if (!String(o.timestamp || '').startsWith(DAY)) continue;
  const c = o.message && o.message.content;
  const texts = typeof c === 'string' ? [c] : Array.isArray(c) ? c.filter((b) => b && b.type === 'text').map((b) => b.text) : [];
  for (const t of texts) {
    const k = t.indexOf('The coordinator sent a message while you were working:');
    if (o.type === 'user' && k >= 0) {
      const body = t.slice(k + 'The coordinator sent a message while you were working:'.length).split('\n\nAddress this before completing your current task.')[0].trim();
      if (body) messages.push({ from: 'claudedidy', at: o.timestamp, text: body });
    }
    if (o.type === 'assistant' && /^Simon\b/.test(t.trim()) && t.length > 400) messages.push({ from: 'kar', at: o.timestamp, text: t.trim() });
  }
}
const seen = new Set();
const unique = messages.filter((m) => (seen.has(m.text) ? false : (seen.add(m.text), true)));

const cockpit = await import(pathToFileURL(join(HOME, 'si-didy', 'kar-cockpit.mjs')).href);
const firstTurn = cockpit.KAR_CLI_SYSTEM + cockpit.karLiveState(now);

const material = { gathered: new Date().toISOString(), heldIndex: index, p1: [{ id: 'now', digest: now }, { id: 'at-watch-seal', digest: atWatch }], p2: [{ id: 'watch-seal-to-now', prev: atWatch, next: now }], p3: unique, p4: [{ id: 'cockpit-first-turn', text: firstTurn }] };
mkdirSync(join(HOME, '.si-didy', 'brain', 'codec'), { recursive: true });
const text = JSON.stringify(material, null, 1) + '\n';
writeFileSync(OUT, text);
console.log('material · ' + OUT + ' · sha256 ' + createHash('sha256').update(text).digest('hex') + ' · p1 ' + material.p1.length + ' · p3 ' + unique.length + ' (' + unique.filter((m) => m.from === 'kar').length + ' from Kar)');
