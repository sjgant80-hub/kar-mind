# kar-mind — specification

## Purpose

A persistent, autonomous cognitive stack that composes verified memory organs into one runnable system, and keeps an agent's working memory in its sealed journal — and structurally cannot publish or spend.

## Contract

- **ingest** — part of the kar-mind public surface; deterministic, total (never throws).
- **open** — part of the kar-mind public surface; deterministic, total (never throws).
- **readDigest** — part of the kar-mind public surface; deterministic, total (never throws).

## Guarantees

- **Deterministic** — the same input yields the same output on any machine, any run.
- **Total** — hostile or malformed input returns a defined value, never an exception.
- **Zero-dependency** — no third-party runtime code inside the trust boundary.

## Verification

The suite exercises the public surface directly and is mutation-checked: a change to any guarded line makes a
test fail. konomify admits kar-mind only when both the structure rubric (acg-assessor) and the behaviour gate
(witness) pass.
