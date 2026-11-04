// the cost case on the page: every figure from the sourced basis (vendored byte for byte), floors not top ends, like for
// like, only the judgement share on the frontier, never a throw
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import C, { DEFAULTS, BASIS_KEYS, sourcesOf, over, businessCase } from './businesscase.mjs';

const RAW = readFileSync(new URL('./vendor/sovereign-enterprise/data/basis.json', import.meta.url));
const BASIS = JSON.parse(RAW.toString('utf8'));
const base = (patch) => ({ ...BASIS, ...patch });
const r2 = (x) => Math.round(x * 100) / 100;

test('the basis is vendored byte for byte: its SHA-256 is the pin, and the pin names its public origin', () => {
  const pin = JSON.parse(readFileSync(new URL('./vendor/sovereign-enterprise/SOURCE.json', import.meta.url), 'utf8'));
  assert.equal(pin.repo, 'sjgant80-hub/sovereign-enterprise');
  assert.match(pin.commit, /^[0-9a-f]{40}$/);
  assert.equal(pin.files.length, 1);
  assert.equal(pin.files[0].path, 'vendor/sovereign-enterprise/data/basis.json');
  assert.equal(createHash('sha256').update(RAW).digest('hex'), pin.files[0].sha256);
  assert.equal(pin.files[0].sha256, '83e9c2effa2f81596dcfa7110f030940032c1910cdf928d27d628ae59d73bb42');
});

test('the default export carries the whole surface', () => {
  assert.deepEqual(Object.keys(C).sort(), ['BASIS_KEYS', 'DEFAULTS', 'businessCase', 'over', 'sourcesOf']);
  assert.ok(Object.isFrozen(DEFAULTS) && Object.isFrozen(BASIS_KEYS));
});

test('businessCase · the default case, every line from the sourced basis, checked by hand', () => {
  const r = businessCase(BASIS, {});
  assert.equal(r.ok, true);
  assert.deepEqual(r.inputs, DEFAULTS);
  // 20 h × 52 × £19.67 (ONS median) · half of it · 5 seats × 12 × £23.10 (Copilot) · 500 jobs × 52 × (1500 × $2 + 300 × $10) / 1e6 × 0.75396
  // · half of that on the frontier · 15 W × 8760 h / 1000 × 24.51p
  assert.deepEqual(r.lines, { staff: 20456.8, takenOff: 10228.4, seats: 1386, api: 117.62, judgement: 58.81, power: 32.21 });
  assert.deepEqual(r.perYear, { today: 20456.8, rentSeats: 21842.8, cloudApi: 10346.02, own: 10319.42 });
  assert.deepEqual(r.over, { today: 63292.54, rentSeats: 67580.77, cloudApi: 32010.18, own: 31927.88 });
  assert.deepEqual([r.savingPerYear, r.savingOver, r.versusCloudOver], [10137.38, 31364.66, 82.3]);
});

test('businessCase · like for like: seats take nothing off; cloud and owned take the same share off; only judgement reaches the frontier', () => {
  const r = businessCase(BASIS, { share: 0.8, seats: 2, jobsPerWeek: 1000, tokensIn: 2000, tokensOut: 500, judgementShare: 0.25 });
  assert.equal(r.perYear.rentSeats, r2(r.lines.staff + r.lines.seats));
  assert.equal(r.perYear.cloudApi, r2(r.lines.staff - r.lines.takenOff + r.lines.api));
  assert.equal(r.perYear.own, r2(r.lines.staff - r.lines.takenOff + r.lines.judgement + r.lines.power));
  assert.equal(r.lines.takenOff, r2(r.lines.staff * 0.8));
  assert.equal(r.lines.seats, r2(2 * 12 * BASIS['seat.copilot'].value));
  assert.equal(r.lines.judgement, r2(r.lines.api * 0.25));
  assert.equal(r.savingPerYear, r2(r.perYear.today - r.perYear.own));
  assert.equal(r.savingOver, r2(r.over.today - r.over.own));
  assert.equal(r.versusCloudOver, r2(r.over.cloudApi - r.over.own));
  // every job judgement: the owned route pays the whole API bill, plus its power
  const all = businessCase(BASIS, { judgementShare: 1 });
  assert.equal(all.lines.judgement, all.lines.api);
  assert.equal(all.perYear.own, r2(all.perYear.cloudApi + all.lines.power));
  // no judgement: nothing reaches the frontier
  assert.equal(businessCase(BASIS, { judgementShare: 0 }).lines.judgement, 0);
});

