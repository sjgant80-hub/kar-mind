// tools/cortex.mjs — the frontier wire (glue, local only): one call to Claude on the owner's own login, through the official
// claude CLI. It runs from an empty folder, so no project memory rides in uninvited (from inside a project the CLI loads
// that project's memory: 16,195 tokens for a one-word reply, against 177 from an empty folder, measured 2026-10-26).
// The environment is cleaned by controller.mjs's cleanEnv (gated): no Anthropic key, token or endpoint override rides along
// (login, not rent); a long-lived token from `claude setup-token`, if the owner has made one (~/.si-didy/kar-oauth.token),
// is passed the way the cockpit passes it. No tools, no MCP servers, nothing saved. The arguments and the reading of the
// reply are controller.mjs's (gated); this file only carries them.
// Which client: KAR_CLAUDE_CLI if set; else the newest one the si-didy kit finds on Simon's laptop (~/si-didy, or
// KAR_SIDIDY), if that kit is there; else `claude` from the PATH, as Claude Code installs it. Runs on any machine.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { cortexArgs, readReply, cleanEnv } from '../controller.mjs';

export const MODEL = process.env.KAR_CORTEX_MODEL || 'claude-opus-4-8';   // the newest the installed CLI serves on the login
const OAUTH = join(homedir(), '.si-didy', 'kar-oauth.token');
export const OUTPUT_CAP = 4000;
const ROOM = process.platform === 'win32' ? 'C:\\tmp\\kar-cortex' : join(tmpdir(), 'kar-cortex');

/** the client to run: { path, source } */
export async function findCli() {
  if (process.env.KAR_CLAUDE_CLI) return { path: process.env.KAR_CLAUDE_CLI, source: 'KAR_CLAUDE_CLI' };
  const kit = join(process.env.KAR_SIDIDY || join(homedir(), 'si-didy'), 'claude-session.mjs');
  if (existsSync(kit)) {
    try { const c = (await import(pathToFileURL(kit).href)).findNewestCli(); if (c && c.path) return { path: c.path, source: 'si-didy' }; } catch { /* the usual places, then */ }
  }
  // where Claude Code installs its binary: npm's global package, then the native installer's ~/.local/bin; on Windows the
  // npm shim on the PATH is a .cmd, which cannot be started without a shell, so the .exe inside the package is used
  const npm = process.env.APPDATA ? join(process.env.APPDATA, 'npm') : join(homedir(), '.npm-global');
  for (const bin of ['claude.exe', 'claude']) {
    for (const p of [join(npm, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', bin), join(homedir(), '.local', 'bin', bin)]) if (existsSync(p)) return { path: p, source: 'installed' };
  }
  return { path: 'claude', source: 'PATH' };
}

/** One call. opts = { prompt, system, schema?, model?, timeoutMs?, cli? (a path, to choose or to break the wire) } */
export async function think(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const args = cortexArgs({ model: o.model || MODEL, system: o.system, schema: o.schema });
  if (!args || typeof o.prompt !== 'string' || !o.prompt) return { ok: false, why: 'not a call the controller would make' };
  const cli = o.cli ? { path: o.cli } : await findCli();
  mkdirSync(ROOM, { recursive: true });
  const cwd = mkdtempSync(join(ROOM, 'think-'));
  const env = cleanEnv(process.env);
  try { const t = readFileSync(OAUTH, 'utf8').trim(); if (t) env.CLAUDE_CODE_OAUTH_TOKEN = t; } catch { /* the CLI's own stored login, then */ }
  // the reply is one small JSON object: its output is capped, so with the bounded prompt a call stays far under its ceiling
  env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = String(OUTPUT_CAP);
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
