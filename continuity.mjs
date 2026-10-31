// continuity.mjs — the two-way line between Kar and Grok Bot through the shared STATUS.md log (newest day first:
// "## YYYY-MM-DD" headings, one "- **Who …:** text" bullet per entry, indented lines continue an entry). Grok writes a
// daily report; Kar logs what went live or what a receipt changed. This reads the log for a session's start (Grok's
// latest report, what he has asked of Kar, how long since Kar last wrote) and adds Kar's entries. Pure and total:
// nonsense in gives an empty result, never a throw.

export const DAY = /^## (\d{4}-\d{2}-\d{2})\s*$/;
const BULLET = /^- \*\*([A-Za-z]+)/;
const ASK = /Requests? for Kar:(?:\*\*)?\s*/i;
const str = (x) => (typeof x === 'string' ? x : '');

/** the log as days, newest first as written: [{ date, entries: [{ who, text }] }] */
export function days(md) {
  const out = [];
  for (const line of str(md).split(/\r?\n/)) {
    const d = DAY.exec(line);
    if (d) { out.push({ date: d[1], entries: [] }); continue; }
    const day = out[out.length - 1];
    if (!day) continue;
    const b = BULLET.exec(line);
    if (b) day.entries.push({ who: b[1], text: line.slice(2).trim() });
    else if (/^\s+\S/.test(line) && day.entries.length) day.entries[day.entries.length - 1].text += ' ' + line.trim();
  }
  return out;
}

/** the newest date on which who wrote an entry, or null */
export const lastBy = (ds, who) => ((Array.isArray(ds) ? ds : []).find((d) => d && Array.isArray(d.entries) && d.entries.some((e) => e && e.who === who)) || {}).date || null;

/** whole days from date a to date b (YYYY-MM-DD), or null if either is not a date */
export function daysBetween(a, b) {
  const t = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(str(s)) ? Date.parse(s + 'T00:00:00Z') : NaN), x = t(a), y = t(b);
  return Number.isFinite(x) && Number.isFinite(y) ? Math.round((y - x) / 86400000) : null;
}

/** what Grok has asked of Kar: the "Requests for Kar:" clause of each of his entries, newest first, at most n; a
 *  clause that starts "none" asks nothing, and a repeat (the same words outside brackets, e.g. "third day running")
 *  is shown once */
const gist = (s) => s.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
export function asks(ds, n = 3) {
  const out = [];
  for (const d of Array.isArray(ds) ? ds : []) for (const e of (d && Array.isArray(d.entries) ? d.entries : [])) {
    if (!e || e.who !== 'Grok') continue;
    const m = ASK.exec(str(e.text));
    if (!m) continue;
    const say = str(e.text).slice(m.index + m[0].length).trim();
    if (say && !/^none\b/i.test(say) && !out.some((o) => gist(o.say) === gist(say))) out.push({ date: d.date, say });
  }
  return out.slice(0, Math.max(0, n));
}

/** the log with one more Kar entry under its date: the day's heading is made, newest first, if it is not there */
export function addKar(md, date, text) {
  const t = str(text).replace(/\s+/g, ' ').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(date)) || !t) return str(md);
  const lines = str(md).split('\n'), entry = '- **Kar:** ' + t, at = lines.findIndex((l) => DAY.test(l));
  const here = lines.findIndex((l) => l.trim() === '## ' + date);
  if (here >= 0) { lines.splice(here + 1, 0, '', entry); return lines.join('\n'); }
  if (at >= 0) { lines.splice(at, 0, '## ' + date, '', entry, ''); return lines.join('\n'); }
  return str(md).replace(/\n*$/, '') + '\n\n## ' + date + '\n\n' + entry + '\n';
}

/** what a session starts with: Grok's latest report, his open asks, and how long since Kar last wrote */
export function surface(md, today, clip = 600) {
  const ds = days(md), grok = lastBy(ds, 'Grok'), kar = lastBy(ds, 'Kar'), gap = kar ? daysBetween(kar, today) : null;
  if (!grok && !kar) return '';
  const latest = grok ? ds.find((d) => d.date === grok).entries.find((e) => e.who === 'Grok').text : '';
  const cut = (s) => (s.length > clip ? s.slice(0, clip - 1) + '…' : s);
  const L = ['── GROK → KAR · the shared STATUS.md ──'];
  if (grok) L.push('Grok\'s latest report (' + grok + '): ' + cut(latest));
  const a = asks(ds);
  if (a.length) L.push('Grok has asked Kar (answer these in STATUS.md):', ...a.map((x) => '• ' + x.date + ': ' + cut(x.say)));
  L.push(kar === null ? '⚠ Kar has never written to STATUS.md.' : gap > 1 ? '⚠ Kar last wrote to STATUS.md on ' + kar + ', ' + gap + ' days ago: log what went live (node kar-mind/tools/kar-status.mjs "…").' : 'Kar last wrote to STATUS.md on ' + kar + '.');
  return L.join('\n');
}

export default { DAY, days, lastBy, daysBetween, asks, addKar, surface };
