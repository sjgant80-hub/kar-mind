// claude-count.mjs — Claude tokens of a text, counted by the official claude CLI on Simon's own login (glue, local only).
// No tools, a one-word system prompt, nothing saved; the count of a text is the input tokens the CLI reports for it
// minus those it reports for a one-character message. Ollama's local count is given too (qwen2.5:7b, a flush between
// texts so no prompt cache is shared).
import { mkdirSync, mkdtempSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const MODEL = 'claude-sonnet-5-5';
export async function claudeCounter(model = MODEL) {
  const S = await import(pathToFileURL('C:/Users/sjgan/si-didy/claude-session.mjs').href);
  const KK = (await import(pathToFileURL('C:/Users/sjgan/si-didy/cockpit-kernel.mjs').href)).default;
  const cli = S.findNewestCli();
  if (!cli) throw new Error('no claude CLI');
  mkdirSync('C:\\tmp\\kar-cockpit', { recursive: true });
  const cwd = mkdtempSync('C:\\tmp\\kar-cockpit\\count-');
  const once = (message) => new Promise((done, fail) => {
    const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', model, '--system-prompt', 'Reply with the one word: ok',
      '--tools', '', '--setting-sources', 'project', '--strict-mcp-config', '--no-session-persistence', '--disable-slash-commands', '--no-chrome'];
    const child = spawn(cli.path, args, { cwd, env: KK.cleanEnv(process.env), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let buf = '', result = null, init = null;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); try { const e = JSON.parse(l); if (e.type === 'system' && e.subtype === 'init') init = e; if (e.type === 'result') { result = e; child.stdin.end(); } } catch { /* */ } } });
    child.on('close', () => {
      if (!result || !result.usage) return fail(new Error('no usage from the CLI'));
      const u = result.usage;
      done({ total: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0), model: init && init.model, login: init ? init.apiKeySource === 'none' : null });
    });
    child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: message }] } }) + '\n');
  });
  const base = await once('x');
  return { base, count: async (t) => (await once(t)).total - base.total };
}

export async function localCount(t) {
  const call = async (prompt) => (await (await fetch('http://127.0.0.1:11434/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'qwen2.5:7b', prompt, raw: true, stream: false, options: { num_predict: 1, num_ctx: 8192 } }) })).json()).prompt_eval_count || 0;
  await call('0');
  return call(t);
}
