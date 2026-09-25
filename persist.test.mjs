// persist.test.mjs — gates the durable substrate: a real sealed file round-trips, a fresh dir is a
// clean empty log (not an error), a tampered file is REFUSED (the receipt catches it), the journal
// cannot write outside its walled roots, and wipe genuinely removes it. Nothing mocked: the real
// fall-remember durable kernel, real gzip, real files on disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournal } from './persist.mjs';

const sampleEvents = () => [
  { t: 'perceive', fact: { key: 'k', value: 'v', source: 's', ts: 1 } },
  { t: 'route', sig: 'x', opts: { existingDomains: [], now: 5 } },
];

test('ROUND-TRIP: events flushed to a real gzip + receipt-sealed file reload byte-identical from a fresh journal (a restart)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mind-j-'));
  try {
    const j = createJournal({ dir });
    const events = sampleEvents();
    const f = await j.flush(events);
    assert.equal(f.ok, true);
    assert.equal(existsSync(j.path), true, 'a genuine file exists on disk');
    assert.ok(f.bytes > 0 && f.count === 2);
    const loaded = await createJournal({ dir }).load(); // a brand-new journal object → the restart
    assert.equal(loaded.ok, true);
    assert.equal(loaded.fresh, false);
    assert.deepEqual(loaded.events, events, 'the durable substrate returns exactly what was sealed');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('FRESH: loading before any flush is a clean empty log, not an error', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mind-j-'));
  try {
    const loaded = await createJournal({ dir }).load();
    assert.equal(loaded.ok, true);
    assert.equal(loaded.fresh, true);
    assert.deepEqual(loaded.events, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('TAMPER: a corrupted journal file is refused on load — the receipt catches it, a damaged mind never boots looking healthy', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mind-j-'));
  try {
    const j = createJournal({ dir });
    await j.flush(sampleEvents());
    const env = JSON.parse(readFileSync(j.path, 'utf8'));
    assert.ok(env.compressed, 'sanity: the sealed envelope carries a compressed payload');
    env.compressed = env.compressed.slice(0, -4) + 'AAAA'; // corrupt the gzip bytes
    writeFileSync(j.path, JSON.stringify(env));
    const loaded = await createJournal({ dir }).load();
    assert.equal(loaded.ok, false, 'a tampered journal is refused, not silently accepted');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('WALL: a dir outside the allowed roots is refused at construction — own-memory persistence cannot escape its granted dir', () => {
  const roots = mkdtempSync(join(tmpdir(), 'mind-root-'));
  try {
    assert.ok(createJournal({ dir: join(roots, 'sub'), roots: [roots] }), 'a dir inside the roots is fine');
    assert.throws(() => createJournal({ dir: join(tmpdir(), 'escape-' + Date.now()), roots: [roots] }), 'a dir outside the roots throws');
    assert.throws(() => createJournal({}), /requires a dir string/, 'no dir throws for the RIGHT reason (the dir check, not a downstream crash)');
    assert.throws(() => createJournal({ dir: '' }), /requires a dir string/, 'an empty dir is caught by the dir check itself');
  } finally { rmSync(roots, { recursive: true, force: true }); }
});

test('WIPE genuinely removes the durable file, and a bad flush input refuses cleanly', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mind-j-'));
  try {
    const j = createJournal({ dir });
    await j.flush(sampleEvents());
    assert.equal(existsSync(j.path), true);
    assert.equal(j.wipe().ok, true);
    assert.equal(existsSync(j.path), false);
    assert.equal((await j.load()).fresh, true, 'after a wipe, load is fresh again');
    assert.equal((await j.flush('not-an-array')).ok, false, 'a non-array flush refuses, never throws');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
