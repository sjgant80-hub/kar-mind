# kar-mind — specification

## Purpose

A persistent, autonomous cognitive stack that composes verified memory organs into one runnable system, and keeps an
agent's working memory in its sealed journal — and structurally cannot publish or spend.

## Surface

- **mind.mjs** — `createMind`, `rebuildMind`, `verifyManifest`, `ORGANS`, `SOLIDS`: the composed system (perceive,
  verify, consolidate, dream, route, think; the export door behind consent and a path wall).
- **persist.mjs** — `createJournal({ dir, roots })`: the sealed event journal, one LIGHT vault with the SHA-256 of its
  events inside, walled to its roots; a journal written before LIGHT (gzip with a receipt hash) still loads and migrates.
- **mind-persistent.mjs** — `bootMind`, `persistMind`, `runAutonomous`: boot from the journal, persist, run the loop.
- **run-loop.mjs** — `createRunLoop`, `queueSource`: the governed autonomous loop (no export, money or publish path).
- **brain.mjs** — the brain's law: memory files, asks and the build queue as journal facts; only what changed is
  written; the digest a session starts from; the next build in the owner's approved order; the decisions only the
  owner makes; the sealed measurement's grader.
- **brain-cli.mjs** — the brain's glue: `ingest`, `readDigest`, `open`, and the CLI (ingest, digest, next, decisions,
  done, status). It writes only under its brain directory.
- **controller.mjs** — the controller's law: `route` (which mind each job goes to, by its first verb), the nightly wallet
  (`nightOf`, `walletFor`, `reserve`), the frontier call (`cortexArgs`, `cleanEnv`, `readReply`), the nightly idea and its
  five checks, and the cost case (`costCase`, `wallCap`, `wallCase`).
- **callbook.mjs** — every model call the controller makes, kept append-only in LIGHT.
- **continuity.mjs** — the line to Grok: `surface` (the session-start summary of the shared status log) and `addKar`.
- **businesscase.mjs** — the page's cost case, from the vendored, sourced basis.
- **gatereceipt.mjs** — the gate receipt: GitHub's witness verdicts and test counts, checked against the workflow.
- **pattern.mjs**, **watch.mjs**, **layout.mjs**, **seedcodec.mjs** — the owner's pattern, Kar's playbook of his own
  misses, the digest re-laid for a small model, and the seed's codec, each with its sealed measurement in `data/`.
- The organ kernels (`crystal`, `strand`, `tetra`, `wire-*`, `consent-gate`, `wall`, `wisp-discriminator`,
  `breach-harness`) are each gated by their own tests. Every root module is under the witness mutation gate in CI.

`examples/` holds the demos and `tools/` the eval, the brain's sealed measurement and the page builder; they are run,
not imported, and sit outside the gated surface.

## Guarantees

- Pure kernels are total: bad input returns `{ ok:false, why }` (or an empty value), never a throw. The glue
  (`brain-cli.mjs`, `mind-persistent.mjs`) reports a failed journal read or write as an error rather than booting a
  damaged mind silently.
- No runtime dependencies; the sibling organs (fall-remember, the-dreamer, fallforgecell) are imported by path.
- Nothing here can publish or spend: no module in the loop holds a network, publish or money verb.
