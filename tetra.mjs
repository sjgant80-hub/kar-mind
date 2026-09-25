#!/usr/bin/env node
// tetra.mjs — TETRA: birth. Pure kernel, wired to nothing yet (a further step, not this one — same
// discipline as crystal's own first pass). Decides existing-domain-match vs genuinely-new, and on
// new, births a bounded organ-subtree structure — never unbounded, by construction, not by policy.
//
// HONEST MINIMAL SCOPE, same call made on the-dreamer's loop-back and Veridia's real shape: the
// spec's fuller "grows new organs" vision (a birthed domain actually spinning up real crystal/dodeca/
// icosa/octa instances of its own) is beyond what a gated kernel earns tonight. What's built here is
// the honest floor under that: detection (does this genuinely not match anything known) + bounded
// birth (a real, capacity-checked domain record). Actually spinning up live organ instances per
// domain is flagged as a further step, not built here — don't build the spec's idea over what a
// gate can actually prove tonight.
//
// THE BOUND, the load-bearing property for the highest-blast-radius shell: two structural limits,
// both checked BEFORE any birth happens, not after:
//   - noveltyThreshold: a signature must be seen this many times before it births anything — one
//     stray novel-looking input can never spawn a domain alone.
//   - maxDomains: birth is refused outright once the cap is reached — domainCount() can never exceed
//     it, by construction (the check runs before the Map is ever written to).
//
// Total per-call: observe() never throws on bad input. Bad FACTORY config (an invalid cap/threshold)
// throws at construction time — a build-time contract, same as wall.mjs's createWall.
export function createTetra({ maxDomains = 50, noveltyThreshold = 3 } = {}) {
  if (!Number.isInteger(maxDomains) || maxDomains < 1) throw new Error('maxDomains must be a positive integer');
  if (!Number.isInteger(noveltyThreshold) || noveltyThreshold < 1) throw new Error('noveltyThreshold must be a positive integer');

  const domains = new Map();  // signature -> {id, createdAt, members}
  const pending = new Map();  // signature -> sightings not yet at threshold

  // observe(signature, {existingDomains?, now?}) — one input's domain signature, plus the caller's
  // own view of what domains already exist elsewhere (crystal/dodeca's real known topics, say).
  function observe(signature, opts = {}) {
    if (typeof signature !== 'string' || !signature.trim()) return { ok: false, why: 'signature must be a non-empty string' };
    const existingDomains = opts && opts.existingDomains !== undefined ? opts.existingDomains : [];
    if (!Array.isArray(existingDomains)) return { ok: false, why: 'existingDomains must be an array' };
    const now = opts && opts.now !== undefined ? opts.now : Date.now();

    if (domains.has(signature) || existingDomains.includes(signature)) {
      if (domains.has(signature)) domains.get(signature).members += 1;
      return { ok: true, birthed: false, matched: true, domain: signature };
    }

    const seen = (pending.get(signature) || 0) + 1;
    pending.set(signature, seen);
    if (seen < noveltyThreshold) {
      return { ok: true, birthed: false, matched: false, domain: null, pendingCount: seen, thresholdNeeded: noveltyThreshold };
    }
    if (domains.size >= maxDomains) {
      return { ok: true, birthed: false, matched: false, domain: null, refused: 'at-capacity', capacity: maxDomains };
    }
    domains.set(signature, { id: signature, createdAt: now, members: 1 });
    pending.delete(signature);
    return { ok: true, birthed: true, matched: false, domain: signature, domainCount: domains.size };
  }

  return { observe, knownDomains: () => [...domains.keys()], domainCount: () => domains.size, getDomain: (signature) => domains.get(signature) || null };
}
