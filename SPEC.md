# kar-mind — specification

## Purpose

A persistent, autonomous cognitive stack that composes verified memory organs into one runnable system, and keeps an
agent's working memory in its sealed journal — and structurally cannot publish or spend.

## Surface

- **mind.mjs** — `createMind`, `rebuildMind`, `verifyManifest`, `ORGANS`, `SOLIDS`: the composed system (perceive,
  verify, consolidate, dream, route, think; the export door behind consent and a path wall).
- **persist.mjs** — `createJournal({ dir, roots })`: the sealed gzip event journal, walled to its roots.
- **mind-persistent.mjs** — `bootMind`, `persistMind`, `runAutonomous`: boot from the journal, persist, run the loop.
- **run-loop.mjs** — `createRunLoop`, `queueSource`: the governed autonomous loop (no export, money or publish path).
- **brain.mjs** — the brain's law: memory files, asks and the build queue as journal facts; only what changed is
  written; the digest a session starts from; the next build in the owner's approved order; the decisions only the
  owner makes; the sealed measurement's grader.
- **brain-cli.mjs** — the brain's glue: `ingest`, `readDigest`, `open`, and the CLI (ingest, digest, next, decisions,
  done, status). It writes only under its brain directory.
- The organ kernels (`crystal`, `strand`, `tetra`, `wire-*`, `consent-gate`, `wall`, `wisp-discriminator`,
  `breach-harness`) are each gated by their own tests.

`examples/` holds the demos and `tools/` the eval, the brain's sealed measurement and the page builder; they are run,
not imported, and sit outside the gated surface.

## Guarantees

- Pure kernels are total: bad input returns `{ ok:false, why }` (or an empty value), never a throw. The glue
  (`brain-cli.mjs`, `mind-persistent.mjs`) reports a failed journal read or write as an error rather than booting a
  damaged mind silently.
- No runtime dependencies; the sibling organs (fall-remember, the-dreamer, fallforgecell) are imported by path.
- Nothing here can publish or spend: no module in the loop holds a network, publish or money verb.
