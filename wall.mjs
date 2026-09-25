#!/usr/bin/env node
// wall.mjs — the structural-allowlist + realpath-safe guard pattern, extracted from TWO real,
// independent, bespoke implementations (2026-09-23): kar-tools.mjs's inWall (the read wall, proven
// 55/55) and kar-tools-write.mjs's inWriteWall/safeResolve/validTarget (the write wall, proven
// 48/48). Both do the same underlying thing: resolve a path through any symlink/junction to its
// TRUE location, then check it against a forbidden-pattern list and a root-membership rule. This is
// that shared shape, pulled out because two real callers already earned it, not invented ahead of
// need.
import { existsSync, realpathSync } from 'node:fs';
import { resolve, sep, dirname, join } from 'node:path';

// The harder of the two original resolvers, kept as the one canonical version: walks up to the
// nearest EXISTING ancestor and realpaths that (resolving any symlink/junction in the chain), then
// reattaches any not-yet-existing suffix untouched. Correct for an existing target (the read wall's
// original case) AND a not-yet-existing one (the write wall's harder case — a junction planted
// inside a legitimate directory, aimed at a file that doesn't exist yet — the exact class of attack
// breach-test-write.mjs's case 7 proved the simpler existsSync-gated realpath would have missed).
export function safeResolve(p) {
  let r; try { r = resolve(p); } catch { return null; }
  let cur = r, suffix = [];
  while (cur && !existsSync(cur)) {
    const parent = dirname(cur);
    if (parent === cur) break; // reached the filesystem root without finding anything real
    suffix.unshift(cur.slice(parent.length + 1));
    cur = parent;
  }
  try { cur = realpathSync(cur); } catch { /* leave as-is if realpath itself fails */ }
  return suffix.length ? join(cur, ...suffix) : cur;
}

// createWall({roots, forbidden, excluded}) -> guard(path) => {ok, path, why}
// A caller's own additional, situation-specific policy (kar-tools-write.mjs's "or a fresh kar-*
// directory" rule, say) composes AROUND this — it is deliberately not folded in here, because that
// rule has exactly one real caller today and generalizing it now would be inventing an abstraction
// ahead of the second real use that would actually earn it.
export function createWall({ roots, forbidden = [], excluded = [] }) {
  if (!Array.isArray(roots) || roots.length === 0) throw new Error('createWall requires at least one root');
  const R = roots.map((r) => resolve(r));
  const X = (excluded || []).map((r) => resolve(r));
  const F = Array.isArray(forbidden) ? forbidden : [];
  return function guard(path) {
    if (typeof path !== 'string' || !path.trim()) return { ok: false, why: 'path must be a non-empty string' };
    const r = safeResolve(path);
    if (!r) return { ok: false, why: 'unresolvable path' };
    for (const x of X) if (r === x || r.startsWith(x + sep)) return { ok: false, why: 'that path is walled off' };
    if (F.some((re) => re.test(r))) return { ok: false, why: 'that path is walled off (secret-shaped)' };
    if (!R.some((root) => r === root || r.startsWith(root + sep))) return { ok: false, why: 'outside the allowed roots (' + R.map((x) => x.replace(/\\/g, '/')).join(', ') + ')' };
    return { ok: true, path: r };
  };
}
