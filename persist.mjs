#!/usr/bin/env node
// persist.mjs — THE DURABLE SUBSTRATE. A node-side, receipt-sealed, gzip-compressed event journal
// that lets the mind survive a restart. The mind's cognition is event-sourced: every state-changing
// verb (perceive/consolidate/dream/route) records the event that caused it; this journal is where
// those events live durably, and on boot the organs rebuild from it to byte-identical counts.
//
// KONOMIFIED IN PLACE — the compression + tamper-proof receipt envelope is NOT reinvented here: it is
// fall-remember's own gated durable kernel (`../fall-remember/disk.mjs` → `store.mjs`, built and
// proven in the durable-memory kernel: real gzip, a receiptHash over every field, backup→wipe→restore
// proven live). This file is thin node-fs glue around that gated law — the same ungated-glue /
// gated-kernel split disk.mjs itself uses. Reused, not forked.
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
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { makeSnapshot, restoreSnapshot } from '../fall-remember/disk.mjs';
import { createWall } from './wall.mjs';

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
  const fg = guard(join(base, 'mind-journal.json'));
  if (!fg.ok) throw new Error('journal file path is walled off: ' + fg.why);
  const file = fg.path;

  // flush(events) — seal the whole event array through fall-remember's real makeSnapshot (gzip +
  // receipt) and write it to the one journal file, inside the wall. Whole-state snapshot semantics
  // (the events array is the state), exactly like disk.mjs's own makeSnapshot contract.
  async function flush(events) {
    if (!Array.isArray(events)) return { ok: false, why: 'events must be an array' };
    const snap = await makeSnapshot(events);
    if (!snap.ok) return snap;
    const text = JSON.stringify(snap.envelope);
    try { mkdirSync(base, { recursive: true }); writeFileSync(file, text); }
    catch (e) { return { ok: false, why: 'journal write failed: ' + e.message }; }
    return { ok: true, path: file, count: events.length, bytes: text.length };
  }

  // load() — read the journal file, verify its receipt through the real openEnvelope law, and hand
  // back the event array. A fresh dir (no file yet) is a clean {events:[], fresh:true}, NOT an error.
  // A tampered/corrupt file is refused ({ok:false}) — a silently-accepted corrupt journal would let a
  // damaged mind boot looking healthy, exactly the failure the receipt exists to catch.
  async function load() {
    if (!existsSync(file)) return { ok: true, events: [], fresh: true };
    let raw;
    try { raw = JSON.parse(readFileSync(file, 'utf8')); }
    catch (e) { return { ok: false, why: 'journal file is unreadable: ' + e.message }; }
    const r = await restoreSnapshot(raw);
    if (!r.ok) return r;
    if (!r.valid) return { ok: false, why: 'journal failed its integrity check (tampered or corrupt): ' + r.why };
    if (!Array.isArray(r.state)) return { ok: false, why: 'journal payload is not an event array' };
    return { ok: true, events: r.state, fresh: false };
  }

  function wipe() {
    try { if (existsSync(file)) rmSync(file); return { ok: true }; }
    catch (e) { return { ok: false, why: 'wipe failed: ' + e.message }; }
  }

  return { flush, load, wipe, path: file };
}
