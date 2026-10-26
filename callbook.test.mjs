// callbook.test.mjs — the call book: what was asked, of which mind, what came back and what it cost, kept in LIGHT,
// appended frame by frame and read back exactly; a changed book is refused at the frame that changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordOf, appendBook, readBook, MAGIC, MAX_RECORD, TIERS } from './callbook.mjs';

const call = (over = {}) => ({ at: '2026-10-26T12:10:45.818Z', tier: 'frontier', model: 'claude-opus-4-8', fallback: false, why: '"propose" is judgement: the frontier', prompt: 'Propose ONE small thing.', reply: { idea: 'x', uses: ['a'] }, tokens: 2164, turns: 2, ...over });

test('the constants', () => {
  assert.deepEqual(MAGIC, [0x4c, 0x43, 0x42, 0x31]);
  assert.equal(MAX_RECORD, 1048576);
  assert.deepEqual(TIERS, ['deterministic', 'local', 'frontier']);
  assert.equal(Object.isFrozen(MAGIC) && Object.isFrozen(TIERS), true);
});

test('recordOf: every field checked, and kept in one order', () => {
  const r = recordOf(call());
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.record), ['at', 'tier', 'model', 'fallback', 'why', 'prompt', 'reply', 'tokens', 'turns']);
  assert.deepEqual(recordOf({ ...call(), extra: 1 }).record, call(), 'fields not in a record are dropped');
  assert.equal(recordOf(call({ at: '2026-10-26T12:10:45Z' })).ok, true, 'seconds alone');
  assert.equal(recordOf(call({ at: '2026-10-26T12:10:45.8Z' })).ok, true);
  for (const at of ['2026-10-26', '2026-10-26T12:10:45.8181Z', 'x', 5, null, ' 2026-10-26T12:10:45Z', '2026-10-26T12:10:45Z ']) assert.deepEqual(recordOf(call({ at })), { ok: false, why: 'at is an ISO moment' }, String(at));
  for (const tier of ['remote', '', null, 'Frontier']) assert.deepEqual(recordOf(call({ tier })), { ok: false, why: 'tier is deterministic, local or frontier' });
  for (const tier of TIERS) assert.equal(recordOf(call({ tier })).ok, true);
  assert.equal(recordOf(call({ model: null })).ok, true, 'no model: a deterministic job, or a local model that never answered');
  for (const model of ['', 5, 'm'.repeat(121), undefined]) assert.deepEqual(recordOf(call({ model })), { ok: false, why: 'model names the model, or is null' });
  assert.equal(recordOf(call({ model: 'm'.repeat(120) })).ok, true);
  for (const fallback of ['yes', 1, null]) assert.deepEqual(recordOf(call({ fallback })), { ok: false, why: 'fallback is true or false' });
  assert.equal(recordOf(call({ fallback: true })).ok, true);
  for (const why of [null, 5, 'w'.repeat(2001)]) assert.deepEqual(recordOf(call({ why })), { ok: false, why: 'why says why the call went where it did' });
  assert.equal(recordOf(call({ why: '' })).ok, true);
  assert.equal(recordOf(call({ why: 'w'.repeat(2000) })).ok, true);
  for (const prompt of ['', null, 7]) assert.deepEqual(recordOf(call({ prompt })), { ok: false, why: 'prompt is what was asked' });
  for (const [tokens, turns] of [[-1, 1], [1.5, 1], [1, -1], [1, 'x'], ['1', 1]]) assert.deepEqual(recordOf(call({ tokens, turns })), { ok: false, why: 'tokens and turns are whole numbers' });
  assert.equal(recordOf(call({ tokens: 0, turns: 0 })).ok, true);
  assert.deepEqual(recordOf(call({ reply: undefined })).record.reply, null, 'no reply is recorded as null');
  assert.equal(recordOf(call({ reply: 'plain text' })).record.reply, 'plain text');
  assert.deepEqual(recordOf(call({ reply: { d: new Date(0) } })).record.reply, { d: '1970-01-01T00:00:00.000Z' }, 'the reply is kept as its JSON');
  const loop = {}; loop.self = loop;
  assert.deepEqual(recordOf(call({ reply: loop })), { ok: false, why: 'the reply is not JSON' });
  assert.deepEqual(recordOf(call({ reply: 1n })), { ok: false, why: 'the reply is not JSON' });
  assert.deepEqual(recordOf(call({ prompt: 'p'.repeat(MAX_RECORD) })), { ok: false, why: 'a record is at most 1048576 bytes' });
  const near = JSON.stringify({ ...call(), prompt: '' }).length;
  assert.equal(recordOf(call({ prompt: 'p'.repeat(MAX_RECORD - near) })).ok, true, 'exactly the limit is a record');
  assert.equal(recordOf(call({ prompt: 'p'.repeat(MAX_RECORD - near + 1) })).ok, false, 'one byte past it is not');
  assert.deepEqual(recordOf(null), { ok: false, why: 'at is an ISO moment' });
  assert.deepEqual(recordOf([call()]), { ok: false, why: 'at is an ISO moment' });
});

