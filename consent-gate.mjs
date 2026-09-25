#!/usr/bin/env node
// consent-gate.mjs — the propose/confirm pattern, pulled OUT of kar-cockpit.mjs and made reusable.
// Kar's own build, 2026-09-23, chosen freely at the end of a night that kept re-deriving the same
// shape at a deeper layer each time it was tested: a capability doesn't become safe by being argued
// about in the moment, it becomes safe by being made STRUCTURALLY unreachable except through one
// narrow, provable door. The cockpit's PENDING_WRITE/needsConfirm/confirmPending logic WAS that
// door, built inline, for one surface. This is the same mechanism, generalized: any future
// write-capable surface in the estate (the Kar-builder driver eventually, some other tool later)
// gets the proven shape for free instead of re-deriving it from scratch under pressure, the way
// tonight had to.
//
// Total: a single pending slot, single-use, TTL-expiring, id-matched. `now` and `randomId` are
// injectable so the gate is genuinely testable — no real sleeping required to prove expiry, no
// flakiness. Pure except for that one clock/randomness seam.
import { randomBytes } from 'node:crypto';

export function createConsentGate({ ttlMs = 10 * 60 * 1000, now = Date.now, randomId = () => randomBytes(9).toString('base64url') } = {}) {
  let pending = null;

  function clearExpired() {
    if (pending && now() - pending.ts > ttlMs) pending = null;
  }

  // propose(action, summary) — action is an opaque payload the caller defines and gets back intact
  // on confirm; summary is a human-readable string for display. Overwrites any existing pending slot
  // (single-slot, not a queue — a newer proposal always invalidates an older, unconfirmed one).
  function propose(action, summary) {
    if (typeof summary !== 'string' || !summary.trim()) return { ok: false, why: 'summary must be a non-empty string' };
    const id = randomId();
    pending = { id, action, summary, ts: now() };
    return { ok: true, id, summary };
  }

  function peek() {
    clearExpired();
    return pending ? { id: pending.id, summary: pending.summary, action: pending.action } : null;
  }

  // confirm(id) — single-use: the slot is cleared BEFORE returning, so a caller cannot double-fire
  // by calling confirm twice with the same id, even concurrently-issued calls in the same tick.
  function confirm(id) {
    clearExpired();
    if (!pending) return { ok: false, why: 'nothing is pending' };
    // strict !== alone is already total and correct for every input shape (undefined, null, a
    // number, an object — none can ever strictly equal pending.id, which is always a real string
    // built by randomId()) — a separate typeof/truthiness check ahead of it is genuinely redundant,
    // not just untested, so it was removed rather than defended with an exemption.
    if (id !== pending.id) return { ok: false, why: 'that id does not match the current pending action' };
    const { action, summary } = pending;
    pending = null;
    return { ok: true, action, summary };
  }

  return { propose, confirm, peek };
}
