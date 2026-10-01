// watch.mjs — KAR WATCHES HIMSELF (Kar, 2026-10-01; queue item 4). Simon, relayed verbatim: "next watch".
// The brief: the observer-creature loop applied to Kar — his own misses rewrite his playbook — and a sealed test of
// whether he makes fewer repeat mistakes with the loop than without it, on held-out work.
//
// The creature that looked at its own misreads (kard-evolve, EXP 2) found U→V sooner than one that only scored
// itself. This is the same move for Kar's direct line: every answer his local line got wrong in a sealed run is a
// miss; each miss is read for its SHAPE (what kind of wrong it was); the loop folds the misses into a playbook — one
// rule per shape that has happened, ordered by how often, each with the real misses it came from as examples — and
// rewrites it after every run: new shapes get a rule, old ones climb or fall by count, a shape that has not recurred
// for three runs is retired. The playbook rides in his live state, like the brain.
//
// Pure and total: no I/O, never throws on garbage. The glue (reading runs, writing the playbook) is brain-cli.mjs and
// tools/watch-measure.mjs.
import { gradeAnswer } from './brain.mjs';

const str = (v) => (typeof v === 'string' ? v : '');
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export const SHAPES = ['tool-detour', 'wrong-number', 'half-pair', 'wrong-name', 'no-answer'];
export const RULES = {
  'tool-detour': 'The answer to a question about the estate or my own recent work is in my brain, above. I read it there and answer; I reach for a tool only when the brain does not hold it.',
  'wrong-number': 'When a line carries several numbers, I find the label that was asked about first and give the number that sits with that label. A neighbouring number on the same line (the 1B\'s 19 when the 14B\'s 37 was asked) is how I get these wrong.',
  'half-pair': 'When asked for two things (before and after, this against that), I give both, in the order asked, each with its label.',
  'wrong-name': 'When asked which build, commit, key or name, I give exactly the one my brain ties to that subject, never a neighbouring build\'s. Newest means the first build listed.',
  'no-answer': 'If my brain holds the answer I give it plainly; only if it truly does not do I say so, in one line, never a guess.',
};