test('appendBook and readBook: frames appended, read back exactly, in order', () => {
  let b = null;
  const calls = [call(), call({ tier: 'local', model: 'qwen2.5:7b', reply: '{"idea": "a local one"}', tokens: 0, turns: 0, fallback: false }), call({ tier: 'local', model: null, fallback: true, why: 'the frontier did not answer', reply: null, tokens: 0, turns: 0 })];
  for (const c of calls) { const r = appendBook(b, c); assert.equal(r.ok, true); b = r.bytes; }
  assert.deepEqual([...b.subarray(0, 4)], MAGIC);
  assert.deepEqual(readBook(b), { ok: true, records: calls.map((c) => recordOf(c).record) });
  const one = appendBook(null, call()).bytes;
  assert.deepEqual(readBook(one).records.length, 1);
  assert.deepEqual(appendBook(undefined, call()).bytes, one, 'no book yet: a new one');
  const extended = appendBook(one, call({ turns: 1 })).bytes;
  assert.deepEqual(extended.subarray(0, one.length), one, 'appending never rewrites what is there');
  assert.deepEqual(readBook(Uint8Array.from(MAGIC)), { ok: true, records: [] }, 'an empty book is a book');
  assert.deepEqual(appendBook(null, { ...call(), tier: 'x' }), { ok: false, why: 'tier is deterministic, local or frontier' });
  for (const bad of ['x', new Uint8Array(3), Uint8Array.of(0x4c, 0x43, 0x42, 0x32), [0x4c, 0x43, 0x42, 0x31]]) assert.deepEqual(appendBook(bad, call()), { ok: false, why: 'not a call book' }, String(bad));
});

