// businesscase.mjs — the cost case on the page, for a team that runs AI work today: what carrying that work by hand
// costs in staff time (briefing each new session, copying results between tools, relaying between agents, routing jobs),
// what the two rented routes add, and what running it owned, through the controller, costs. Every external figure is
// read from the vendored, sourced basis (vendor/sovereign-enterprise/data/basis.json, byte for byte); the hours, the
// share, the counts and the judgement share are the reader's own. Shaped after liveware's src/mintcase.mjs.
// Floors, never top ends: staff time at the UK median wage with on-costs left out; CPI applied to every later year.
// Like for like: the cloud-API route takes the SAME share of the work off as owning it and sends EVERY job to the API;
// the controller sends only the judgement share there, priced at the same listed API rate (an upper bound: on the
// owner's own login it rides the plan they already have), and runs the rest as code or on the local model, on a laptop
// already in use (its extra power draw is the line). Rented assistant seats help each person but take no work off, so
// the staff time stays. No price of ours appears here: these are the buyer's own costs.
// Pure, total, deterministic (integer powers by repeated multiplication): garbage in gives { ok: false, why }, never a throw.

export const DEFAULTS = Object.freeze({ hoursPerWeek: 20, share: 0.5, seats: 5, jobsPerWeek: 500, tokensIn: 1500, tokensOut: 300, judgementShare: 0.5, years: 3 });
export const BASIS_KEYS = Object.freeze(['wageMedianHourly', 'cpi', 'electricityPencePerKwh', 'laptopExtraWatts', 'hoursPerYear', 'seat.copilot', 'frontier', 'fxGbpPerUsd']);

const isNum = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const r2 = (x) => Math.round(x * 100) / 100;

/** the basis entries the case reads, each a sourced number; null when one is missing or unreadable */
function figures(basis) {
  const b = basis || {}, f = (k) => b[k] || {};
  const out = {
    wage: f('wageMedianHourly').value, cpi: f('cpi').value, pence: f('electricityPencePerKwh').value, watts: f('laptopExtraWatts').value,
    hours: f('hoursPerYear').value, seat: f('seat.copilot').value, apiIn: f('frontier').inPerM, apiOut: f('frontier').outPerM, fx: f('fxGbpPerUsd').value,
  };
  return Object.values(out).every(isNum) ? out : null;
}

/** where each figure came from, for the page to list beside the numbers */
export function sourcesOf(basis) {
  try { return BASIS_KEYS.map((k) => ({ key: k, what: basis[k].what || basis[k].product, source: basis[k].source })); } catch { return []; }
}

/** a yearly cost carried over `years`, rising by CPI each year after the first */
export function over(perYear, cpi, years) {
  let total = 0, factor = 1;
  for (let y = 0; y < years; y++) { total += perYear * factor; factor *= 1 + cpi; }
  return r2(total);
}

/** the case. input (all optional, defaults above): hoursPerWeek, share (0 to 1), seats, jobsPerWeek, tokensIn, tokensOut,
 *  judgementShare (0 to 1: the share of jobs that need judgement, the only ones the controller sends to the frontier), years */
export function businessCase(basis, input) {
  try {
    const f = figures(basis);
    if (!f) return { ok: false, why: 'a sourced basis with every figure the case reads' };
    const i = { ...DEFAULTS, ...(input || {}) };
    if (!isNum(i.hoursPerWeek) || i.hoursPerWeek > 168) return { ok: false, why: 'hours a week: 0 to 168' };
    if (!isNum(i.share) || i.share > 1) return { ok: false, why: 'the share of the work taken off: 0 to 1' };
    if (!Number.isInteger(i.seats) || i.seats < 0) return { ok: false, why: 'seats: a whole number' };
    if (!isNum(i.jobsPerWeek) || !isNum(i.tokensIn) || !isNum(i.tokensOut)) return { ok: false, why: 'jobs and tokens: numbers' };
    if (!isNum(i.judgementShare) || i.judgementShare > 1) return { ok: false, why: 'the judgement share: 0 to 1' };
    if (!Number.isInteger(i.years) || i.years < 1 || i.years > 10) return { ok: false, why: 'years: 1 to 10' };
    const staff = r2(i.hoursPerWeek * 52 * f.wage);                                              // carrying the work by hand, a year
    const takenOff = r2(staff * i.share);                                                        // the share the owned (or cloud) system does
    const seats = r2(i.seats * 12 * f.seat);                                                     // rented assistants: help, take nothing off
    const api = r2(i.jobsPerWeek * 52 * (i.tokensIn * f.apiIn + i.tokensOut * f.apiOut) / 1e6 * f.fx);   // a cloud model on every job
    const judgement = r2(api * i.judgementShare);                                                // the controller: only judgement reaches it
    const power = r2(f.watts * f.hours / 1000 * f.pence / 100);                                  // owned: an always-on extra draw, a year
    const perYear = { today: staff, rentSeats: r2(staff + seats), cloudApi: r2(staff - takenOff + api), own: r2(staff - takenOff + judgement + power) };
    const total = Object.fromEntries(Object.entries(perYear).map(([k, v]) => [k, over(v, f.cpi, i.years)]));
    return {
      ok: true, inputs: i, lines: { staff, takenOff, seats, api, judgement, power }, perYear, over: total,
      savingPerYear: r2(perYear.today - perYear.own), savingOver: r2(total.today - total.own), versusCloudOver: r2(total.cloudApi - total.own),
    };
  } catch { return { ok: false, why: 'the inputs could not be read' }; }
}

export default { DEFAULTS, BASIS_KEYS, sourcesOf, over, businessCase };
