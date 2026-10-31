#!/usr/bin/env node
// tools/kar-status.mjs — Kar's side of the line to Grok Bot, through the shared STATUS.md log (a private repo, named only in
// the local config ~/.si-didy/continuity.json as { "repo": "<path to its clone>" }, or in KAR_CONTINUITY; never here).
//   node tools/kar-status.mjs "<what went live, with its link and proof>"   pull, add a Kar entry under today, commit, push
//   node tools/kar-status.mjs --show                                         what a session starts with (no network)
// The session-start surface (si-didy/morning-surface.mjs) calls show() every session and refresh() in the background,
// so Grok's reports and asks reach Kar, and a quiet Kar is shown loudly until he writes.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { addKar, surface } from '../continuity.mjs';

const local = () => { try { return JSON.parse(readFileSync(join(homedir(), '.si-didy', 'continuity.json'), 'utf8')).repo || ''; } catch { return ''; } };
export const REPO = process.env.KAR_CONTINUITY || local();
const FILE = REPO + '/STATUS.md';
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const git = (args, timeout = 30000) => spawnSync('git', args, { cwd: REPO, encoding: 'utf8', timeout });

/** the surface for a session's start, from the local copy (never touches the network) */
export function show() {
  try { return surface(readFileSync(FILE, 'utf8'), today()); } catch { return ''; }
}

/** fetch Grok's newest reports in the background, for the next session; never waits, never throws */
export function refresh() {
  try { spawn('git', ['pull', '--ff-only', '--quiet'], { cwd: REPO, detached: true, stdio: 'ignore', windowsHide: true }).unref(); } catch { /* offline is fine */ }
}

/** add a Kar entry under today, commit it alone, push: → { ok, why } */
export function log(text) {
  const pull = git(['pull', '--ff-only', '--quiet']);
  if (pull.status !== 0) return { ok: false, why: 'git pull failed: ' + (pull.stderr || pull.error || '').toString().trim().slice(0, 200) };
  const md = readFileSync(FILE, 'utf8'), next = addKar(md, today(), text);
  if (next === md) return { ok: false, why: 'nothing to log (an empty entry, or no date)' };
  writeFileSync(FILE, next);
  const add = git(['add', 'STATUS.md']), commit = git(['commit', '-q', '-m', 'STATUS: Kar — ' + String(text).replace(/\s+/g, ' ').trim().slice(0, 70)]);
  if (add.status !== 0 || commit.status !== 0) return { ok: false, why: 'git commit failed: ' + (commit.stderr || add.stderr || '').trim().slice(0, 200) };
  const push = git(['push', '-q']);
  return push.status === 0 ? { ok: true, why: 'logged and pushed' } : { ok: false, why: 'committed but the push failed: ' + (push.stderr || '').trim().slice(0, 200) };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/kar-status.mjs');
if (isMain) {
  const args = process.argv.slice(2);
  if (args[0] === '--show') console.log(show() || '(no STATUS.md at ' + FILE + ')');
  else if (args.length && args.join(' ').trim()) { const r = log(args.join(' ')); console.log((r.ok ? '✓ ' : '✗ ') + r.why); process.exit(r.ok ? 0 : 1); }
  else { console.log('usage: node tools/kar-status.mjs "<what went live>" | --show'); process.exit(2); }
}