test('readBook: a changed book is refused at the frame that changed', () => {
  let b = appendBook(null, call()).bytes;
  b = appendBook(b, call({ turns: 1 })).bytes;
  const firstEnd = appendBook(null, call()).bytes.length;
  for (const bad of ['x', null, new Uint8Array(3), Uint8Array.of(0x4c, 0x43, 0x42, 0x30, 1)]) assert.deepEqual(readBook(bad), { ok: false, why: 'not a call book' });
  // a flipped byte in the second frame's body or hash: refused there, never read as something else
  for (let i = firstEnd + 1; i < b.length; i++) {
    const c = b.slice(); c[i] ^= 1;
    const r = readBook(c);
    if (r.ok) assert.deepEqual(r.records, readBook(b).records, 'a flip at ' + i + ' read back as different records');
    else assert.equal(r.at, 1, 'refused at the second frame: ' + r.why);
  }
  const cut = b.subarray(0, b.length - 1);
  assert.deepEqual(readBook(cut), { ok: false, why: 'frame 1: its body is cut short', at: 1 });
  assert.deepEqual(readBook(Uint8Array.of(...MAGIC, 0, 0, 0)), { ok: false, why: 'frame 0: its length is cut short', at: 0 }, 'three bytes of a four-byte length');
  assert.deepEqual(readBook(Uint8Array.of(...MAGIC, 0, 0, 0, 0)), { ok: false, why: 'frame 0: its body is cut short', at: 0 }, 'a length and nothing after it');
  assert.deepEqual(readBook(Uint8Array.of(...MAGIC, 0, 0, 0, 0, ...new Uint8Array(31))), { ok: false, why: 'frame 0: its body is cut short', at: 0 }, 'a hash one byte short');
  assert.match(readBook(Uint8Array.of(...MAGIC, 0, 0, 0, 0, ...new Uint8Array(32))).why, /^frame 0 does not decode: /, 'exactly a hash after an empty body: read, and refused by the codec');
  assert.match(readBook(Uint8Array.of(...MAGIC, 0, 0, 0, 1, 7, ...new Uint8Array(32))).why, /^frame 0 does not decode: /, 'a body of one byte is read');
  assert.deepEqual(readBook(Uint8Array.of(...MAGIC, 0, 0, 0, 2, 7, ...new Uint8Array(32))), { ok: false, why: 'frame 0: its body is cut short', at: 0 }, 'a body one byte short of its length');
  assert.deepEqual(readBook(Uint8Array.of(...MAGIC, 0xff, 0xff, 0xff, 0xff, 1, 2, 3)), { ok: false, why: 'frame 0: its body is cut short', at: 0 }, 'a length past the book');
  // a frame after a good one, read at its own offset
  const twoGood = appendBook(appendBook(null, call()).bytes, call({ turns: 9 })).bytes;
  assert.deepEqual(readBook(twoGood).records.map((r) => r.turns), [2, 9]);
  assert.deepEqual(readBook(new Uint8Array([...twoGood, 1])), { ok: false, why: 'frame 2: its length is cut short', at: 2 }, 'a stray byte after the last frame');
  const offset = new Uint8Array(twoGood.length + 3); offset.set(twoGood, 3);
  assert.deepEqual(readBook(offset.subarray(3)).records.length, 2, 'a book that starts part-way into its buffer');
  const h = b.slice(); h[h.length - 1] ^= 1;
  assert.deepEqual(readBook(h), { ok: false, why: 'frame 1: its SHA-256 does not match', at: 1 });
  const g = b.slice(); g[firstEnd + 5] ^= 0xff;
  assert.equal(readBook(g).at, 1);
});

test('readBook: a frame that checks but is not a call record is refused', async () => {
  const { encode } = await import('./vendor/fall-kit-core/vendor/light/codec.mjs');
  const { sha256 } = await import('./vendor/fall-kit-core/vendor/light/sha256.mjs');
  const len = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const frame = (json) => { const raw = new TextEncoder().encode(json), e = encode(raw).bytes; return Uint8Array.of(...MAGIC, ...len(e.length), ...e, ...sha256(raw)); };
  assert.deepEqual(readBook(frame('{"at":"x"}')), { ok: false, why: 'frame 0 is not a call record: at is an ISO moment', at: 0 });
  assert.deepEqual(readBook(frame('{"at"')), { ok: false, why: 'frame 0 is not JSON', at: 0 });
  const notUtf8 = (() => { const raw = Uint8Array.of(0x22, 0xff, 0x22), e = encode(raw).bytes; return Uint8Array.of(...MAGIC, ...len(e.length), ...e, ...sha256(raw)); })();
  assert.deepEqual(readBook(notUtf8), { ok: false, why: 'frame 0 is not JSON', at: 0 });
  const junk = Uint8Array.of(...MAGIC, 0, 0, 0, 3, 1, 2, 3, ...new Uint8Array(32));
  assert.match(readBook(junk).why, /^frame 0 does not decode: /);
  const big = new TextEncoder().encode(JSON.stringify({ ...call(), prompt: 'p'.repeat(MAX_RECORD) })), eb = encode(big).bytes;
  const whole = new Uint8Array(4 + 4 + eb.length + 32);
  whole.set(MAGIC, 0); whole.set(len(eb.length), 4); whole.set(eb, 8); whole.set(sha256(big), 8 + eb.length);
  assert.match(readBook(whole).why, /^frame 0 does not decode: /, 'a frame claiming more than a record holds');
  const short = frame(JSON.stringify(recordOf(call()).record)); short[short.length - 1] ^= 1;
  assert.deepEqual(readBook(short), { ok: false, why: 'frame 0: its SHA-256 does not match', at: 0 }, 'the last byte of the hash');
  const first = frame(JSON.stringify(recordOf(call()).record)); first[first.length - 32] ^= 1;
  assert.deepEqual(readBook(first), { ok: false, why: 'frame 0: its SHA-256 does not match', at: 0 }, 'the first byte of the hash');
});
