// brain.mjs — THE BRAIN, SWITCHED ON. The law of Kar's working memory: what goes into the persistent
// journal, what comes out of it at the start of every session and into every cockpit message, what the
// next build is, and which decisions are Simon's alone.
//
// The estate already had the organs (Simon, 2026-10-01: "you've built every organ ... but they're not
// linked"): the persistent mind (persist.mjs + mind.mjs, shaped after Gary W. Floyd's NEXUS — Lumiea
// Systems Research Division, ThunderStruck Service LLC), the memory files, Kar's asks, the soul, the
// cockpit. What it lacked was the wire between them, so a person had to carry every result from one to
// the next. This is that wire's logic. The glue that reads files and writes the journal is
// brain-cli.mjs; everything here is pure, so the gate can attack all of it.
//
// ⚑ THE BRAIN DECIDES WHAT TO WORK ON; IT NEVER DECIDES WHAT IS SIMON'S. Publishing, money and standing
// switches stay on his key. decisionsOf() names them; nothing in this file can act on one.
//
// Pure and total: no I/O, no clock (the caller passes `now`), never throws on bad input.

export const MAX_DESC = 400;
export const MAX_LINE = 600;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const unquote = (s) => (/^".*"$/.test(s) ? s.slice(1, -1).replace(/\\"/g, '"') : s);
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// A memory file's frontmatter: its name, its one-line description, its type. Null when there is none.
export function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(str(text));
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const k = /^\s*(name|description|type):\s*(.*)$/.exec(line);
    if (k && !(k[1] in out)) out[k[1]] = unquote(k[2].trim());
  }
  return out;
}

// Memory files → facts for the journal: one per file that describes itself.
export function memoryFacts(files) {
  if (!Array.isArray(files)) return [];
  const out = [];
  for (const f of files) {
    if (!isObj(f) || !str(f.name) || !Number.isFinite(f.mtimeMs)) continue;
    const fm = frontmatter(f.text);
    if (!fm || !str(fm.description)) continue;
    out.push({ key: 'memory:' + f.name, value: { d: clip(fm.description, MAX_DESC), type: str(fm.type) || null }, source: 'memory', ts: f.mtimeMs });
  }
  return out;
}

// MEMORY.md, read for the two things a session needs first: the estate line and the recent builds.
export function indexLines(text) {
  const lines = str(text).split(/\r?\n/);
  const plain = (s) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*|⚑/g, '').replace(/^\s*>\s*/, '').trim();
  const estate = lines.find((l) => /ESTATE/.test(l));
  const at = lines.findIndex((l) => /^\*\*Recent builds/.test(l));
  const recent = [];
  if (at >= 0) {
    for (const l of lines.slice(at + 1)) {
      if (!/^- /.test(l)) break;
      const m = /^- \[([^\]]+)\]\([^)]*\)\s*—\s*(.*)$/.exec(l);
      if (m) recent.push({ name: m[1], text: plain(m[2]) });
    }
  }
  return { estate: estate ? plain(estate) : null, recent };
}

// Kar's asks (kar-asks.json) and the build queue (backlog.json) → facts.
export function askFacts(doc) {
  const asks = isObj(doc) && Array.isArray(doc.asks) ? doc.asks : [];
  return asks.filter((a) => isObj(a) && str(a.id) && str(a.say)).map((a) => ({
    key: 'ask:' + a.id, value: { kind: str(a.kind), status: str(a.status), say: clip(a.say, MAX_DESC) }, source: 'kar-asks', ts: Date.parse(a.at) || 0,
  }));
}
export function backlogFacts(doc) {
  const items = isObj(doc) && Array.isArray(doc.items) ? doc.items : [];
  return items.filter((i) => isObj(i) && str(i.id) && str(i.title) && Number.isInteger(i.n)).map((i) => ({
    key: 'backlog:' + i.id,
    value: { n: i.n, title: i.title, status: str(i.status) || 'open', needs: str(i.needs) || null, after: Array.isArray(i.after) ? i.after.filter(str) : [], why: clip(str(i.why), MAX_DESC) },
    source: 'brain-backlog', ts: Number.isFinite(i.ts) ? i.ts : 0,
  }));
}

