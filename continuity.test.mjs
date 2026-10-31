import { test } from 'node:test';
import assert from 'node:assert/strict';
import C, { DAY, days, lastBy, daysBetween, asks, addKar, surface } from './continuity.mjs';

const LOG = [
  '# STATUS — the running log (newest first)',
  '',
  'Grok writes one dated line; Kar logs what went live.',
  '',
  '---',
  '',
  '## 2026-10-30',
  '',
  '- **Grok (30 Oct daily report):** Posted six slots. Requests for Kar: reader drops a line; a red test is open.',
  '',
  '## 2026-10-29',
  '',
  '- **Grok (29 Oct daily report):** Posted six. Requests for Kar: reader drops a line; a red test is open.',
  '- **Grok weekly review:** Followers are bait. **Request for Kar:** shape next week\'s posts. Open items checked live.',
  '',
  '## 2026-10-12',
  '',
  '- **Kar — organ 5 DONE:** the forge is live.',
  '  - Next: organ 6.',
  '- **Simon:** looks good.',
  '',
  '## 2026-10-10',
  '',
  '- **Kar:** created this repo.',
  'not an entry line',
].join('\n');

test('the default export and the day heading', () => {
  assert.deepEqual(Object.keys(C).sort(), ['DAY', 'addKar', 'asks', 'days', 'daysBetween', 'lastBy', 'surface']);
  assert.ok(DAY.test('## 2026-10-30')); assert.ok(DAY.test('## 2026-10-30  ')); assert.ok(!DAY.test('## 26-10-30')); assert.ok(!DAY.test('### 2026-10-30')); assert.ok(!DAY.test('x## 2026-10-30'));
});

test('days: headings, entries by who, continuation lines joined; text before the first day ignored', () => {
  const ds = days(LOG);
  assert.deepEqual(ds.map((d) => d.date), ['2026-10-30', '2026-10-29', '2026-10-12', '2026-10-10']);
  assert.deepEqual(ds.map((d) => d.entries.map((e) => e.who)), [['Grok'], ['Grok', 'Grok'], ['Kar', 'Simon'], ['Kar']]);
  assert.equal(ds[2].entries[0].text, '**Kar — organ 5 DONE:** the forge is live. - Next: organ 6.');
  assert.equal(ds[3].entries[0].text, '**Kar:** created this repo.');
  assert.deepEqual(days('## 2026-01-02\r\n- **Kar:** a\r\n  b'), [{ date: '2026-01-02', entries: [{ who: 'Kar', text: '**Kar:** a b' }] }]);
  assert.deepEqual(days('- **Kar:** before any day\n## 2026-01-02\n  orphan continuation\n-**Kar:** no space'), [{ date: '2026-01-02', entries: [] }]);
  for (const g of [null, undefined, 7, {}, '']) assert.deepEqual(days(g), []);
});

test('lastBy: the newest date someone wrote', () => {
  const ds = days(LOG);
  assert.equal(lastBy(ds, 'Grok'), '2026-10-30'); assert.equal(lastBy(ds, 'Kar'), '2026-10-12'); assert.equal(lastBy(ds, 'Simon'), '2026-10-12');
  assert.equal(lastBy(ds, 'Nobody'), null);
  for (const g of [null, 'x', [null, { date: 'd' }, { date: 'e', entries: [null] }]]) assert.equal(lastBy(g, 'Kar'), null);
});

test('daysBetween: whole days, null on anything not a date', () => {
  assert.equal(daysBetween('2026-10-12', '2026-10-31'), 19); assert.equal(daysBetween('2026-10-31', '2026-10-31'), 0);
  assert.equal(daysBetween('2026-10-31', '2026-10-30'), -1); assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  for (const [a, b] of [['2026-10-1', '2026-10-31'], ['x', '2026-10-31'], [null, '2026-10-31'], ['2026-10-31', undefined], ['2026-13-45', '2026-10-31']]) assert.equal(daysBetween(a, b), null);
});

test('asks: each Grok entry\'s request clause, newest first, repeats dropped, at most n', () => {
  const ds = days(LOG);
  assert.deepEqual(asks(ds), [
    { date: '2026-10-30', say: 'reader drops a line; a red test is open.' },
    { date: '2026-10-29', say: 'shape next week\'s posts. Open items checked live.' },
  ]);
  assert.deepEqual(asks(ds, 1), [{ date: '2026-10-30', say: 'reader drops a line; a red test is open.' }]);
  assert.deepEqual(asks(ds, 0), []); assert.deepEqual(asks(ds, -2), []);
  assert.deepEqual(asks(days('## 2026-01-01\n- **Kar:** Requests for Kar: not from Grok\n- **Grok:** Requests for Kar:   \n- **Grok:** nothing asked')), []);
  const many = days(['## 2026-01-03', '- **Grok:** Requests for Kar: a', '## 2026-01-02', '- **Grok:** Requests for Kar: b', '## 2026-01-01', '- **Grok:** requests for kar: c', '- **Grok:** Requests for Kar: d'].join('\n'));
  assert.deepEqual(asks(many).map((x) => x.say), ['a', 'b', 'c']); assert.deepEqual(asks(many, 4).map((x) => x.say), ['a', 'b', 'c', 'd']);
  for (const g of [null, 'x', [null, { entries: 'x' }, { date: 'd', entries: [null, { who: 'Grok', text: 7 }] }]]) assert.deepEqual(asks(g), []);
  const repeats = days(['## 2026-01-04', '- **Grok:** Requests for Kar: the reader drops a line (fourth day running); a red test.',
    '## 2026-01-03', '- **Grok:** Requests for Kar: The reader  drops a line (third day running); a red test.',
    '## 2026-01-02', '- **Grok:** Requests for Kar: none new beyond the red test.', '- **Grok:** Requests for Kar: Nonetheless, fix the page.',
    '## 2026-01-01', '- **Grok:** Requests for Kar: NONE today.'].join('\n'));
  assert.deepEqual(asks(repeats), [{ date: '2026-01-04', say: 'the reader drops a line (fourth day running); a red test.' }, { date: '2026-01-02', say: 'Nonetheless, fix the page.' }]);
});

