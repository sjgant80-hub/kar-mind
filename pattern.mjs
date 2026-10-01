// pattern.mjs — SIMON'S PATTERN: A DIRECTOR PROFILE THAT PREDICTS HIS CALLS (Kar, 2026-10-01; queue item 3).
// Simon, relayed verbatim: "yes go kar do the fix pass then my pattern lfg". The brief: a director profile from his
// rules, his taste and his actual yes/no history; the brain predicts his call; the hit rate is sealed per decision
// type on decisions held out by date; 95% per decision type.
//
// A decision here is a moment in a session where Simon was asked to choose (a question at the end of a reply to
// him) and answered with a verdict: go (do it), all (when offered options, all of them) or no (not this, not now).
// Answers that are a new instruction rather than a verdict are counted and left out of the hit rate.
//
// ⚑ A TYPE THAT CLEARS 95% IS ONLY NAMED. Whether it stops needing him is Simon's switch; nothing here can flip it.
// And money, posting on his behalf and anything destructive stay on his key by his standing rule however well
// they are predicted: those types are never named as ready to stop needing him.
//
// Pure and total: no I/O, never throws on garbage. The I/O (reading sessions, which stay private) is
// tools/pattern-measure.mjs.

const str = (v) => (typeof v === 'string' ? v : '');
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export const TYPES = ['money', 'post', 'destroy', 'standing', 'choose', 'build', 'other'];
export const VERDICTS = ['go', 'all', 'no'];
export const ON_HIS_KEY = ['money', 'post', 'destroy'];

// the part of a reply where the question lives: from the start of the sentence that holds its last question mark
// (or its last "want me to / say the word" line) to the end, at most 400 characters — the context before it is
// what was done, not what was asked
export function questionOf(text) {
  const t = str(text).trim();
  let at = t.lastIndexOf('?');
  if (at < 0) { const m = [...t.matchAll(/want me to|should i|shall i|say the word|say go|your call|do you want/gi)].pop(); at = m ? m.index : t.length; }
  const head = t.slice(0, at);
  const start = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('\n'), head.lastIndexOf('? '));
  return t.slice(start + 1).trim().slice(-400);
}

// was Simon being asked to decide something?
const ASKS = /\b(want me to|should i|shall i|your call|say (the word|go)|do you want|which (one|first|way)|ready (for|to)|good to go|ok to|okay to|yes or no|call it)\b/i;
export function isDecision(text) {
  const q = questionOf(text);
  return /\?/.test(q.slice(-400)) || ASKS.test(q);
}

// what kind of decision — first match wins, in this order
const TYPE_RULES = [
  ['money', /\b(price|prices|pricing|paid tier|pay|payment|stripe|charge|spend|spending|invoice|billing|purchase|buy|subscription)\b|[£$€]\s?\d/i],
  ['post', /\b(post|posting|tweet|linkedin|facebook|announce|product ?hunt|newsletter|e-?mail|dm|send (it|this|that) to|reply to|outreach|cold (message|email))\b/i],
  ['destroy', /\b(delete|deletion|remove|wipe|purge|drop the|reset --hard|force[- ]push|overwrite|uninstall|archive (it|the))\b/i],
  ['standing', /\b(schedul\w*|nightly|cron|task scheduler|at (logon|login|startup)|on (logon|login|startup)|every (night|morning|day|session)|session hook|hooks?|settings\.json|standing)\b/i],
  ['choose', /\((a|1)\)[\s\S]*\((b|2)\)|\b(a|b)\)\s|\bwhich (one|first|way)\b|\beither\b|\bor\b[^.?]{0,160}\?/i],
  ['build', /\b(build|wire|fix|extend|add|ship|make|draft|create|upgrade|start|finish|route|set up|close|push|deploy|go live|gate|run|write|cut|stamp|fork|merge|port|scope)\b/i],
];
export function typeOf(text) {
  const q = questionOf(text);
  for (const [t, re] of TYPE_RULES) if (re.test(q)) return t;
  return 'other';
}

