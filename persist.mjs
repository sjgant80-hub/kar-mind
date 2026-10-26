#!/usr/bin/env node
// persist.mjs — THE DURABLE SUBSTRATE. A node-side, tamper-evident event journal that lets the mind survive a
// restart. The mind's cognition is event-sourced: every state-changing verb (perceive/consolidate/dream/route)
// records the event that caused it; this journal is where those events live durably, and on boot the organs
// rebuild from it to byte-identical counts.
//
// KEPT IN LIGHT (2026-10-26, the estate go-live's Phase 2, pass 2: fall-kit/core/phase2/claims.json M1–M2). The
// journal is one LIGHT vault (`mind-journal.light`): the events as one JSON file, coded by the estate's own lossless
// codec, with the SHA-256 of its bytes inside the vault, so unpack refuses a vault whose bytes changed. The vault is
// the shared foundation's (vendor/fall-kit-core/vendor/light/vault.mjs, vendored and pinned), not reinvented here.
//
// MIGRATES WITHOUT LOSS. A journal written before LIGHT is fall-remember's gated gzip envelope (`mind-journal.json`:
// real gzip, a receiptHash over every field). It is still read through that kernel (`../fall-remember/disk.mjs`), and
// the first flush after it writes the LIGHT vault, reads it back, and only when the events come back identical moves
// the old file aside as `mind-journal.json.migrated`, kept, never deleted. A LIGHT vault that is present always wins.
//
// SHAPED AFTER GARY W. FLOYD's NEXUS (Lumiea Systems Research Division, ThunderStruck Service LLC):
// Nexus persists its tiers in a real database and feeds them from a durable ingest/processing layer
// (`processing_queue`, `async_jobs` in the real `nexus_shortterm` schema). This journal is that
// durable ingest log; the organs are the working tiers rebuilt from it — a write-ahead-log persistence
// architecture, the same shape Postgres itself recovers by. Credited as the reference, not reimplemented.
//
// WALLED, on purpose: the journal writes ONLY inside its allowed roots (the real `wall.mjs` guard).
// The mind persisting its OWN memory is autonomous and fine; it still cannot write a byte outside the
// dir it was granted — own-memory persistence is confined by construction, not by good behaviour.
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { restoreSnapshot } from '../fall-remember/disk.mjs';
import { pack, unpack } from './vendor/fall-kit-core/vendor/light/vault.mjs';
import { createWall } from './wall.mjs';

export const ENTRY = 'events.json';
const te = new TextEncoder(), td = new TextDecoder('utf-8', { fatal: true });

/** Events → a LIGHT vault. → { ok, bytes } | { ok: false, why } */
export function encodeJournal(events) {
  if (!Array.isArray(events)) return { ok: false, why: 'events must be an array' };
  let json;
  try { json = JSON.stringify(events); } catch (e) { return { ok: false, why: 'the events are not JSON: ' + e.message }; }
  const p = pack([{ path: ENTRY, bytes: te.encode(json) }]);
  return p.ok ? { ok: true, bytes: p.bytes } : { ok: false, why: p.why };
}

/** A LIGHT vault → its events, only if every byte checks. → { ok, events } | { ok: false, why } */
export function decodeJournal(bytes) {
  const u = unpack(bytes);
  if (!u.ok) return { ok: false, why: 'the journal failed its integrity check (tampered or corrupt): ' + u.why };
  if (u.entries.length !== 1 || u.entries[0].path !== ENTRY) return { ok: false, why: 'the vault is not a mind journal' };
  let events;
  try { events = JSON.parse(td.decode(u.entries[0].bytes)); } catch { return { ok: false, why: 'the journal payload is not JSON' }; }
  return Array.isArray(events) ? { ok: true, events } : { ok: false, why: 'journal payload is not an event array' };
}

// createJournal({dir, roots?}) — dir is where the journal file lives; roots (default [dir]) are the
// only places it may write. Bad config throws at construction (a build-time contract, like createWall/
// createTetra); every runtime call is total ({ok:false, why}, never throws).
export function createJournal({ dir, roots } = {}) {
  if (typeof dir !== 'string' || !dir.trim()) throw new Error('createJournal requires a dir string');
  const allow = Array.isArray(roots) && roots.length ? roots : [dir];
  const guard = createWall({ roots: allow });
  const dg = guard(dir);
  if (!dg.ok) throw new Error('journal dir is outside its allowed roots: ' + dg.why);
  const base = dg.path;
  const walled = (name) => { const g = guard(join(base, name)); if (!g.ok) throw new Error('journal file path is walled off: ' + g.why); return g.path; };
  const file = walled('mind-journal.light'), legacy = walled('mind-journal.json'), aside = walled('mind-journal.json.migrated');

  // flush(events) — the whole event array as one LIGHT vault, written inside the wall. If a pre-LIGHT journal is
  // still here, it is moved aside only after the vault on disk reads back to exactly these events.
  async function flush(events) {
    const e = encodeJournal(events);
    if (!e.ok) return e;
    try { mkdirSync(base, { recursive: true }); writeFileSync(file, e.bytes); }
    catch (err) { return { ok: false, why: 'journal write failed: ' + err.message }; }
    let migrated = false;
    if (existsSync(legacy)) {
      let back;
      try { back = decodeJournal(new Uint8Array(readFileSync(file))); } catch { back = { ok: false }; }
      if (!back.ok || JSON.stringify(back.events) !== JSON.stringify(events)) {
        try { rmSync(file); } catch { /* the old journal still loads only if this one is gone; say so below */ }
        return { ok: false, why: 'the LIGHT journal did not read back the same, so the old journal is kept where it is' };
      }
      try { renameSync(legacy, aside); migrated = true; } catch (err) { return { ok: false, why: 'the old journal could not be moved aside: ' + err.message }; }
    }
    return { ok: true, path: file, count: events.length, bytes: e.bytes.length, format: 'light', migrated };
  }

  // load() — the LIGHT vault if it is here, else a pre-LIGHT gzip journal through fall-remember's gated law, else a
  // fresh, empty log (NOT an error). A tampered or corrupt journal of either kind is refused ({ok:false}): a silently
  // accepted corrupt journal would let a damaged mind boot looking healthy, exactly what the checks exist to catch.
  async function load() {
    if (existsSync(file)) {
      let bytes;
      try { bytes = new Uint8Array(readFileSync(file)); } catch (e) { return { ok: false, why: 'journal file is unreadable: ' + e.message }; }
      const d = decodeJournal(bytes);
      return d.ok ? { ok: true, events: d.events, fresh: false, format: 'light' } : d;
    }
    if (!existsSync(legacy)) return { ok: true, events: [], fresh: true, format: null };
    let raw;
    try { raw = JSON.parse(readFileSync(legacy, 'utf8')); }
    catch (e) { return { ok: false, why: 'journal file is unreadable: ' + e.message }; }
    const r = await restoreSnapshot(raw);
    if (!r.ok) return r;
    if (!r.valid) return { ok: false, why: 'journal failed its integrity check (tampered or corrupt): ' + r.why };
    if (!Array.isArray(r.state)) return { ok: false, why: 'journal payload is not an event array' };
    return { ok: true, events: r.state, fresh: false, format: 'gzip' };
  }

  // wipe() — removes the journal, in either form. A moved-aside pre-LIGHT journal is kept: it is the recovery copy.
  function wipe() {
    try { for (const f of [file, legacy]) if (existsSync(f)) rmSync(f); return { ok: true }; }
    catch (e) { return { ok: false, why: 'wipe failed: ' + e.message }; }
  }

  return { flush, load, wipe, path: file, legacyPath: legacy, asidePath: aside };
}