test('addKar: under today\'s heading if it exists, else a new heading above the newest day', () => {
  const same = addKar(LOG, '2026-10-30', '  shipped   the kit \n live ');
  assert.ok(same.includes('## 2026-10-30\n\n- **Kar:** shipped the kit live\n\n- **Grok (30 Oct'));
  assert.equal(days(same)[0].entries[0].who, 'Kar'); assert.equal(lastBy(days(same), 'Kar'), '2026-10-30');
  const fresh = addKar(LOG, '2026-10-31', 'bred-minds is live');
  assert.ok(fresh.includes('---\n\n## 2026-10-31\n\n- **Kar:** bred-minds is live\n\n## 2026-10-30'));
  assert.deepEqual(days(fresh).map((d) => d.date).slice(0, 2), ['2026-10-31', '2026-10-30']);
  assert.equal(fresh.split('\n').length, LOG.split('\n').length + 4);
  assert.equal(addKar('# empty log\n\n', '2026-10-31', 'first'), '# empty log\n\n## 2026-10-31\n\n- **Kar:** first\n');
  assert.equal(addKar('', '2026-10-31', 'first'), '\n\n## 2026-10-31\n\n- **Kar:** first\n');
  for (const [d, t] of [['2026-10-3', 'x'], ['x', 'x'], [null, 'x'], ['2026-10-31', '   '], ['2026-10-31', null], ['2026-10-31', 7]]) assert.equal(addKar(LOG, d, t), LOG);
  assert.equal(addKar(null, null, null), '');
  assert.equal(addKar('## 2026-10-31\n\n- **Grok:** x', '2026-10-31', 'k'), '## 2026-10-31\n\n- **Kar:** k\n\n- **Grok:** x');
  assert.equal(addKar('## 2026-10-30\n- **Grok:** x', '2026-10-31', 'k'), '## 2026-10-31\n\n- **Kar:** k\n\n## 2026-10-30\n- **Grok:** x');
});

test('surface: the latest report, the asks, and a loud line when Kar has gone quiet', () => {
  const s = surface(LOG, '2026-10-31');
  assert.deepEqual(s.split('\n'), [
    '── GROK → KAR · the shared STATUS.md ──',
    'Grok\'s latest report (2026-10-30): **Grok (30 Oct daily report):** Posted six slots. Requests for Kar: reader drops a line; a red test is open.',
    'Grok has asked Kar (answer these in STATUS.md):',
    '• 2026-10-30: reader drops a line; a red test is open.',
    '• 2026-10-29: shape next week\'s posts. Open items checked live.',
    '⚠ Kar last wrote to STATUS.md on 2026-10-12, 19 days ago: log what went live (node kar-mind/tools/kar-status.mjs "…").',
  ]);
  assert.ok(surface(LOG, '2026-10-14').endsWith('on 2026-10-12, 2 days ago: log what went live (node kar-mind/tools/kar-status.mjs "…").'));
  assert.ok(surface(LOG, '2026-10-13').endsWith('Kar last wrote to STATUS.md on 2026-10-12.'));
  assert.ok(surface(addKar(LOG, '2026-10-31', 'x'), '2026-10-31').endsWith('Kar last wrote to STATUS.md on 2026-10-31.'));
  const short = surface(LOG, '2026-10-31', 20);
  assert.ok(short.includes('(2026-10-30): **Grok (30 Oct dail…\n')); assert.ok(short.includes('• 2026-10-30: reader drops a line…\n'));
  assert.ok(surface(LOG, '2026-10-31', 200).includes('(2026-10-30): **Grok (30 Oct daily report):** Posted six slots. Requests for Kar: reader drops a line; a red test is open.\n'));
  const exact = '**Grok:** twelve chars';
  assert.ok(surface('## 2026-10-30\n- ' + exact, '2026-10-31', exact.length).includes('(2026-10-30): ' + exact + '\n'));
  assert.ok(surface('## 2026-10-30\n- ' + exact, '2026-10-31', exact.length - 1).includes('(2026-10-30): ' + exact.slice(0, exact.length - 2) + '…\n'));
  const quiet = surface('## 2026-10-30\n- **Grok:** posted.', '2026-10-31').split('\n');
  assert.deepEqual(quiet, ['── GROK → KAR · the shared STATUS.md ──', 'Grok\'s latest report (2026-10-30): **Grok:** posted.', '⚠ Kar has never written to STATUS.md.']);
  assert.deepEqual(surface('## 2026-10-30\n- **Kar:** shipped.', '2026-10-30').split('\n'), ['── GROK → KAR · the shared STATUS.md ──', 'Kar last wrote to STATUS.md on 2026-10-30.']);
  assert.ok(surface('## 2026-10-30\n- **Kar:** shipped.', 'garbage').endsWith('Kar last wrote to STATUS.md on 2026-10-30.'));
  for (const g of [null, '', '## 2026-10-30\n- **Simon:** hi', 7]) assert.equal(surface(g, '2026-10-31'), '');
});
