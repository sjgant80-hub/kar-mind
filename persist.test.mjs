// persist.test.mjs — gates the durable substrate: the journal kept as a LIGHT vault round-trips, a fresh dir is a
// clean empty log (not an error), a tampered journal of either kind is REFUSED, a pre-LIGHT gzip journal still loads
// and migrates without loss (moved aside, never deleted), the journal cannot write outside its walled roots, and wipe
// genuinely removes it. Nothing mocked: the real LIGHT vault, the real fall-remember gzip kernel, real files on disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournal, encodeJournal, decodeJournal, ENTRY } from './persist.mjs';
import { makeSnapshot } from '../fall-remember/disk.mjs';
import { pack } from './vendor/fall-kit-core/vendor/light/vault.mjs';

const sampleEvents = () => [
  { t: 'perceive', fact: { key: 'k', value: 'v', source: 's', ts: 1 } },
  { t: 'route', sig: 'x', opts: { existingDomains: [], now: 5 } },
];
const withDir = async (fn) => { const dir = mkdtempSync(join(tmpdir(), 'mind-j-')); try { await fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); } };
const writeLegacy = async (dir, events) => { const s = await makeSnapshot(events); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, 'mind-journal.json'), JSON.stringify(s.envelope)); };

test('ROUND-TRIP: events flushed to a LIGHT vault on disk reload identical from a fresh journal (a restart)', () => withDir(async (dir) => {
  const j = createJournal({ dir });
  assert.equal(j.path, join(dir, 'mind-journal.light'));
  assert.equal(j.legacyPath, join(dir, 'mind-journal.json'));
  assert.equal(j.asidePath, join(dir, 'mind-journal.json.migrated'));
  const events = sampleEvents();
  const f = await j.flush(events);
  assert.deepEqual([f.ok, f.count, f.format, f.migrated, f.path], [true, 2, 'light', false, j.path]);
  assert.equal(existsSync(j.path), true, 'a genuine file exists on disk');
  assert.equal(f.bytes, readFileSync(j.path).length);
  assert.deepEqual([...readFileSync(j.path).subarray(0, 4)], [0x4c, 0x56, 0x54, 0x31], 'it is a LIGHT vault (LVT1)');
  const loaded = await createJournal({ dir }).load(); // a brand-new journal object → the restart
  assert.deepEqual(loaded, { ok: true, events, fresh: false, format: 'light' }, 'the durable substrate returns exactly what was sealed');
  assert.deepEqual((await j.flush([])).count, 0);
  assert.deepEqual((await j.load()).events, [], 'an empty log is kept as an empty log');
}));

test('FRESH: loading before any flush is a clean empty log, not an error', () => withDir(async (dir) => {
  assert.deepEqual(await createJournal({ dir }).load(), { ok: true, events: [], fresh: true, format: null });
}));

test('TAMPER: a changed LIGHT journal is refused on load — a damaged mind never boots looking healthy', () => withDir(async (dir) => {
  const j = createJournal({ dir });
  await j.flush(sampleEvents());
  const b = readFileSync(j.path);
  b[Math.floor(b.length / 2)] ^= 1;
  writeFileSync(j.path, b);
  const loaded = await createJournal({ dir }).load();
  assert.equal(loaded.ok, false, 'a tampered journal is refused, not silently accepted');
  assert.match(loaded.why, /^the journal failed its integrity check \(tampered or corrupt\): /);
  writeFileSync(j.path, 'not a vault');
  assert.equal((await j.load()).ok, false);
  // the guarantee is the events', not every bit's: a coder's last byte can be padding, so a flip there may decode to
  // the very same events. Every single-bit change is refused, or reads back exactly what was sealed: never altered.
  const ev = Array.from({ length: 40 }, (_, i) => ({ t: 'perceive', fact: { key: 'k' + i, value: 'v' + (i % 7), source: 's', ts: i } }));
  const good = encodeJournal(ev).bytes;
  let refused = 0, same = 0;
  for (let i = 0; i < good.length; i++) {
    const c = good.slice(); c[i] ^= 1;
    const d = decodeJournal(c);
    if (!d.ok) refused++; else { assert.deepEqual(d.events, ev, 'a flip at byte ' + i + ' decoded to different events'); same++; }
  }
  assert.equal(refused + same, good.length);
  assert.ok(refused >= good.length - 4, 'nearly every flip is refused outright (' + refused + ' of ' + good.length + ')');
}));