// The journal's events (the mind's own `perceive` records) → the latest fact for every key.
export function stateOf(events) {
  const state = new Map();
  if (!Array.isArray(events)) return state;
  for (const e of events) {
    if (!isObj(e) || e.t !== 'perceive' || !isObj(e.fact) || !str(e.fact.key)) continue;
    state.set(e.fact.key, { value: e.fact.value, ts: e.fact.ts, source: e.fact.source });
  }
  return state;
}

// Only what is new or different goes into the journal — re-reading an unchanged file writes nothing.
export function changedFacts(state, facts) {
  if (!(state instanceof Map) || !Array.isArray(facts)) return [];
  return facts.filter((f) => isObj(f) && str(f.key) && (!state.has(f.key) || JSON.stringify(state.get(f.key).value) !== JSON.stringify(f.value)));
}

const family = (state, prefix) => [...state].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => ({ id: k.slice(prefix.length), ...v.value, ts: v.ts }));

// The next build: the first open item in Simon's approved order whose prerequisites are done; and the
// asks still open, so a want never silently drops.
export function nextBuild(state) {
  if (!(state instanceof Map)) return { build: null, asks: [] };
  const items = family(state, 'backlog:').sort((a, b) => a.n - b.n);
  const done = new Set(items.filter((i) => i.status === 'done').map((i) => i.id));
  const build = items.find((i) => i.status === 'open' && i.after.every((a) => done.has(a))) || null;
  const asks = family(state, 'ask:').filter((a) => a.status === 'open' && a.kind !== 'decision');
  return { build, asks };
}

// The decisions that are Simon's alone: open decision-asks, and queue items waiting on his yes.
export function decisionsOf(state) {
  if (!(state instanceof Map)) return [];
  const asks = family(state, 'ask:').filter((a) => a.status === 'open' && a.kind === 'decision').map((a) => ({ id: a.id, say: a.say, from: 'ask' }));
  const waits = family(state, 'backlog:').filter((i) => i.status === 'needs-simon').map((i) => ({ id: i.id, say: i.title + (i.why ? ' — ' + i.why : ''), from: 'queue' }));
  return [...asks, ...waits];
}

// What a session (and every cockpit message) starts with. Small and true: the estate, the latest builds,
// what changed since the last look, what is open, what is next, and what only Simon decides.
// keyFacts (the 2026-10-01 fix pass): under each recent build, its own memory file's description — the sha,
// the scores, the keys — because the one-line index entry alone left facts out (the champion's key was in
// kard-evolve.md, never in the index line, so the first measurement asked for a fact the digest did not hold).
export function digest({ state, index, since = 0, now = 0, recentMax = 6, changedMax = 8, keyFacts = false } = {}) {
  if (!(state instanceof Map) || !isObj(index)) return null;
  const L = ['── KAR\'S BRAIN · working memory, read from the persistent journal (' + state.size + ' facts) ──'];
  if (index.estate) L.push('ESTATE: ' + clip(index.estate, MAX_LINE));
  const recent = Array.isArray(index.recent) ? index.recent.slice(0, recentMax) : [];
  if (recent.length) L.push('RECENT BUILDS, newest first:');
  for (const r of recent) {
    L.push('· ' + r.name + ' — ' + clip(str(r.text), MAX_LINE));
    const own = keyFacts ? state.get('memory:' + r.name) : null;
    const facts = own && isObj(own.value) ? keyFactsOf(own.value.d, r.text) : '';
    if (facts) L.push('   key facts: ' + facts);
  }
  const changed = family(state, 'memory:').filter((m) => m.ts > since).sort((a, b) => b.ts - a.ts);
  L.push('CHANGED SINCE THE LAST LOOK (' + changed.length + '):' + (changed.length ? '' : ' nothing'));
  for (const m of changed.slice(0, changedMax)) L.push('· ' + m.id + ' — ' + clip(str(m.d), 200));
  const { build, asks } = nextBuild(state);
  L.push('NEXT BUILD (Simon\'s approved order): ' + (build ? build.n + ' · ' + build.title + (build.why ? ' — ' + clip(build.why, 300) : '') : 'the queue is empty'));
  if (asks.length) L.push('OPEN ASKS:', ...asks.map((a) => '· ' + a.say));
  const ds = decisionsOf(state);
  L.push('DECISIONS ONLY SIMON MAKES (' + ds.length + '):' + (ds.length ? '' : ' none waiting'));
  for (const d of ds) L.push('· ' + d.say);
  if (Number.isFinite(now) && now > 0) L.push('(read ' + new Date(now).toISOString() + ')');
  return L.join('\n');
}

