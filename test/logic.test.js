// Tests for the drawing rules. Run with:  node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');

const range = (n) => [...Array(n).keys()];

test('a draw never gives anyone their own name, and uses every name once', () => {
  for (let n = 2; n <= 40; n++) {
    for (let r = 0; r < 300; r++) {
      const p = L.derangement(n);
      assert.equal(p.length, n);
      assert.equal(new Set(p).size, n, 'someone was pulled twice');
      p.forEach((to, from) => assert.notEqual(to, from, 'someone got themselves'));
    }
  }
});

test('every possible draw is equally likely (4 people have 9 possible draws)', () => {
  const counts = new Map();
  const R = 90000;
  for (let r = 0; r < R; r++) {
    const key = L.derangement(4).join('');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  assert.equal(counts.size, 9);
  for (const c of counts.values()) assert.ok(Math.abs(c - R / 9) < (R / 9) * 0.05, `uneven: ${[...counts.values()]}`);
});

test('pass-the-phone: random turn orders never get stuck', () => {
  for (let n = 3; n <= 14; n++) {
    for (let r = 0; r < 3000; r++) {
      let pool = range(n), waiting = range(n);
      const got = new Map();
      for (const who of L.shuffle(range(n))) {
        const pick = L.pickFromPool(who, pool, waiting);
        assert.notEqual(pick, who);
        assert.ok(pool.includes(pick));
        pool = pool.filter((x) => x !== pick);
        waiting = waiting.filter((x) => x !== who);
        got.set(who, pick);
      }
      assert.equal(new Set(got.values()).size, n);
      assert.equal(pool.length, 0);
    }
  }
});

test('pass-the-phone: every turn order and every possible pull finishes (up to 5 people)', () => {
  let finished = 0;
  function explore(pool, waiting) {
    if (!waiting.length) { finished++; return; }
    for (const who of waiting) {
      const options = new Set();
      for (let k = 0; k < pool.length; k++) {
        options.add(L.pickFromPool(who, pool, waiting, (m) => Math.min(k, m - 1)));
      }
      for (const pick of options) {
        assert.notEqual(pick, who);
        explore(pool.filter((x) => x !== pick), waiting.filter((x) => x !== who));
      }
    }
  }
  for (let n = 2; n <= 5; n++) explore(range(n), range(n));
  assert.ok(finished > 1000);
});

test('pass-the-phone: refuses a second pull by the same person', () => {
  assert.throws(() => L.pickFromPool(0, [1, 2], [1, 2]));
});

test('secret links survive the trip and keep accents and emoji', () => {
  const obj = { v: 1, i: 'abc12345', n: 'José María', t: 'Zoë 🎄', ne: '🦌', te: '⛄', e: 'Navidad Torres 2026', b: '$25', d: '2026-12-24', l: 'es' };
  for (let k = 0; k < 300; k++) {
    const code = L.encodeTicket(obj);
    assert.match(code, /^a[A-Za-z0-9_-]+$/);
    const raw = Buffer.from(code.slice(1), 'base64url');
    for (const word of ['José María', 'Zoë 🎄', 'Navidad', '"t":']) {
      assert.ok(!raw.includes(Buffer.from(word)), `"${word}" should not be readable inside the link`);
    }
    assert.deepEqual(L.decodeTicket(code), obj);
  }
});

test('broken or tampered links are rejected', () => {
  const good = L.encodeTicket({ v: 1, i: 'abc12345', n: 'Ana', t: 'Luis' });
  assert.ok(L.decodeTicket(good));
  assert.equal(L.decodeTicket(good.slice(0, good.length - 3)), null, 'cut-off link');
  assert.equal(L.decodeTicket('hello'), null);
  assert.equal(L.decodeTicket('a' + 'x'.repeat(40)), null);
  assert.equal(L.decodeTicket(''), null);
  assert.equal(L.decodeTicket(null), null);
  assert.equal(L.decodeTicket(L.encodeTicket({ v: 1, i: 'x1', n: 'Ana', t: 'ana' })), null, 'a link that gives someone themselves');
  assert.equal(L.decodeTicket(L.encodeTicket({ v: 2, i: 'x1', n: 'Ana', t: 'Luis' })), null, 'unknown version');
  assert.equal(L.decodeTicket(L.encodeTicket({ v: 1, i: 'x1', n: { a: 1 }, t: 'Luis' })), null, 'name is not text');
});

test('names are tidied and split from pasted lists', () => {
  assert.deepEqual(L.splitNames(' Ana ,Luis\nMaría  José;; \n\tPedro '), ['Ana', 'Luis', 'María José', 'Pedro']);
  assert.ok(L.sameName('maria', '  MARIA '));
  assert.ok(!L.sameName('Maria', 'María'));
  assert.equal(Array.from(L.cleanName('🎄'.repeat(60))).length, L.MAX_NAME);
});

test('emoji helpers hand out unused emoji', () => {
  const used = L.EMOJIS.slice(0, 5);
  assert.equal(L.nextEmoji(used), L.EMOJIS[5]);
  assert.equal(L.cycleEmoji(L.EMOJIS[0], [L.EMOJIS[1]]), L.EMOJIS[2]);
  assert.ok(L.EMOJIS.includes(L.nextEmoji(L.EMOJIS)));
});
