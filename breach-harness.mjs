#!/usr/bin/env node
// breach-harness.mjs — the PASS/FAIL/summary shape, extracted from THREE real, independent
// implementations (breach-test.mjs, breach-test-write.mjs, breach-test-cockpit-wire.mjs — the
// strongest extraction claim of any primitive yet: three, not two). Ground truth checked before
// building this: the first two share one calling convention (`check(label, got, wantOk)` — derive
// a boolean from a {ok} result object), the third uses a different one (`check(label, cond)` — the
// caller already has a raw boolean). Real difference, not cosmetic — this primitive serves both
// honestly instead of forcing one shape onto the other.
//
// Deliberately does NOT call process.exit itself — that is the top-level script's own decision to
// own (and makes this actually unit-testable: a harness that exits the process can't be tested
// in-process). `log` is injectable, same idiom as consent-gate.mjs's injectable clock — no console
// noise required to prove the counting logic is right.
export function createHarness({ label, log = console.log } = {}) {
  if (typeof label !== 'string' || !label.trim()) throw new Error('createHarness requires a label');
  let pass = 0, fail = 0;

  // check(desc, cond, detail?) — the raw-boolean form (breach-test-cockpit-wire.mjs's shape).
  function check(desc, cond, detail) {
    const ok = !!cond;
    log((ok ? 'PASS' : '*** FAIL ***') + '  ' + desc + (detail === undefined ? '' : '  ->  ' + detail));
    if (ok) pass++; else fail++;
    return ok;
  }

  // checkResult(desc, got, wantOk) — the result-object form (breach-test.mjs / breach-test-write.mjs's
  // shape): got is a {ok:boolean,...} tool result, wantOk is whether ok:true was expected.
  function checkResult(desc, got, wantOk) {
    const cond = (got && got.ok === true) === wantOk;
    return check(desc, cond, JSON.stringify(got).slice(0, 200));
  }

  // summary(verb) — prints the closing line and returns the real numbers, never exits the process.
  function summary(verb = 'HOLDS') {
    const total = pass + fail;
    const clean = fail === 0;
    log('\n=== ' + label + ' RESULT: ' + pass + ' held / ' + total + ' total — ' + (clean ? verb : (fail + ' BREACH(ES) FOUND')) + ' ===');
    return { pass, fail, total, clean };
  }

  function counts() { return { pass, fail, total: pass + fail }; }

  return { check, checkResult, summary, counts };
}