// A fact token: a commit, a key like UV|515, a score like 352/352, a money figure, or any number with a digit.
export const FACT = /\b[0-9a-f]{7}\b|[A-Za-z0-9.]+\|\d+|\b\d[\d,.]*\s*\/\s*\d[\d,.]*|[$£€]\s?\d[\d,.]*[kKmM]?|\b\d[\d,.]*/g;
// keyFactsOf(desc, line, max): the clauses of a build's own description that carry a fact the index line does
// not already carry, joined and capped — so the digest gains the champion's key without doubling in size (a
// digest twice as long took a 7B on this laptop past two minutes before it said a word).
export function keyFactsOf(desc, line, max = 240) {
  if (typeof desc !== 'string' || !desc) return '';
  const have = typeof line === 'string' ? line : '';
  const keep = [];
  for (const raw of desc.split(/\s+—\s+|;\s+|\.\s+|,\s+(?=[A-Za-z])|\(|\)/)) {
    const c = raw.replace(/⚑/g, '').trim();
    if (c.length < 4 || /^https?:/.test(c)) continue;                      // a stray numeral, or an address, is not a fact about the build                                        // an address is not a fact about the build
    const toks = c.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '').match(FACT) || [];   // nor is the date it was written
    if (toks.some((t) => !have.includes(t.trim()))) keep.push(c);
  }
  return clip(keep.join(' · '), max);
}

