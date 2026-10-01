// seedcodec.mjs — THE SEED'S CODEC, AS A SHARED DICTIONARY (Kar, 2026-10-01). Simon, relayed verbatim: "ok then we have
// to look in the v25 seed dude its all inthere lets grow it ... 15x is there we have the skills to build it".
//
// The seed's memory law says "COMPRESS, don't delete · compress by prime indices (the k-dot / konomi compression)", and
// its primorial fold codec (built in fall-remember/fold.mjs: a bloom over seven prime rings ⇄ one integer, lossless by
// the Fundamental Theorem of Arithmetic; Ω = 510510, 127 = M₇ non-empty blooms — the core of Thomas Frumkin's
// "Scotty Starship Ninjaprise") is the mechanism: every entry both sides hold gets a prime; a SET of entries is the
// product of their primes, one integer, and factoring it gives the set back. That only saves what the receiver already
// holds. So this file does exactly three honest things:
//   foldSet / unfoldSet   a set of held entries ⇄ one base-36 integer (for code-to-code messages between organs)
//   encodeHeld / decodeHeld  a text whose lines repeat entries the receiver holds → those lines become [name]
//                         (for a model that holds the entries in its own context — e.g. the session start, whose
//                          reader already holds MEMORY.md); decode gives the text back exactly
//   delta / applyDelta    a new version of a text the receiver already holds → only the lines that changed
// Pure and total: no I/O, never throws on garbage.

const str = (v) => (typeof v === 'string' ? v : '');
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// the first n primes
export function primes(n) {
  const out = [];
  const want = Math.max(0, Math.min(5000, Math.floor(Number(n)) || 0));
  for (let k = 2; out.length < want; k++) if (out.every((p) => p * p > k || k % p)) out.push(k);
  return out;
}

// a dictionary: each held entry, in a stable order, with its prime
export function dictionary(names) {
  const list = [...new Set((Array.isArray(names) ? names : []).filter((x) => typeof x === 'string' && x))];
  const ps = primes(list.length);
  return list.map((name, k) => ({ name, prime: ps[k] }));
}

// a set of held entries → the product of their primes, written in base 36 (FTA: the set comes back exactly)
export function foldSet(names, dict) {
  const want = new Set(Array.isArray(names) ? names : []);
  let n = 1n;
  for (const d of Array.isArray(dict) ? dict : []) if (isObj(d) && want.has(d.name) && Number.isInteger(d.prime)) n *= BigInt(d.prime);
  return n.toString(36);
}
export function unfoldSet(code, dict) {
  let n;
  try { n = parseBase36(str(code)); } catch { return null; }
  if (n < 1n) return null;
  const out = [];
  for (const d of Array.isArray(dict) ? dict : []) {
    if (!isObj(d) || !Number.isInteger(d.prime)) continue;
    const p = BigInt(d.prime);
    if (n % p === 0n) { out.push(d.name); n /= p; if (n % p === 0n) return null; }
  }
  return n === 1n ? out : null;
}
function parseBase36(s) {
  if (!/^[0-9a-z]+$/.test(s)) throw new Error('not base 36');
  let n = 0n;
  for (const ch of s) n = n * 36n + BigInt(parseInt(ch, 36));
  return n;
}

// lines that repeat a held entry exactly become [name]; held: [{ name, text }] where text is the entry's whole line
export function encodeHeld(text, held, { prefix = '' } = {}) {
  const byText = new Map();
  for (const h of Array.isArray(held) ? held : []) if (isObj(h) && str(h.name) && str(h.text) && !byText.has(prefix + h.text)) byText.set(prefix + h.text, h.name);
  return str(text).split('\n').map((line) => (byText.has(line) ? prefix + '[' + byText.get(line) + ']' : line)).join('\n');
}
export function decodeHeld(text, held, { prefix = '' } = {}) {
  const byName = new Map();
  for (const h of Array.isArray(held) ? held : []) if (isObj(h) && str(h.name) && str(h.text) && !byName.has(h.name)) byName.set(h.name, h.text);
  return str(text).split('\n').map((line) => {
    const m = line.startsWith(prefix + '[') && line.endsWith(']') ? line.slice(prefix.length + 1, -1) : null;
    return m !== null && byName.has(m) ? prefix + byName.get(m) : line;
  }).join('\n');
}

