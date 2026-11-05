// tools/count-reporter.mjs — a node --test reporter that counts each test file's tests, passed and failed, as JSON.
// CI runs the whole suite once with it beside the usual reporter and uploads the counts, so the page's blueprint shows
// how many tests guard each file from what GitHub's runner counted (tools/gate-receipt.mjs), never a typed number.
//   node --test --test-reporter=spec --test-reporter-destination=stdout \
//               --test-reporter=./tools/count-reporter.mjs --test-reporter-destination=../test-counts.json
import { relative, sep } from 'node:path';

export default async function* countReporter(source) {
  const files = {};
  let pass = 0, fail = 0;
  for await (const ev of source) {
    if (ev.type !== 'test:pass' && ev.type !== 'test:fail') continue;
    const d = ev.data || {};
    if (d.nesting !== 0 || !d.file || (d.details && d.details.type === 'suite')) continue;
    const f = relative(process.cwd(), d.file).split(sep).join('/');
    const c = files[f] || (files[f] = { pass: 0, fail: 0 });
    if (ev.type === 'test:pass') { c.pass++; pass++; } else { c.fail++; fail++; }
  }
  const sorted = Object.fromEntries(Object.keys(files).sort().map((k) => [k, files[k]]));
  yield JSON.stringify({ kind: 'kar-mind.test-counts', v: 1, node: process.version, pass, fail, files: sorted }, null, 1) + '\n';
}
