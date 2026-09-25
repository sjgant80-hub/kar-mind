import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, existsSync, symlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createWall, safeResolve } from './wall.mjs';

// Portable temp layout: a private base dir, a root inside it, and an OUTSIDE sibling under the same
// base — so the `..` traversal and prefix-collision probes have a real sibling to reach for, on any OS.
const BASE = mkdtempSync(join(tmpdir(), 'wall-test-'));
const TMP = join(BASE, 'root');
const INSIDE = join(TMP, 'inside');
const OUTSIDE = join(BASE, 'outside');

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  rmSync(OUTSIDE, { recursive: true, force: true });
  mkdirSync(INSIDE, { recursive: true });
  mkdirSync(OUTSIDE, { recursive: true });
  writeFileSync(join(OUTSIDE, 'marker.txt'), 'OUTSIDE');
}
function teardown() { rmSync(TMP, { recursive: true, force: true }); rmSync(OUTSIDE, { recursive: true, force: true }); }

test('safeResolve on an existing path resolves normally', () => {
  setup();
  try { assert.equal(safeResolve(join(TMP, 'inside')), resolve(join(TMP, 'inside'))); }
  finally { teardown(); }
});

test('safeResolve on a NOT-YET-EXISTING path still resolves the existing prefix and reattaches the suffix untouched', () => {
  setup();
  try {
    const notYet = join(TMP, 'inside', 'brand-new-subdir', 'brand-new-file.txt');
    assert.equal(safeResolve(notYet), resolve(notYet)); // no symlinks involved here — plain reattachment must be exact
  } finally { teardown(); }
});

test('safeResolve never throws on garbage input', () => {
  for (const bad of [undefined, null, 123, {}, [], () => {}]) {
    assert.doesNotThrow(() => safeResolve(bad));
  }
});

test('createWall requires at least one root (a config error, not a silent open door)', () => {
  assert.throws(() => createWall({ roots: [] }));
  assert.throws(() => createWall({ roots: undefined }));
});

test('guard: inside a root is allowed', () => {
  setup();
  try {
    const guard = createWall({ roots: [TMP] });
    const r = guard(INSIDE);
    assert.equal(r.ok, true);
  } finally { teardown(); }
});

test('guard: outside every root is refused', () => {
  setup();
  try {
    const guard = createWall({ roots: [TMP] });
    assert.equal(guard(OUTSIDE).ok, false);
  } finally { teardown(); }
});

test('guard: a forbidden-pattern path is refused even though it is inside an allowed root', () => {
  setup();
  try {
    const guard = createWall({ roots: [TMP], forbidden: [/secret/i] });
    assert.equal(guard(join(TMP, 'my.secret.json')).ok, false);
  } finally { teardown(); }
});

test('guard: an excluded directory is refused even though it sits inside an allowed root', () => {
  setup();
  try {
    const walledOff = join(TMP, 'private');
    mkdirSync(walledOff, { recursive: true });
    const guard = createWall({ roots: [TMP], excluded: [walledOff] });
    assert.equal(guard(walledOff).ok, false);
    assert.equal(guard(join(walledOff, 'x.txt')).ok, false);
    assert.equal(guard(INSIDE).ok, true); // the rest of the root is unaffected
  } finally { teardown(); }
});

test('guard: .. traversal out of the root is refused', () => {
  setup();
  try {
    const guard = createWall({ roots: [TMP] });
    assert.equal(guard(join(TMP, '..', 'outside')).ok, false);
  } finally { teardown(); }
});

test('guard: garbage input refuses cleanly, never throws', () => {
  const guard = createWall({ roots: [BASE] });
  for (const bad of [undefined, null, 123, {}, [], () => {}, '']) {
    assert.doesNotThrow(() => { const r = guard(bad); assert.equal(r.ok, false); });
  }
});

test('guard: prefix-collision probe — a sibling whose name merely starts with the root string is not a match (no naive startsWith on the raw string)', () => {
  setup();
  try {
    const guard = createWall({ roots: [TMP] });
    const evilSibling = TMP + '-evil';
    mkdirSync(evilSibling, { recursive: true });
    try { assert.equal(guard(evilSibling).ok, false); }
    finally { rmSync(evilSibling, { recursive: true, force: true }); }
  } finally { teardown(); }
});

test('REAL symlink escape: a symlink inside an allowed root pointing outside every root is refused, for an EXISTING outside file and a NOT-YET-EXISTING one', () => {
  setup();
  const LINK = join(TMP, 'escape-link');
  let linkOk = false;
  try {
    // portable: a real directory symlink (type 'junction' on Windows needs no admin; 'dir' on POSIX)
    symlinkSync(OUTSIDE, LINK, process.platform === 'win32' ? 'junction' : 'dir');
    linkOk = existsSync(LINK);
  } catch { /* environment can't create the symlink — skip, not a wall result */ }
  try {
    if (linkOk) {
      const guard = createWall({ roots: [TMP] });
      assert.equal(guard(join(LINK, 'marker.txt')).ok, false); // existing file through the link
      assert.equal(guard(join(LINK, 'brand-new-not-yet.txt')).ok, false); // not-yet-existing file through the link — the harder case
    }
  } finally { teardown(); }
});
