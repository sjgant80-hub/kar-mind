# kar-mind — agent instructions

A persistent, autonomous cognitive stack that composes verified memory organs into one runnable system, and keeps an agent's working memory in its sealed journal — and structurally cannot publish or spend.

## Boundaries

- Keep kar-mind zero-dependency and deterministic. Do not add runtime dependencies.
- Every change to a source line must be covered by a test that fails when the line changes (witness gate).
- Do not skip, disable, or weaken a test to make the suite green. Fix the code or the test's premise.
- Structure and behaviour are gated by konomify; a change ships only when it stays konomified.
