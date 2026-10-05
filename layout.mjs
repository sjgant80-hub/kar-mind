// layout.mjs — Kar's digest, re-laid for a small reader (Kar 2026-10-05, weekly choosing-session).
//
// The watch (2026-10-01) found Kar's 7B misses are READING misses on crowded lines: "19/20 + 8/10 held out" read
// as "19/10", "1B 19, 7B 19, 14B 37" read as "14B", a newest-first list read backwards. A playbook rule telling it
// to read carefully changed nothing (11 repeats with it vs 10 without). So this changes the INPUT, not the
// instructions: the same digest text, re-laid so each fact sits on its own labelled line and the build list says
// out loud which is newest, which is oldest, and which came just before which. Nothing is added that the digest
// did not already say, and nothing it said is dropped (lossless: every fact token survives — see missingFacts).
import { FACT } from './brain.mjs';

// clause boundaries: a dash aside, a semicolon, a middle dot, a colon, a comma, a plus, a "but", a parenthesis
const SEP = /\s+—\s+|;\s+|\s+·\s+|:\s+|,\s+|\s+\+\s+|\s+but\s+|\(|\)/;
const VS = /\s+vs\.?\s+/;

// clausesOf(s): one fact per clause. A "vs" splits too, and keeps its word so "244" still reads "vs 244".
export function clausesOf(s) {
  if (typeof s !== 'string') return [];
  const out = [];
  for (const raw of s.split(SEP)) {
    const parts = raw.split(VS);
    parts.forEach((p, i) => {
      const c = p.replace(/⚑/g, '').trim();
      if (c) out.push(i > 0 ? 'vs ' + c : c);
    });
  }
  return out;
}

// the fact tokens of a text — a commit, a key, a score, a figure — with a trailing comma or stop trimmed
export function factsOf(s) {
  if (typeof s !== 'string') return [];
  return (s.match(FACT) || []).map((t) => t.replace(/[,.]+$/, '').trim()).filter(Boolean);
}

// every fact token of `before` that `after` no longer holds (empty = the re-layout lost nothing)
export function missingFacts(before, after) {
  const have = typeof after === 'string' ? after : '';
  return factsOf(before).filter((t) => !have.includes(t));
}

// the recent builds, newest first, numbered — each says where it sits and which build came just before it
export function renderBuilds(builds) {
  const list = Array.isArray(builds) ? builds : [];
  const n = list.length;
  if (n === 0) return ['RECENT BUILDS: none listed'];
  const L = ['RECENT BUILDS — ' + n + ' listed, numbered newest first: #1 is the newest, #' + n + ' is the oldest listed'];
  list.forEach((b, k) => {
    const where = [];
    if (k === 0) where.push('newest');
    if (k === n - 1) where.push('oldest listed');
    if (k + 1 < n) where.push('built just before it: ' + list[k + 1].name);
    L.push('#' + (k + 1) + ' ' + b.name + ' (' + where.join(' · ') + ')');
    for (const c of b.text.flatMap(clausesOf)) L.push('  - ' + c);
  });
  return L;
}

// relayout(digest): the ESTATE line and the RECENT BUILDS block re-laid; every other line passes through as it was
export function relayout(text) {
  if (typeof text !== 'string') return null;
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('ESTATE: ')) {
      out.push('ESTATE:', ...clausesOf(l.slice(8)).map((c) => '  - ' + c));
      continue;
    }
    if (l.startsWith('RECENT BUILDS')) {
      const builds = [];
      // past the last line, lines[i + 1] is undefined, which reads as "undefined" and never matches — so no bound check
      while (/^(· |\s+key facts: )/.test(lines[i + 1])) {
        const n = lines[++i];
        const m = /^· (\S+) — (.*)$/.exec(n);
        if (m) builds.push({ name: m[1], text: [m[2]] });
        else if (builds.length && !n.startsWith('· ')) builds[builds.length - 1].text.push(n.replace(/^\s+key facts: /, ''));
        else builds.push({ name: '(unnamed)', text: [n.replace(/^· /, '').replace(/^\s+key facts: /, '')] });
      }
      out.push(...renderBuilds(builds));
      continue;
    }
    out.push(l);
  }
  return out.join('\n');
}

export default { clausesOf, factsOf, missingFacts, renderBuilds, relayout };