const NO_ANSWER = /\b(i (?:don'?t|do not) (?:know|have)|not sure|no (?:information|record|data)|(?:can'?t|cannot|couldn'?t|could not) (?:find|tell|determine|say)|not (?:in|available in) my)\b/i;
// a reply that went looking instead of answering — said so, or reports what a tool found or failed to find
const LOOK = /\b(let me (?:check|look|search|find|see)|i(?:'| wi)ll (?:check|look)|i (?:need|would need) to (?:check|look)|enoent|no such file|not found at|search did not find|(?:index|search) shows)\b/i;

// what kind of wrong a wrong answer was
export function shapeOf({ expect, reply, toolCalls } = {}) {
  const r = str(reply).trim(), e = str(expect);
  if (!r || NO_ANSWER.test(r)) return 'no-answer';
  if (Number(toolCalls) > 0 || LOOK.test(r)) return 'tool-detour';
  if (e.includes('[\\s\\S]')) return 'half-pair';
  // a number was asked for when the pattern's own text (not its quantifiers or escapes) holds a digit, and it is no commit
  const literal = e.replace(/\{\d+(?:,\d*)?\}/g, '').replace(/\\[bBsSdDwW]/g, '');
  const numberAsked = /\d/.test(literal) && !/^[0-9a-f]{7}$/.test(e);
  return numberAsked && /\d/.test(r) ? 'wrong-number' : 'wrong-name';
}

// every wrong answer in one arm of one sealed run, with its shape; `run` orders the runs the loop has seen
export function missesOf(questions, answers, run, source) {
  if (!Array.isArray(questions) || !Array.isArray(answers) || questions.length !== answers.length || !Number.isInteger(run)) return [];
  const out = [];
  questions.forEach((q, k) => {
    const a = isObj(answers[k]) ? answers[k] : {};
    if (!isObj(q) || gradeAnswer(str(a.reply), str(q.expect))) return;
    out.push({ run, source: str(source), q: str(q.q), expect: str(q.expect), said: clip(str(a.reply).replace(/\s+/g, ' ').trim(), 160), shape: shapeOf({ expect: q.expect, reply: a.reply, toolCalls: a.toolCalls }) });
  });
  return out;
}

// right answers from any run, by question — the playbook's examples show what right looked like when it was right
export function rightOf(questions, answers) {
  const out = {};
  if (!Array.isArray(questions) || !Array.isArray(answers) || questions.length !== answers.length) return out;
  questions.forEach((q, k) => {
    const a = isObj(answers[k]) ? answers[k] : {};
    const r = str(a.reply).replace(/\s+/g, ' ').trim();
    if (isObj(q) && gradeAnswer(r, str(q.expect)) && (!out[q.q] || r.length < out[q.q].length)) out[q.q] = clip(r, 160);
  });
  return out;
}

// THE LOOP: misses (and the right answers seen) → the playbook. Rules ordered by how often their shape happened;
// a shape not seen in the last `retireAfter` runs is retired; examples are each shape's latest misses.
export function playbook(misses, { right = {}, prevVersion = 0, maxRules = 5, maxExamples = 2, retireAfter = 3 } = {}) {
  const ms = (Array.isArray(misses) ? misses : []).filter((m) => isObj(m) && SHAPES.includes(m.shape) && Number.isInteger(m.run));
  const latest = ms.reduce((x, m) => Math.max(x, m.run), 0);
  const rules = [], retired = [];
  for (const shape of SHAPES) {
    const of = ms.filter((m) => m.shape === shape);
    if (!of.length) continue;
    const last = of.reduce((x, m) => Math.max(x, m.run), 0);
    const row = { shape, count: of.length, lastRun: last, rule: RULES[shape],
      examples: of.slice().sort((a, b) => b.run - a.run).filter((m, k, all) => all.findIndex((x) => x.q === m.q) === k).slice(0, maxExamples).map((m) => ({ q: m.q, said: m.said, right: str(isObj(right) ? right[m.q] : '') })) };
    if (latest - last >= retireAfter) retired.push(row); else rules.push(row);
  }
  rules.sort((a, b) => b.count - a.count || SHAPES.indexOf(a.shape) - SHAPES.indexOf(b.shape));
  const kept = rules.slice(0, Math.max(0, maxRules));
  return { version: (Number.isInteger(prevVersion) ? prevVersion : 0) + 1, learnedFrom: ms.length, runs: latest, rules: kept, retired: retired.concat(rules.slice(kept.length)).map((r) => r.shape) };
}

// the playbook as Kar reads it in his live state
export function renderPlaybook(pb) {
  if (!isObj(pb) || !Array.isArray(pb.rules) || !pb.rules.length) return '';
  const lines = ['MY PLAYBOOK — rules I wrote from my own past misses (version ' + pb.version + ', from ' + pb.learnedFrom + ' wrong answers). I read them before I answer:'];
  pb.rules.forEach((r, k) => {
    lines.push((k + 1) + '. ' + r.rule + ' (I have missed this way ' + r.count + ' time' + (r.count === 1 ? '' : 's') + '.)');
    for (const e of Array.isArray(r.examples) ? r.examples : []) lines.push('   e.g. asked "' + e.q + '" I said "' + e.said + '"' + (e.right ? ' — right was "' + e.right + '"' : '') + '.');
  });
  return lines.join('\n');
}

// the sealed rules over the held-out work. Each arm: { marks, shapes } (shapes of the wrong answers, '' where right).
export function judgeWatch({ without, withLoop, learned, loopCloses, bars } = {}) {
  const arm = (a) => isObj(a) && Array.isArray(a.marks) && Array.isArray(a.shapes) && a.marks.length === a.shapes.length && a.marks.length > 0;
  if (!arm(without) || !arm(withLoop) || without.marks.length !== withLoop.marks.length || !Array.isArray(learned) || typeof loopCloses !== 'boolean' || !isObj(bars) || !Number.isInteger(bars.fewerBy)) {
    return { ok: false, why: 'two arms over the same held-out questions ({ marks, shapes }), the shapes the playbook learned, the loop check and the sealed bars' };
  }
  const repeats = (a) => a.marks.filter((m, k) => !m && learned.includes(a.shapes[k])).length;
  const right = (a) => a.marks.filter(Boolean).length;
  const r0 = repeats(without), r1 = repeats(withLoop), n = without.marks.length;
  const lost = without.marks.filter((m, k) => m && !withLoop.marks[k]).length;
  const rules = [
    { id: 'fewer-repeats', pass: r0 - r1 >= bars.fewerBy, value: r1 + ' repeat mistakes with the loop, ' + r0 + ' without' },
    { id: 'not-worse', pass: right(withLoop) >= right(without), value: right(withLoop) + ' of ' + n + ' right with the loop, ' + right(without) + ' without' },
    { id: 'no-regression', pass: lost === 0, value: lost === 0 ? 'every answer right without the loop is right with it' : lost + ' answer(s) right without the loop went wrong with it' },
    { id: 'loop-closes', pass: loopCloses, value: loopCloses ? 'the run\'s own misses rewrote the playbook, and the live line carries the new version' : 'the playbook was not rewritten from this run' },
  ];
  return { ok: true, rules, passed: rules.filter((x) => x.pass).length, of: rules.length, repeats: { without: r0, withLoop: r1 } };
}

export default { SHAPES, RULES, shapeOf, missesOf, rightOf, playbook, renderPlaybook, judgeWatch };