test('LEGACY: a pre-LIGHT gzip journal loads, and the next flush migrates it without loss, keeping the old one aside', () => withDir(async (dir) => {
  const events = sampleEvents();
  await writeLegacy(dir, events);
  const j = createJournal({ dir });
  const before = await j.load();
  assert.deepEqual(before, { ok: true, events, fresh: false, format: 'gzip' });
  const f = await j.flush(before.events);
  assert.deepEqual([f.ok, f.format, f.migrated], [true, 'light', true]);
  assert.equal(existsSync(j.legacyPath), false, 'the old journal is no longer where a boot would read it');
  assert.equal(existsSync(j.asidePath), true, 'it is kept, moved aside, never deleted');
  assert.deepEqual(await createJournal({ dir }).load(), { ok: true, events, fresh: false, format: 'light' });
  const again = await j.flush(events);
  assert.equal(again.migrated, false, 'migration happens once');
  assert.equal(existsSync(j.asidePath), true);
}));

test('LEGACY, unverifiable: events whose JSON is not stable cannot be shown to read back the same, so nothing moves', () => withDir(async (dir) => {
  await writeLegacy(dir, sampleEvents());
  const j = createJournal({ dir });
  let n = 0;
  const unstable = [{ t: 'perceive', toJSON: () => ({ t: 'perceive', n: n++ }) }];
  const f = await j.flush(unstable);
  assert.deepEqual(f, { ok: false, why: 'the LIGHT journal did not read back the same, so the old journal is kept where it is' });
  assert.equal(existsSync(j.legacyPath), true, 'the old journal stays where a boot reads it');
  assert.equal(existsSync(j.asidePath), false);
  assert.equal(existsSync(j.path), false, 'the unverified LIGHT journal is removed, so it cannot win the next boot');
  assert.deepEqual((await j.load()).format, 'gzip');
}));

test('LEGACY TAMPER, and LIGHT wins over a stale gzip journal', () => withDir(async (dir) => {
  await writeLegacy(dir, sampleEvents());
  const env = JSON.parse(readFileSync(join(dir, 'mind-journal.json'), 'utf8'));
  env.compressed = env.compressed.slice(0, -4) + 'AAAA';
  writeFileSync(join(dir, 'mind-journal.json'), JSON.stringify(env));
  const bad = await createJournal({ dir }).load();
  assert.equal(bad.ok, false, 'a tampered gzip journal is refused');
  writeFileSync(join(dir, 'mind-journal.json'), '{ not a journal');
  assert.match((await createJournal({ dir }).load()).why, /^journal file is unreadable: /);
  writeFileSync(join(dir, 'mind-journal.json'), JSON.stringify({ v: 1 }));
  assert.equal((await createJournal({ dir }).load()).ok, false, 'a file that is not an envelope is refused');
  // a valid envelope around a payload that is not an event list
  const s = await makeSnapshot({ not: 'a list' });
  writeFileSync(join(dir, 'mind-journal.json'), JSON.stringify(s.envelope));
  assert.deepEqual(await createJournal({ dir }).load(), { ok: false, why: 'journal payload is not an event array' });
  // with both present, the LIGHT vault is what a boot reads
  const light = [{ t: 'perceive', fact: { key: 'new', value: 'light', source: 's', ts: 2 } }];
  writeFileSync(join(dir, 'mind-journal.light'), encodeJournal(light).bytes);
  assert.deepEqual((await createJournal({ dir }).load()).events, light);
}));