// Does a reply put off answering in order to go and look, or admit it does not know? The cockpit's local tier
// answers from the brain first, with no tools offered; only a reply like this earns a second turn with tools.
export const LOOKS = /\b(let me (check|look|search|find|see)|i('| wi)ll (check|look)|i (don'?t|do not) (have|know|see)|i('| a)?m not sure|not sure|no (information|record|data)|(can'?t|cannot|couldn'?t|could not) (find|see|tell|determine)|not (in|available in) my|not found)\b/i;
export function needsLook(reply) {
  return typeof reply !== 'string' || reply.trim() === '' || LOOKS.test(reply);
}

// ── the sealed measurement's grading: a reply is right when it carries the fact the question asks for.
export function gradeAnswer(reply, pattern) {
  if (typeof reply !== 'string' || typeof pattern !== 'string' || !pattern) return false;
  try { return new RegExp(pattern, 'i').test(reply); } catch { return false; }
}
export function scoreAnswers(questions, replies) {
  if (!Array.isArray(questions) || !Array.isArray(replies) || questions.length !== replies.length) return null;
  const right = questions.map((q, k) => isObj(q) && gradeAnswer(replies[k], q.expect));
  return { n: questions.length, right: right.filter(Boolean).length, marks: right };
}

// The sealed rules. `bars` comes from the pre-registration; `live` carries the two wire checks.
export function judgeBrain({ withBrain, without, live, bars } = {}) {
  const sc = (s) => isObj(s) && Number.isInteger(s.right) && Number.isInteger(s.n) && Array.isArray(s.marks) && s.marks.length === s.n;
  if (!sc(withBrain) || !sc(without) || withBrain.n !== without.n || !isObj(live) || !isObj(bars)
    || !Number.isInteger(bars.withAtLeast) || !Number.isInteger(bars.withoutAtMost) || !Number.isInteger(bars.liftAtLeast)) {
    return { ok: false, why: 'two scored runs of the same questions, the live checks, and the sealed bars' };
  }
  const kept = without.marks.every((m, k) => !m || withBrain.marks[k]);
  const lift = withBrain.right - without.right;
  const rules = [
    { id: 'brain-grounds', pass: withBrain.right >= bars.withAtLeast, value: withBrain.right + '/' + withBrain.n + ' right with the brain' },
    { id: 'without-guesses', pass: without.right <= bars.withoutAtMost, value: without.right + '/' + without.n + ' right without it' },
    { id: 'lift', pass: lift >= bars.liftAtLeast, value: (lift >= 0 ? '+' : '') + lift },
    { id: 'keeps-what-it-knew', pass: kept, value: kept ? 'every answer right without the brain is still right with it' : 'the brain lost an answer it had' },
    { id: 'soul-live', pass: live.soulLive === true, value: live.soulLive === true ? 'a memory written after boot was found without a restart' : 'not found without a restart' },
    { id: 'loop-closes', pass: live.loopCloses === true, value: live.loopCloses === true ? 'the session start carried the last build and the next one, with nobody relaying' : 'the session start did not carry them' },
  ];
  return { ok: true, rules, passed: rules.filter((r) => r.pass).length, of: rules.length };
}

// The fix pass's sealed rules. Each arm: { marks, tools } over the same questions — the first `original` are the
// first measurement's 20, the rest are held out (written before this was measured, never used to build the fix).
export function judgeFix({ v1, v2, original, bars } = {}) {
  const arm = (a) => isObj(a) && Array.isArray(a.marks) && Array.isArray(a.tools) && a.marks.length === a.tools.length;
  if (!arm(v1) || !arm(v2) || v1.marks.length !== v2.marks.length || !Number.isInteger(original) || original < 1 || original >= v2.marks.length || !isObj(bars)
    || !['originalAtLeast', 'heldAtLeast', 'beatsBy'].every((k) => Number.isInteger(bars[k]))) {
    return { ok: false, why: 'two arms over the same questions ({ marks, tools }), how many are the original ones, and the sealed bars' };
  }
  const right = (a, from, to) => a.marks.slice(from, to).filter(Boolean).length;
  const n = v2.marks.length, held = n - original;
  const o2 = right(v2, 0, original), h2 = right(v2, original, n), t1 = right(v1, 0, n), t2 = right(v2, 0, n);
  const lost = v1.marks.slice(0, original).filter((m, k) => m && !v2.marks[k]).length;
  const looked = (a) => a.tools.filter((t) => t > 0).length;
  const rules = [
    { id: 'original-bar', pass: o2 >= bars.originalAtLeast, value: o2 + '/' + original + ' of the original questions' },
    { id: 'held-out-bar', pass: h2 >= bars.heldAtLeast, value: h2 + '/' + held + ' of the held-out questions' },
    { id: 'beats-v1', pass: t2 - t1 >= bars.beatsBy, value: t2 + ' vs ' + t1 + ' of ' + n },
    { id: 'no-regression', pass: lost === 0, value: lost === 0 ? 'every original answer the first brain got right, the fixed one still gets right' : lost + ' original answer(s) lost' },
    { id: 'fewer-tools', pass: looked(v2) < looked(v1), value: 'reached for a tool on ' + looked(v2) + ' questions, against ' + looked(v1) },
  ];
  return { ok: true, rules, passed: rules.filter((r) => r.pass).length, of: rules.length };
}

export default { MAX_DESC, MAX_LINE, LOOKS, needsLook, FACT, keyFactsOf, judgeFix, frontmatter, memoryFacts, indexLines, askFacts, backlogFacts, stateOf, changedFacts, nextBuild, decisionsOf, digest, gradeAnswer, scoreAnswers, judgeBrain };