// a new version of a text the receiver holds → runs of unchanged lines as "=start+count", changed lines as "+line"
export function delta(prev, next) {
  const a = str(prev).split('\n'), b = str(next).split('\n');
  const at = new Map();
  a.forEach((l, k) => { if (!at.has(l)) at.set(l, []); at.get(l).push(k); });
  const ops = [];
  let k = 0;
  while (k < b.length) {
    const starts = at.get(b[k]) || [];
    let best = -1, len = 0;
    // a run stops where the lines differ; past the end of prev a line is undefined, which equals no line of next
    for (const s of starts) { let n = 0; const max = b.length - k; while (n !== max && a[s + n] === b[k + n]) n++; if (n > len) { len = n; best = s; } }
    if (best >= 0) { ops.push('=' + best + '+' + len); k += len; }
    else { ops.push('+' + b[k]); k++; }
  }
  return ops.join('\n');
}
export function applyDelta(prev, d) {
  const a = str(prev).split('\n'), out = [];
  for (const op of str(d).split('\n')) {
    const m = /^=(\d+)\+(\d+)$/.exec(op);
    if (m) { const s = Number(m[1]), n = Number(m[2]); if (s + n > a.length) return null; out.push(...a.slice(s, s + n)); }
    else if (op.startsWith('+')) out.push(op.slice(1));
    else return null;
  }
  return out.join('\n');
}

// the sealed rules: each payload kind's Claude tokens as sent today and as coded, and whether decoding was exact
export function judgeCodec({ payloads, bars } = {}) {
  const ok = Array.isArray(payloads) && payloads.length > 0 && payloads.every((p) => isObj(p) && str(p.kind) && Number.isFinite(p.full) && Number.isFinite(p.coded) && p.coded > 0 && typeof p.exact === 'boolean')
    && isObj(bars) && Number.isFinite(bars.ratio);
  if (!ok) return { ok: false, why: 'the payloads ({ kind, full, coded, exact }) and the sealed bar' };
  const r2 = (x) => Math.round(x * 100) / 100;
  const kinds = [...new Set(payloads.map((p) => p.kind))].map((kind) => {
    const of = payloads.filter((p) => p.kind === kind);
    const full = of.reduce((a, p) => a + p.full, 0), coded = of.reduce((a, p) => a + p.coded, 0);
    return { kind, n: of.length, full, coded, ratio: r2(full / coded) };
  });
  const full = payloads.reduce((a, p) => a + p.full, 0), coded = payloads.reduce((a, p) => a + p.coded, 0);
  const ratio = r2(full / coded);
  const inexact = payloads.filter((p) => !p.exact).length;
  const rules = [
    { id: 'lossless', pass: inexact === 0, value: inexact === 0 ? 'every coded payload decodes back to exactly what is sent today' : inexact + ' payload(s) did not decode exactly' },
    { id: 'fifteen-overall', pass: ratio >= bars.ratio, value: ratio + '× over the whole measured workload (' + full + ' Claude tokens as sent today, ' + coded + ' coded)' },
    ...kinds.map((k) => ({ id: 'fifteen-' + k.kind, pass: k.ratio >= bars.ratio, value: k.ratio + '× on ' + k.kind + ' (' + k.full + ' → ' + k.coded + ' tokens over ' + k.n + ')' })),
  ];
  return { ok: true, rules, passed: rules.filter((r) => r.pass).length, of: rules.length, ratio, kinds };
}

export default { primes, dictionary, foldSet, unfoldSet, encodeHeld, decodeHeld, delta, applyDelta, judgeCodec };