// Simon's answer as a verdict, or null when it is a new instruction, a question back, or a status
const ALL = /^(?:(?:yes|yeah|yep|ok|okay|go|do)[ ,.!]+)?(?:all of (?:it|them)|all three|all|both|everything|do it all|the lot)\b/;
const GO = /^(?:y|yes|yeah|yep|yup|go|go for it|do it|lfg|sure|approved|ship it|push it|proceed|please do|crack on|keep going|continue|carry on|build it|wire it|fork it|make it so)\b/;
const NO = /^(?:n|no|nope|nah|don'?t|do not|stop|not (?:now|yet)|park|hold|wait|leave it|skip|never ?mind|cancel)\b/;
export function verdictOf(reply) {
  const r = str(reply).toLowerCase().replace(/^[\s"'*>.,!-]+/, '');
  if (!r) return null;
  if (ALL.test(r) || /^(?:yes|go|do|ok)\b[^.?!]{0,30}\b(?:all of it|all three|both|do it all|everything)\b/.test(r)) return 'all';
  if (/^(?:ok|okay)[.! ]*$/.test(r)) return 'go';
  if (GO.test(r)) return 'go';
  if (NO.test(r)) return 'no';
  return null;
}

// one decision from one exchange: the reply that asked, and Simon's answer to it; null when it is not a decision
export function decisionOf({ ask, reply, at } = {}) {
  if (!isDecision(ask)) return null;
  return { at: str(at).slice(0, 10), type: typeOf(ask), verdict: verdictOf(reply) };
}

// A session that was resumed carries its history again; the same exchange is one decision, not two.
export function dedupe(pairs) {
  const seen = new Set(), out = [];
  for (const p of Array.isArray(pairs) ? pairs : []) {
    if (!isObj(p)) continue;
    const key = str(p.reply).trim() + '\u0000' + str(p.ask).trim().slice(-200);
    if (seen.has(key)) continue;
    seen.add(key); out.push(p);
  }
  return out;
}

// the profile: for every type, how often each verdict came, from the training decisions only
export function profile(decisions) {
  const byType = {};
  const overall = { go: 0, all: 0, no: 0 };
  for (const d of Array.isArray(decisions) ? decisions : []) {
    if (!isObj(d) || !TYPES.includes(d.type) || !VERDICTS.includes(d.verdict)) continue;
    byType[d.type] = byType[d.type] || { go: 0, all: 0, no: 0 };
    byType[d.type][d.verdict]++;
    overall[d.verdict]++;
  }
  return { byType, overall };
}
const majority = (c) => VERDICTS.reduce((best, v) => (c[v] > c[best] ? v : best), VERDICTS[0]);

// the call the profile predicts for a type: that type's most frequent verdict, else the overall one
export function predict(prof, type) {
  const p = isObj(prof) ? prof : {};
  const c = isObj(p.byType) && isObj(p.byType[type]) ? p.byType[type] : null;
  if (c && VERDICTS.some((v) => c[v] > 0)) return majority(c);
  return majority(isObj(p.overall) ? p.overall : { go: 0, all: 0, no: 0 });
}

// the lower edge of the 95% Wilson interval: how low the true hit rate could plausibly be
export function wilsonLow(k, n) {
  if (!(Number.isInteger(n) && n > 0 && Number.isInteger(k) && Math.abs(k) === k && k <= n)) return 0;
  const z = 1.96, p = k / n, z2 = z * z;
  const centre = p + z2 / (2 * n), spread = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return Math.max(0, (centre - spread) / (1 + z2 / n));
}

// held-out decisions scored: overall, against always-go, and per type — with which types clear the bar
export function score(prof, held, { bar = 0.95, minN = 10 } = {}) {
  const rows = (Array.isArray(held) ? held : []).filter((d) => isObj(d) && TYPES.includes(d.type) && VERDICTS.includes(d.verdict));
  const marks = rows.map((d) => ({ type: d.type, actual: d.verdict, predicted: predict(prof, d.type) }));
  const hits = marks.filter((m) => m.actual === m.predicted).length;
  const types = TYPES.map((t) => {
    const ms = marks.filter((m) => m.type === t);
    const k = ms.filter((m) => m.actual === m.predicted).length;
    const rate = ms.length ? k / ms.length : 0;
    return { type: t, n: ms.length, hits: k, rate, low: wilsonLow(k, ms.length), predicts: predict(prof, t),
      clears: ms.length >= minN && rate >= bar, onHisKey: ON_HIS_KEY.includes(t) };
  });
  return { n: marks.length, hits, rate: marks.length ? hits / marks.length : 0, alwaysGo: marks.filter((m) => m.actual === 'go').length, marks, types };
}

// the sealed rules
export function judgePattern(s, bars) {
  if (!isObj(s) || !Array.isArray(s.types) || !Number.isInteger(s.n) || !isObj(bars) || !['overallAtLeast', 'minHeld'].every((k) => typeof bars[k] === 'number')) {
    return { ok: false, why: 'a score and the sealed bars' };
  }
  const pct = (x) => Math.round(x * 1000) / 10 + '%';
  const cleared = s.types.filter((t) => t.clears && !t.onHisKey).map((t) => t.type);
  const rules = [
    { id: 'enough', pass: s.n >= bars.minHeld, value: s.n + ' held-out decisions with a verdict' },
    { id: 'overall', pass: s.n > 0 && s.rate >= bars.overallAtLeast, value: s.hits + '/' + s.n + ' = ' + pct(s.rate) },
    { id: 'beats-always-go', pass: s.hits > s.alwaysGo, value: s.hits + ' right against ' + s.alwaysGo + ' for always saying go' },
    { id: 'a-type-clears', pass: cleared.length > 0, value: cleared.length ? cleared.join(', ') + ' at 95% or more' : 'no type reached 95% on enough decisions' },
  ];
  return { ok: true, rules, passed: rules.filter((r) => r.pass).length, of: rules.length, cleared };
}

export default { TYPES, VERDICTS, ON_HIS_KEY, questionOf, isDecision, typeOf, verdictOf, decisionOf, dedupe, profile, predict, wilsonLow, score, judgePattern };