test('businessCase · the figures move with the basis, not with anything typed', () => {
  const dear = businessCase(base({ wageMedianHourly: { ...BASIS.wageMedianHourly, value: 30 } }), {});
  assert.equal(dear.lines.staff, 20 * 52 * 30);
  const cheapPower = businessCase(base({ electricityPencePerKwh: { ...BASIS.electricityPencePerKwh, value: 10 } }), {});
  assert.equal(cheapPower.lines.power, r2(15 * 8760 / 1000 * 10 / 100));
  const watts = businessCase(base({ laptopExtraWatts: { ...BASIS.laptopExtraWatts, value: 30 } }), {});
  assert.equal(watts.lines.power, r2(30 * 8760 / 1000 * 24.51 / 100));
  const hours = businessCase(base({ hoursPerYear: { value: 1000 } }), {});
  assert.equal(hours.lines.power, r2(15 * 1000 / 1000 * 24.51 / 100));
  const fx = businessCase(base({ fxGbpPerUsd: { ...BASIS.fxGbpPerUsd, value: 1 } }), {});
  assert.equal(fx.lines.api, r2(500 * 52 * (1500 * 2 + 300 * 10) / 1e6));
  const api = businessCase(base({ frontier: { ...BASIS.frontier, inPerM: 4, outPerM: 0 } }), {});
  assert.equal(api.lines.api, r2(500 * 52 * (1500 * 4) / 1e6 * 0.75396));
  const seat = businessCase(base({ 'seat.copilot': { ...BASIS['seat.copilot'], value: 10 } }), {});
  assert.equal(seat.lines.seats, 5 * 12 * 10);
  const cpi = businessCase(base({ cpi: { ...BASIS.cpi, value: 0 } }), {});
  assert.equal(cpi.over.today, r2(20456.8 * 3));
});

test('businessCase · boundaries hold at both ends of every input', () => {
  for (const ok of [{ hoursPerWeek: 0 }, { hoursPerWeek: 168 }, { share: 0 }, { share: 1 }, { seats: 0 }, { years: 1 }, { years: 10 },
    { jobsPerWeek: 0, tokensIn: 0, tokensOut: 0 }, { judgementShare: 0 }, { judgementShare: 1 }]) assert.equal(businessCase(BASIS, ok).ok, true, JSON.stringify(ok));
  const all = businessCase(BASIS, { share: 1, judgementShare: 0 });
  assert.equal(all.perYear.own, all.lines.power);
  assert.equal(businessCase(BASIS, { share: 0, judgementShare: 0 }).savingPerYear, -32.21);
  assert.equal(businessCase(BASIS, { years: 1 }).over.today, 20456.8);
  assert.equal(businessCase(BASIS, { years: 10 }).inputs.years, 10);
});