test('encodeJournal and decodeJournal: only an event list in, only a mind journal out', () => {
  const e = encodeJournal(sampleEvents());
  assert.equal(e.ok, true);
  assert.deepEqual(decodeJournal(e.bytes), { ok: true, events: sampleEvents() });
  assert.deepEqual(encodeJournal('x'), { ok: false, why: 'events must be an array' });
  const loop = []; loop.push(loop);
  assert.match(encodeJournal(loop).why, /^the events are not JSON: /);
  const big = [{ b: 1n }];
  assert.match(encodeJournal(big).why, /^the events are not JSON: /);
  assert.equal(ENTRY, 'events.json');
  const two = pack([{ path: ENTRY, bytes: new TextEncoder().encode('[]') }, { path: 'other', bytes: new Uint8Array(1) }]).bytes;
  assert.deepEqual(decodeJournal(two), { ok: false, why: 'the vault is not a mind journal' });
  const wrong = pack([{ path: 'other.json', bytes: new TextEncoder().encode('[]') }]).bytes;
  assert.deepEqual(decodeJournal(wrong), { ok: false, why: 'the vault is not a mind journal' });
  const notJson = pack([{ path: ENTRY, bytes: new TextEncoder().encode('[1,') }]).bytes;
  assert.deepEqual(decodeJournal(notJson), { ok: false, why: 'the journal payload is not JSON' });
  const notUtf8 = pack([{ path: ENTRY, bytes: Uint8Array.of(0x5b, 0xff, 0x5d) }]).bytes;
  assert.deepEqual(decodeJournal(notUtf8), { ok: false, why: 'the journal payload is not JSON' });
  const notList = pack([{ path: ENTRY, bytes: new TextEncoder().encode('{"a":1}') }]).bytes;
  assert.deepEqual(decodeJournal(notList), { ok: false, why: 'journal payload is not an event array' });
  assert.match(decodeJournal('x').why, /^the journal failed its integrity check \(tampered or corrupt\): not a LIGHT vault/);
  assert.equal(decodeJournal(pack([]).bytes).why, 'the vault is not a mind journal', 'an empty vault is not a journal');
});

test('WALL: a dir outside the allowed roots is refused at construction — own-memory persistence cannot escape its granted dir', () => {
  const roots = mkdtempSync(join(tmpdir(), 'mind-root-'));
  try {
    assert.ok(createJournal({ dir: join(roots, 'sub'), roots: [roots] }), 'a dir inside the roots is fine');
    assert.throws(() => createJournal({ dir: join(tmpdir(), 'escape-' + Date.now()), roots: [roots] }), /journal dir is outside its allowed roots/, 'a dir outside the roots throws');
    assert.throws(() => createJournal({}), /requires a dir string/, 'no dir throws for the RIGHT reason (the dir check, not a downstream crash)');
    assert.throws(() => createJournal({ dir: '' }), /requires a dir string/, 'an empty dir is caught by the dir check itself');
    assert.throws(() => createJournal({ dir: '   ' }), /requires a dir string/);
    assert.throws(() => createJournal({ dir: 5 }), /requires a dir string/);
    assert.ok(createJournal({ dir: join(roots, 'sub'), roots: [] }), 'no roots given: the dir itself is the root');
  } finally { rmSync(roots, { recursive: true, force: true }); }
});

test('WIPE genuinely removes the journal in either form, keeps the moved-aside copy, and a bad flush input refuses cleanly', () => withDir(async (dir) => {
  const j = createJournal({ dir });
  await j.flush(sampleEvents());
  assert.equal(existsSync(j.path), true);
  assert.deepEqual(j.wipe(), { ok: true });
  assert.equal(existsSync(j.path), false);
  assert.equal((await j.load()).fresh, true, 'after a wipe, load is fresh again');
  await writeLegacy(dir, sampleEvents());
  assert.deepEqual(j.wipe(), { ok: true });
  assert.equal(existsSync(j.legacyPath), false, 'the old form is wiped too');
  await writeLegacy(dir, sampleEvents());
  await j.flush(sampleEvents());
  assert.equal(existsSync(j.asidePath), true);
  j.wipe();
  assert.equal(existsSync(j.asidePath), true, 'the recovery copy survives a wipe');
  assert.deepEqual(await j.flush('not-an-array'), { ok: false, why: 'events must be an array' }, 'a non-array flush refuses, never throws');
  mkdirSync(j.path, { recursive: true });   // a directory where the file should be: the write fails, cleanly
  assert.match((await j.flush(sampleEvents())).why, /^journal write failed: /);
  assert.match((await j.load()).why, /^journal file is unreadable: /);
  assert.match(j.wipe().why, /^wipe failed: /);
}));
