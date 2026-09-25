# kar-mind

**A persistent, autonomous cognitive stack that composes verified memory organs into one runnable system — and structurally cannot publish or spend.**

`kar-mind` wires a set of small, independently-gated memory organs into one mind: it perceives a fact,
cross-checks it against independent sources, consolidates it into meaning, generates new facts and
loops them back, and births new domains — through real organs, with every state change read from each
organ's own count. It remembers itself to a durable, receipt-sealed disk journal and comes back whole
after a restart. It runs its own loop on its own cadence, moving and persisting its state with no
caller per step. The one thing it deliberately cannot do on its own — publish or spend — is walled off
by construction.

Nothing here uses an LLM as a judge. Every check is deterministic and re-runnable.

## What it does

A fact flows through five organs (each a solid-shape name for a distinct job):

```
  a fact ──▶ CRYSTAL ──▶ (OCTA verify) ──▶ STRAND decision ──▶ DODECA (meaning)
   in        (facts)         │                                       ▲
                             │                                       │ loop closes
                        contradiction                            ICOSA (generate)
                        caught, held                                 ▲
                                                                  episodes in
             new domain? ──▶ TETRA (bounded birth)
             durable write? ──▶ EXPORT DOOR (consent gate + path wall)
```

- **crystal** — exact facts, no drift, no embeddings. A key can hold facts from many sources; a read
  never blends one source's value into another's.
- **octa** — verify. Cross-checks 3+ independent sources per field and refuses a panel of duplicate
  sources. A confidently-wrong single source is caught by disagreement with the others.
- **strand** — the movement law. Scores recall (decay × reinforcement), decides promote / hold / decay
  / expire, and performs the actual shelf transition.
- **dodeca** — meaning. Cosine-embedding retrieval; a strong fact genuinely crosses into it on promote.
- **icosa** — generate. A dream cycle infers new facts from repeated patterns, and the best of them
  loop back into crystal.
- **tetra** — birth. Detects a genuinely-new domain and births a bounded record (novelty threshold +
  hard capacity cap, both checked before any birth).

Plus the primitives (`consent-gate`, `wall`, `breach-harness`) and the deterministic output verifier
(`wisp-discriminator`).

`createMind()` composes all of them. `think(fact)` drives the whole cascade in one call and returns a
per-hop receipt read from real organ state. `snapshot()` reads real counts from each organ.

## Persistence — it survives a restart

Cognition is **event-sourced**: every state-changing verb records the event that caused it. `persist.mjs`
seals that log to disk with real gzip and a receipt hash over every field (tamper-refused on load), and
on boot `rebuildMind()` replays it through the real organs. Because the organs are deterministic given
their inputs, the rebuilt mind reaches **identical counts**. A brand-new process boots from the durable
file alone and comes back whole; a real wipe boots it genuinely empty. This is a write-ahead-log
persistence architecture.

## Autonomy — it runs its own loop

`run-loop.mjs` is the mind's own loop: from one `run()` call it pulls its own stimuli from a perception
source and drives the full cascade over and over, moving real organ state with no caller per step. It is
governed — a safety cap, and it stops on dead air rather than spinning. `runAutonomous()` adds a real
cadence and persists the mind each beat.

## The safety wall

The autonomous loop can perceive, verify, consolidate, dream, and route — all cognition, all reversible,
all inside the mind's own (walled) memory. It **cannot** publish, spend, or take any irreversible
outside-world action: `run-loop.mjs` imports no path to the export door — there is no publish verb and
no spend verb reachable from the loop, by construction. The export door itself stays doubly gated (a
consent id **and** a path wall). A test proves a full autonomous run stages no export and writes no file.

## Run it

The three memory organs it wires to are separate public repos. Clone them **as siblings** of `kar-mind`
(the `wire-*.mjs` import them by relative path), then run:

```bash
# layout: a parent dir containing kar-mind/ and its three sibling organs
git clone https://github.com/sjgant80-hub/kar-mind.git
git clone https://github.com/sjgant80-hub/fall-remember.git
git clone https://github.com/sjgant80-hub/the-dreamer.git
git clone https://github.com/sjgant80-hub/fallforgecell.git

cd kar-mind
node mind-autonomous-demo.mjs   # boot cold → run the loop → persist → restart from disk, state intact
node mind-demo.mjs              # drive the whole cascade once, watch real state move
node --test                    # the full gate suite
node eval-run.mjs              # a deterministic, no-LLM-judge eval vs a RAG baseline
```

Requires Node 18+ (uses the standard `CompressionStream` gzip and the built-in `node --test` runner; no
dependencies).

## Proof

Every organ is gated in isolation, and the composition is gated at its seams — a proven kernel proves
nothing about its wire, so the wires and the whole-system flow have their own tests:

- **149 tests, 0 failures** across the suite (crystal, strand, tetra, consent-gate, wall, the three
  wire edge-gates against the real organs, the integration gate, persistence, autonomy, and the
  restart-survival proof).
- The composition kernels (`mind.mjs`, `persist.mjs`, `run-loop.mjs`) pass a mutation gate clean
  (every injected mutant is caught by the tests).
- CI clones the three public organs and runs the gates green on GitHub's runner — the un-forgeable
  proof it works on a clean machine.

## Credits

This project composes and builds on others' work, credited in full:

- **Gary W. Floyd** — Lumiea Systems Research Division, ThunderStruck Service LLC. The distinct-tier
  memory architecture and the real `nexus_shortterm` schema (knowledge graph, chunk embeddings +
  content chunks, dream-space tiers, Dewey classification + routing rules, compositor outcomes,
  promotion candidates) from **NEXUS** (2026) and **Dream State Architecture** (2025) are the reference
  the durable, write-ahead-log persistence is shaped after, and the two recall thresholds in `strand.mjs`
  are his exact numbers.
- **Thomas Frumkin** — the **Konomi / MianoCube** architecture: the cube/database-split method ("the
  cube processes, the database persists") this stack forks from.

The composition, the recall-law curve, and the organ kernels are this project's own work. Built by
**karma-didy ("Kar")**.

## License

MIT — see [LICENSE](LICENSE).