test('businessCase · each bad input refused with its reason', () => {
  const why = (i) => businessCase(BASIS, i).why;
  assert.equal(why({ hoursPerWeek: 168.5 }), 'hours a week: 0 to 168');
  assert.equal(why({ hoursPerWeek: -1 }), 'hours a week: 0 to 168');
  assert.equal(why({ hoursPerWeek: '20' }), 'hours a week: 0 to 168');
  assert.equal(why({ share: 1.01 }), 'the share of the work taken off: 0 to 1');
  assert.equal(why({ share: -0.1 }), 'the share of the work taken off: 0 to 1');
  assert.equal(why({ seats: 2.5 }), 'seats: a whole number');
  assert.equal(why({ seats: -1 }), 'seats: a whole number');
  assert.equal(why({ jobsPerWeek: -1 }), 'jobs and tokens: numbers');
  assert.equal(why({ tokensIn: NaN }), 'jobs and tokens: numbers');
  assert.equal(why({ tokensOut: 'x' }), 'jobs and tokens: numbers');
  assert.equal(why({ judgementShare: 1.01 }), 'the judgement share: 0 to 1');
  assert.equal(why({ judgementShare: -0.5 }), 'the judgement share: 0 to 1');
  assert.equal(why({ judgementShare: '0.5' }), 'the judgement share: 0 to 1');
  assert.equal(why({ years: 0 }), 'years: 1 to 10');
  assert.equal(why({ years: 11 }), 'years: 1 to 10');
  assert.equal(why({ years: 2.5 }), 'years: 1 to 10');
});

test('businessCase · refuses a basis missing any figure it reads', () => {
  const refused = { ok: false, why: 'a sourced basis with every figure the case reads' };
  assert.deepEqual(businessCase(null, {}), refused);
  assert.deepEqual(businessCase(undefined, {}), refused);
  for (const k of BASIS_KEYS) { const b = { ...BASIS }; delete b[k]; assert.deepEqual(businessCase(b, {}), refused, k); }
  assert.deepEqual(businessCase(base({ cpi: { value: -0.1 } }), {}), refused);
  assert.deepEqual(businessCase(base({ cpi: { value: Infinity } }), {}), refused);
  assert.deepEqual(businessCase(base({ frontier: { inPerM: 2 } }), {}), refused);
  assert.deepEqual(businessCase(base({ wageMedianHourly: { value: '19.67' } }), {}), refused);
});

test('over · CPI on every year after the first, compounding', () => {
  assert.equal(over(100, 0.1, 1), 100);
  assert.equal(over(100, 0.1, 2), 210);
  assert.equal(over(100, 0.1, 3), 331);
  assert.equal(over(100, 0, 4), 400);
  assert.equal(over(100, 0.1, 0), 0);
  assert.equal(over(1.006, 0, 1), 1.01);
});

test('sourcesOf · every figure the case reads, with what it is and where it came from', () => {
  const s = sourcesOf(BASIS);
  assert.deepEqual(s.map((x) => x.key), [...BASIS_KEYS]);
  assert.match(s.find((x) => x.key === 'wageMedianHourly').source, /^https:\/\/www\.ons\.gov\.uk\//);
  assert.equal(s.find((x) => x.key === 'wageMedianHourly').what, BASIS.wageMedianHourly.what);
  assert.equal(s.find((x) => x.key === 'seat.copilot').what, 'Microsoft 365 Copilot (enterprise)');
  assert.equal(s.find((x) => x.key === 'frontier').what, 'Claude Sonnet 5 (API)');
  assert.ok(s.filter((x) => x.key !== 'hoursPerYear').every((x) => /^https:\/\//.test(x.source)));
  assert.deepEqual(sourcesOf(null), []);
});

test('businessCase · totality: garbage never throws', () => {
  const G = [undefined, null, 0, 'x', [], {}, { hoursPerWeek: {} }, { years: Infinity }, true, () => 1];
  for (const a of G) for (const b of G) assert.doesNotThrow(() => businessCase(a, b));
  for (const g of G) { assert.doesNotThrow(() => sourcesOf(g)); assert.doesNotThrow(() => over(g, g, 3)); }
  assert.equal(businessCase(BASIS, { hoursPerWeek: {} }).ok, false);
  const trap = new Proxy({}, { ownKeys() { throw new Error('trap'); } });
  assert.deepEqual(businessCase(BASIS, trap), { ok: false, why: 'the inputs could not be read' });
});
