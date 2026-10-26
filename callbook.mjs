// callbook.mjs — the controller's record of every model call, kept in LIGHT (estate go-live Phase 2, pass 3: claim I1
// in fall-kit/core/phase2/claims.json). Pure, total, witness-gated; the file glue is the caller's.
//
// A call book is append-only: 'LCB1', then one frame per call. A frame is the record's JSON coded by the shared
// foundation's LIGHT codec (vendor/fall-kit-core, vendored and pinned): its length (4 bytes), the coded bytes, and the
// SHA-256 of the JSON, so a book whose bytes changed is refused at the frame that changed, never read as something else.
//
//   recordOf(call)            → { ok, record } | { ok: false, why }   { at, tier, model, fallback, why, prompt, reply,
//                               tokens, turns }: what was asked, of which mind, what came back, and what it cost
//   appendBook(book, record)  → { ok, bytes } | { ok: false, why }    the book with one more frame (a new book if none)
//   readBook(bytes)           → { ok, records } | { ok: false, why, at }  every frame decoded and checked, in order
import { encode, decode } from './vendor/fall-kit-core/vendor/light/codec.mjs';
import { sha256 } from './vendor/fall-kit-core/vendor/light/sha256.mjs';

export const MAGIC = Object.freeze([0x4c, 0x43, 0x42, 0x31]);   // 'LCB1'
export const MAX_RECORD = 1 << 20;
export const TIERS = Object.freeze(['deterministic', 'local', 'frontier']);
const te = new TextEncoder(), td = new TextDecoder('utf-8', { fatal: true });
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const whole = (n) => Number.isSafeInteger(n) && n >= 0;
const no = (why, at) => (at === undefined ? { ok: false, why } : { ok: false, why, at });

/** A call, checked and put in the one order a book keeps. */
export function recordOf(call) {
  const c = isObj(call) ? call : {};
  if (typeof c.at !== 'string' || !ISO.test(c.at)) return no('at is an ISO moment');
  if (!TIERS.includes(c.tier)) return no('tier is deterministic, local or frontier');
  if (c.model !== null && (typeof c.model !== 'string' || c.model.length === 0 || c.model.length > 120)) return no('model names the model, or is null');
  if (typeof c.fallback !== 'boolean') return no('fallback is true or false');
  if (typeof c.why !== 'string' || c.why.length > 2000) return no('why says why the call went where it did');
  if (typeof c.prompt !== 'string' || c.prompt.length === 0) return no('prompt is what was asked');
  if (!whole(c.tokens) || !whole(c.turns)) return no('tokens and turns are whole numbers');
  let reply;
  try { reply = JSON.parse(JSON.stringify(c.reply === undefined ? null : c.reply)); } catch { return no('the reply is not JSON'); }
  const record = { at: c.at, tier: c.tier, model: c.model, fallback: c.fallback, why: c.why, prompt: c.prompt, reply, tokens: c.tokens, turns: c.turns };
  if (te.encode(JSON.stringify(record)).length > MAX_RECORD) return no('a record is at most ' + MAX_RECORD + ' bytes');
  return { ok: true, record };
}

const sameBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The book with one more frame. A book that is not a book is refused, never overwritten. */
export function appendBook(book, call) {
  const r = recordOf(call);
  if (!r.ok) return r;
  const base = book === null || book === undefined ? Uint8Array.from(MAGIC) : book;
  if (!(base instanceof Uint8Array) || base.length < 4 || !MAGIC.every((m, i) => base[i] === m)) return no('not a call book');
  const json = te.encode(JSON.stringify(r.record));
  const e = encode(json);
  if (!e.ok) return no(e.why);
  const out = new Uint8Array(base.length + 4 + e.bytes.length + 32);
  out.set(base, 0);
  new DataView(out.buffer).setUint32(base.length, e.bytes.length);
  out.set(e.bytes, base.length + 4);
  out.set(sha256(json), base.length + 4 + e.bytes.length);
  return { ok: true, bytes: out };
}

/** Every frame, decoded and checked, in order; the first frame that does not check is named. */
export function readBook(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 4 || !MAGIC.every((m, i) => bytes[i] === m)) return no('not a call book');
  const records = [], dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 4;
  while (at < bytes.length) {
    const i = records.length;
    if (bytes.length - at < 4) return no('frame ' + i + ': its length is cut short', i);
    const n = dv.getUint32(at);
    at += 4;
    if (bytes.length - at < n + 32) return no('frame ' + i + ': its body is cut short', i);
    const d = decode(bytes.subarray(at, at + n), undefined, { max: MAX_RECORD });
    if (!d.ok) return no('frame ' + i + ' does not decode: ' + d.why, i);
    if (!sameBytes(sha256(d.bytes), bytes.subarray(at + n, at + n + 32))) return no('frame ' + i + ': its SHA-256 does not match', i);
    let rec;
    try { rec = JSON.parse(td.decode(d.bytes)); } catch { return no('frame ' + i + ' is not JSON', i); }
    const r = recordOf(rec);
    if (!r.ok) return no('frame ' + i + ' is not a call record: ' + r.why, i);
    records.push(r.record);
    at += n + 32;
  }
  return { ok: true, records };
}
