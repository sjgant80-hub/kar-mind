// gatereceipt.mjs — the gate receipt: what GitHub's runner said about every kernel of kar-mind, kept so the page's
// blueprint shows each file's mutation-gate result and test count from the run itself, never a typed number.
// CI runs the witness gate (pinned v0.6) on every root module, one job each, and uploads each verdict; the gate suite
// uploads how many tests passed in each test file (tools/count-reporter.mjs). tools/gate-receipt.mjs --from <the
// downloaded artifacts> reads them and calls build(); --check (run in CI) calls check() against the workflow's own
// matrix and the files as they are now, so a kernel added to the gate but missing from the receipt is refused, and a
// kernel changed since the run is named as changed (its next run is the gate) rather than shown as still measured.
// Pure, total, deterministic: garbage in gives { ok: false, why }, never a throw. The file glue is the tool's.

export const KIND = 'kar-mind.gate-receipt';
export const COUNTS = 'kar-mind.test-counts';
const SHA = /^[0-9a-f]{40}$/, HEX64 = /^[0-9a-f]{64}$/, RUN = /^\d+$/;
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const isCount = (x) => Number.isSafeInteger(x) && x >= 0;
const isBool = (x) => typeof x === 'boolean';
const isFile = (s) => typeof s === 'string' && /^[A-Za-z0-9._/-]+\.mjs$/.test(s);
const all = (o, spec) => isObj(o) && Object.entries(spec).every(([k, f]) => f(o[k]));
const n = (o, k) => (isObj(o) && isCount(o[k]) ? o[k] : 0);

const VERDICT = { total: isCount, killed: isCount, survived: Array.isArray, ignored: Array.isArray, capped: isBool, clean: isBool };
const ARTIFACT = { kernel: isFile, tests: Array.isArray, sha: (s) => SHA.test(String(s)), run: (s) => RUN.test(String(s)), verdict: (v) => all(v, VERDICT) };
const TESTS = { kind: (k) => k === COUNTS, pass: isCount, fail: isCount, files: isObj };
const RECEIPT = { kind: (k) => k === KIND, v: (x) => x === 1, sha: (s) => SHA.test(String(s)), kernels: Array.isArray, totals: isObj };

/** the witness matrix of the workflow: each `- { kernel: x.mjs, tests: "a.test.mjs b.test.mjs" … }` line, in order */
export function matrixOf(yml) {
  const out = [];
  for (const line of String(typeof yml === 'string' ? yml : '').split(/\r?\n/)) {
    const m = /^\s*- \{ kernel: ([^,\s]+), tests: "([^"]*)"/.exec(line);
    if (m && isFile(m[1])) out.push({ kernel: m[1], tests: m[2].split(/\s+/).filter(Boolean) });
  }
  return out;
}

/** the receipt from the run's artifacts. input: { verdicts: [uploaded verdicts], counts: the test-counts upload, matrix,
 *  hashes: { kernel file: its SHA-256 at the run's commit }, witness: the gate's pinned tag }
 *  → { ok: true, receipt } | { ok: false, why } */
export function build(input) {
  try {
    const i = isObj(input) ? input : {};
    const matrix = Array.isArray(i.matrix) ? i.matrix : [];
    if (matrix.length === 0) return { ok: false, why: 'the workflow names no kernels' };
    const vs = Array.isArray(i.verdicts) ? i.verdicts : [];
    if (!vs.every((a) => all(a, ARTIFACT))) return { ok: false, why: 'a verdict the runner did not finish' };
    const c = i.counts;
    if (!all(c, TESTS)) return { ok: false, why: 'no test counts from the gate suite' };
    const sha = vs.length ? vs[0].sha : '', run = vs.length ? String(vs[0].run) : '';
    if (vs.some((a) => a.sha !== sha || String(a.run) !== run)) return { ok: false, why: 'the verdicts come from more than one run' };
    const hashes = isObj(i.hashes) ? i.hashes : {};
    const kernels = [];
    for (const m of matrix) {
      const mine = vs.filter((a) => a.kernel === m.kernel);
      if (mine.length !== 1) return { ok: false, why: m.kernel + ': ' + (mine.length ? 'more than one verdict' : 'no verdict') };
      if (!HEX64.test(String(hashes[m.kernel]))) return { ok: false, why: m.kernel + ': no hash at the run’s commit' };
      const v = mine[0].verdict;
      kernels.push({
        kernel: m.kernel, sha256: hashes[m.kernel], mutants: v.total, caught: v.killed, survived: v.survived.length, ignored: v.ignored.length, capped: v.capped, clean: v.clean,
        tests: m.tests.map((t) => ({ file: t, pass: n(c.files[t], 'pass'), fail: n(c.files[t], 'fail') })),
      });
    }
    if (vs.length !== kernels.length) return { ok: false, why: 'a verdict for a kernel the workflow does not name' };
    const sum = (k) => kernels.reduce((a, x) => a + x[k], 0);
    return {
      ok: true,
      receipt: {
        kind: KIND, v: 1, sha, run, witness: typeof i.witness === 'string' ? i.witness : '', node: typeof c.node === 'string' ? c.node : '',
        totals: { kernels: kernels.length, mutants: sum('mutants'), caught: sum('caught'), survived: sum('survived'), ignored: sum('ignored'), clean: kernels.every((k) => k.clean && !k.capped && k.survived === 0), testsPassed: c.pass, testsFailed: c.fail },
        kernels,
      },
    };
  } catch { return { ok: false, why: 'the artifacts could not be read' }; }
}

/** the receipt against the workflow and the files as they are now. hashes: { kernel file: its SHA-256 now }
 *  → { ok, why, rows: [{ ...kernel, current }], changed: [files changed since the run] } */
export function check(receipt, matrix, hashes) {
  try {
    if (!all(receipt, RECEIPT)) return { ok: false, why: 'not a gate receipt', rows: [], changed: [] };
    const named = (Array.isArray(matrix) ? matrix : []).map((x) => x.kernel), have = receipt.kernels.map((k) => (isObj(k) ? k.kernel : '(not a kernel)'));
    const missing = named.filter((k) => !have.includes(k)), extra = have.filter((k) => !named.includes(k));
    if (missing.length) return { ok: false, why: 'gated but not in the receipt: ' + missing.join(', '), rows: [], changed: [] };
    if (extra.length) return { ok: false, why: 'in the receipt but no longer gated: ' + extra.join(', '), rows: [], changed: [] };
    const h = isObj(hashes) ? hashes : {};
    const rows = receipt.kernels.map((k) => ({ ...k, current: h[k.kernel] === k.sha256 }));
    const changed = rows.filter((x) => !x.current).map((x) => x.kernel);
    return { ok: true, why: changed.length ? 'changed since the run: ' + changed.join(', ') : 'every kernel is as the run measured it', rows, changed };
  } catch { return { ok: false, why: 'the receipt could not be read', rows: [], changed: [] }; }
}

export default { KIND, COUNTS, matrixOf, build, check };
