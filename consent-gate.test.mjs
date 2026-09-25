import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConsentGate } from './consent-gate.mjs';

function fakeClock(start = 1000) { let t = start; return { now: () => t, advance: (ms) => { t += ms; } }; }
function fakeIds() { let n = 0; return () => 'id-' + (n++); }

test('propose then confirm with the real id returns the action and clears the slot', () => {
  const gate = createConsentGate({ now: fakeClock().now, randomId: fakeIds() });
  const p = gate.propose({ verb: 'push', branch: 'x' }, 'push x');
  assert.equal(p.ok, true);
  const c = gate.confirm(p.id);
  assert.equal(c.ok, true);
  assert.deepEqual(c.action, { verb: 'push', branch: 'x' });
  assert.equal(gate.peek(), null); // cleared
});

test('confirm with a wrong id refuses and does NOT clear the real pending action', () => {
  const gate = createConsentGate({ now: fakeClock().now, randomId: fakeIds() });
  const p = gate.propose({ verb: 'push' }, 'push it');
  const wrong = gate.confirm('not-the-real-id');
  assert.equal(wrong.ok, false);
  const right = gate.confirm(p.id); // still works after a wrong guess
  assert.equal(right.ok, true);
});

test('confirm with no pending action refuses', () => {
  const gate = createConsentGate({ now: fakeClock().now, randomId: fakeIds() });
  assert.equal(gate.confirm('anything').ok, false);
});

test('single-use: confirming the same id twice fails the second time (isolates the pending=null-before-return)', () => {
  const gate = createConsentGate({ now: fakeClock().now, randomId: fakeIds() });
  const p = gate.propose({ x: 1 }, 'do x');
  assert.equal(gate.confirm(p.id).ok, true);
  const replay = gate.confirm(p.id);
  assert.equal(replay.ok, false);
});

test('a newer proposal overwrites the slot; the OLD id no longer confirms', () => {
  const gate = createConsentGate({ now: fakeClock().now, randomId: fakeIds() });
  const first = gate.propose({ x: 1 }, 'first');
  const second = gate.propose({ x: 2 }, 'second');
  assert.notEqual(first.id, second.id);
  assert.equal(gate.confirm(first.id).ok, false);
  const c = gate.confirm(second.id);
  assert.equal(c.ok, true);
  assert.deepEqual(c.action, { x: 2 });
});

test('TTL expiry: confirming after the TTL window has passed refuses, using an injected clock (no real sleeping)', () => {
  const clock = fakeClock(0);
  const gate = createConsentGate({ ttlMs: 1000, now: clock.now, randomId: fakeIds() });
  const p = gate.propose({ x: 1 }, 'expires');
  clock.advance(1001);
  assert.equal(gate.confirm(p.id).ok, false);
});

test('just under the TTL boundary still succeeds', () => {
  const clock = fakeClock(0);
  const gate = createConsentGate({ ttlMs: 1000, now: clock.now, randomId: fakeIds() });
  const p = gate.propose({ x: 1 }, 'boundary');
  clock.advance(999);
  assert.equal(gate.confirm(p.id).ok, true); // just under TTL — still good
});

test('EXACTLY at the TTL boundary (elapsed === ttlMs) is still valid, not yet expired (isolates > from >=)', () => {
  const clock = fakeClock(0);
  const gate = createConsentGate({ ttlMs: 1000, now: clock.now, randomId: fakeIds() });
  const p = gate.propose({ x: 1 }, 'exact boundary');
  clock.advance(1000); // elapsed === ttlMs exactly
  assert.equal(gate.confirm(p.id).ok, true); // "> ttlMs" means exactly-at-ttl is still inside the window
});

test('peek reflects the current pending summary AND action without consuming it', () => {
  const gate = createConsentGate({ now: fakeClock().now, randomId: fakeIds() });
  const p = gate.propose({ x: 1 }, 'peekable');
  assert.deepEqual(gate.peek(), { id: p.id, summary: 'peekable', action: { x: 1 } });
  assert.deepEqual(gate.peek(), { id: p.id, summary: 'peekable', action: { x: 1 } }); // still there — peek does not consume
  assert.equal(gate.confirm(p.id).ok, true);
});

test('peek returns null once expired', () => {
  const clock = fakeClock(0);
  const gate = createConsentGate({ ttlMs: 500, now: clock.now, randomId: fakeIds() });
  gate.propose({ x: 1 }, 'will expire');
  clock.advance(501);
  assert.equal(gate.peek(), null);
});

test('propose with a non-string / empty summary refuses, does not set a pending action', () => {
  const gate = createConsentGate({ now: fakeClock().now, randomId: fakeIds() });
  for (const bad of [undefined, null, '', 123, {}]) {
    const r = gate.propose({ x: 1 }, bad);
    assert.equal(r.ok, false);
  }
  assert.equal(gate.peek(), null);
});

test('garbage confirm input never throws', () => {
  const gate = createConsentGate({ now: fakeClock().now, randomId: fakeIds() });
  gate.propose({ x: 1 }, 'ok');
  for (const bad of [undefined, null, 123, {}, [], () => {}]) {
    assert.doesNotThrow(() => gate.confirm(bad));
  }
});

test('two independently-created gates never share state', () => {
  const a = createConsentGate({ now: fakeClock().now, randomId: fakeIds() });
  const b = createConsentGate({ now: fakeClock().now, randomId: fakeIds() });
  const pa = a.propose({ x: 1 }, 'a-action');
  assert.equal(b.confirm(pa.id).ok, false); // b never saw a's proposal
  assert.equal(b.peek(), null);
});
