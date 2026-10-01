#!/usr/bin/env node
// brain-cli.mjs — the glue that switches the brain on. It reads the sources a session would otherwise
// have to be told (the memory files, MEMORY.md, Kar's asks, the build queue), writes what changed into
// the persistent journal through the real mind (mind.mjs perceive → persist.mjs, sealed and walled), and
// reads the working memory back out as one digest. Thin, ungated I/O around the gated law in brain.mjs —
// the same split persist.mjs uses around fall-remember's store.
//
//   node brain-cli.mjs ingest            new or changed facts → the journal
//   node brain-cli.mjs digest [--mark]   the working memory, printed and written to <brain>/digest.txt;
//                                        --mark moves "the last look" to now (a session start does this)
//   node brain-cli.mjs next              the next build in Simon's approved order, and the open asks
//   node brain-cli.mjs decisions         what is waiting on Simon, and nothing else
//   node brain-cli.mjs done <id>         mark a queue item built (writes the queue, then ingests)
//   node brain-cli.mjs status            the journal's size and where it lives
//
// ⚑ It writes in exactly two places, both under the brain's own directory: the journal (through the
// wall) and the digest/look/queue files. It has no network, no git, no publish verb and no money verb.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { bootMind, persistMind } from './mind-persistent.mjs';
import { memoryFacts, indexLines, askFacts, backlogFacts, stateOf, changedFacts, nextBuild, decisionsOf, digest } from './brain.mjs';

export const PATHS = {
  brain: process.env.KAR_BRAIN_DIR || join(homedir(), '.si-didy', 'brain'),
  memory: process.env.KAR_MEMORY_DIR || join(homedir(), '.claude', 'projects', 'C--Users-sjgan--claude', 'memory'),
  asks: process.env.KAR_ASKS || join(homedir(), '.si-didy', 'kar-asks.json'),
};
const file = (n) => join(PATHS.brain, n);
const rd = (p, fb) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fb; } };

function memoryFiles() {
  try {
    return readdirSync(PATHS.memory).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md').map((f) => {
      const p = join(PATHS.memory, f);
      return { name: f.replace(/\.md$/, ''), text: readFileSync(p, 'utf8'), mtimeMs: Math.round(statSync(p).mtimeMs) };
    });
  } catch { return []; }
}

export async function open() {
  mkdirSync(PATHS.brain, { recursive: true });
  const b = await bootMind({ dir: PATHS.brain });
  if (!b.ok) throw new Error(b.why);
  return b;
}

export async function ingest() {
  const { mind, journal } = await open();
  const state = stateOf(mind.events());
  const facts = [...memoryFacts(memoryFiles()), ...askFacts(rd(PATHS.asks, {})), ...backlogFacts(rd(file('backlog.json'), {}))];
  const fresh = changedFacts(state, facts);
  let wrote = 0;
  for (const f of fresh) if (mind.perceive(f).ok) wrote++;
  if (wrote) {
    const p = await persistMind(journal, mind);
    if (!p.ok) throw new Error(p.why);
  }
  return { read: facts.length, wrote, events: mind.events().length, journal: journal.path };
}

export async function readDigest({ mark = false, now = Date.now() } = {}) {
  const { mind } = await open();
  const look = rd(file('look.json'), { at: 0 });
  let index = { estate: null, recent: [] };
  try { index = indexLines(readFileSync(join(PATHS.memory, 'MEMORY.md'), 'utf8')); } catch { /* no index yet */ }
  const text = digest({ state: stateOf(mind.events()), index, since: look.at || 0, now });
  writeFileSync(file('digest.txt'), text + '\n');
  if (mark) writeFileSync(file('look.json'), JSON.stringify({ at: now }) + '\n');
  return text;
}

async function main(argv) {
  const cmd = argv[2];
  if (cmd === 'ingest') { console.log(JSON.stringify(await ingest())); return; }
  if (cmd === 'digest') { console.log(await readDigest({ mark: argv.includes('--mark') })); return; }
  if (cmd === 'next' || cmd === 'decisions' || cmd === 'status') {
    const { mind, journal } = await open();
    const state = stateOf(mind.events());
    if (cmd === 'next') console.log(JSON.stringify(nextBuild(state), null, 1));
    else if (cmd === 'decisions') console.log(JSON.stringify(decisionsOf(state), null, 1));
    else console.log(JSON.stringify({ facts: state.size, events: mind.events().length, journal: journal.path, digest: file('digest.txt') }));
    return;
  }
  if (cmd === 'done') {
    const id = argv[3];
    const q = rd(file('backlog.json'), null);
    const item = q && Array.isArray(q.items) ? q.items.find((i) => i.id === id) : null;
    if (!item) { console.error('no queue item ' + id); process.exit(1); }
    item.status = 'done';
    item.ts = Date.now();
    writeFileSync(file('backlog.json'), JSON.stringify(q, null, 1) + '\n');
    console.log(JSON.stringify(await ingest()));
    return;
  }
  console.error('usage: node brain-cli.mjs ingest | digest [--mark] | next | decisions | done <id> | status');
  process.exit(2);
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('brain-cli.mjs');
if (isMain) await main(process.argv).catch((e) => { console.error('brain: ' + e.message); process.exit(1); });
