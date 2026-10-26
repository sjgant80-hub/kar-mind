// tools/cortex.mjs — the frontier wire (glue, local only): one call to Claude on Simon's own login, through the official
// claude CLI. It runs from an empty folder, so no project memory rides in uninvited (from inside a project the CLI loads
// that project's memory: 16,195 tokens for a one-word reply, against 177 from an empty folder, measured 2026-10-26).
// The environment is cleaned of every key and proxy (login, not rent); a long-lived token from `claude setup-token`, if
// Simon has made one (~/.si-didy/kar-oauth.token), is passed the way the cockpit passes it. No tools, no MCP servers,
// nothing saved. The arguments and the reading of the reply are controller.mjs's (gated); this file only carries them.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { cortexArgs, readReply } from '../controller.mjs';

export const MODEL = process.env.KAR_CORTEX_MODEL || 'claude-opus-4-8';   // the newest the installed CLI serves on the login
const OAUTH = join(homedir(), '.si-didy', 'kar-oauth.token');

async function kit() {
  const S = await import(pathToFileURL('C:/Users/sjgan/si-didy/claude-session.mjs').href);
  const K = (await import(pathToFileURL('C:/Users/sjgan/si-didy/cockpit-kernel.mjs').href)).default;
  return { findNewestCli: S.findNewestCli, cleanEnv: K.cleanEnv };
}

/** One call. opts = { prompt, system, schema?, model?, timeoutMs?, cli? (a path, to choose or to break the wire) } */
export async function think(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const args = cortexArgs({ model: o.model || MODEL, system: o.system, schema: o.schema });
  if (!args || typeof o.prompt !== 'string' || !o.prompt) return { ok: false, why: 'not a call the controller would make' };
  let K;
  try { K = await kit(); } catch (e) { return { ok: false, why: 'the cockpit kit is not here: ' + (e && e.message || e) }; }
  const cli = o.cli ? { path: o.cli } : K.findNewestCli();
  if (!cli) return { ok: false, why: 'no claude CLI on this machine' };
  mkdirSync('C:\\tmp\\kar-cortex', { recursive: true });
  const cwd = mkdtempSync('C:\\tmp\\kar-cortex\\think-');
  const env = K.cleanEnv(process.env);
  try { const t = readFileSync(OAUTH, 'utf8').trim(); if (t) env.CLAUDE_CODE_OAUTH_TOKEN = t; } catch { /* the CLI's own stored login, then */ }
  const t0 = Date.now();
  return new Promise((done) => {
    let out = '', err = '', settled = false;
    const finish = (r) => { if (!settled) { settled = true; done({ ...r, ms: Date.now() - t0 }); } };
    let child;
    try { child = spawn(cli.path, args, { cwd, env, shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }); }
    catch (e) { finish({ ok: false, why: 'the CLI did not start: ' + (e && e.message || e) }); return; }
    const timer = setTimeout(() => { try { child.kill(); } catch { /* gone */ } finish({ ok: false, why: 'no reply in ' + Math.round((o.timeoutMs || 240000) / 1000) + ' s' }); }, o.timeoutMs || 240000);
    child.on('error', (e) => { clearTimeout(timer); finish({ ok: false, why: 'the CLI did not start: ' + (e && e.code || e && e.message || e) }); });
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { err += c; });
    child.on('close', () => { clearTimeout(timer); const r = readReply(out, o.model || MODEL); finish(r.ok ? r : { ...r, why: r.why + (err ? ' — ' + err.trim().slice(0, 160) : '') }); });
    child.stdin.end(o.prompt);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = await think({ prompt: process.argv.slice(2).join(' ') || 'Say ok.', system: 'Reply in one short line.' });
  console.log(JSON.stringify(r));
}
