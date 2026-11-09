/*
 * Secret Santa: the drawing rules. There is no page code in here, so the same file runs in the
 * browser and in Node (see test/logic.test.js).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SantaLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_PEOPLE = 60;
  const MAX_NAME = 40;
  const EMOJIS = ['🦌', '⛄', '🎄', '🍪', '🧦', '⭐', '🎁', '🔔', '🐧', '🧸', '🍭', '🎅',
    '🤶', '🦊', '🍫', '🎀', '🛷', '🧣', '🦉', '🍩', '🐻', '🦄', '🚂', '🧁'];

  const host = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : {});
  const rng = host.crypto && typeof host.crypto.getRandomValues === 'function' ? host.crypto : null;

  function randomBytes(n) {
    const out = new Uint8Array(n);
    if (rng) rng.getRandomValues(out);
    else for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
    return out;
  }

  /** A fair random whole number from 0 to n-1. */
  function randInt(n) {
    if (!(n >= 1)) throw new RangeError('randInt needs n >= 1');
    if (!rng) return Math.floor(Math.random() * n);
    const limit = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    let x;
    do { rng.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % n;
  }

  function shuffle(list, rand = randInt) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /**
   * A random "derangement" of 0..n-1: result[i] is the person that person i gives a gift to.
   * Nobody ever gets themselves, and everybody is given to exactly once.
   * Shuffling until no one has themselves gives every valid draw the same chance.
   */
  function derangement(n, rand = randInt) {
    if (!(n >= 2)) throw new RangeError('A Secret Santa needs at least 2 people');
    const idx = [];
    for (let i = 0; i < n; i++) idx.push(i);
    for (let tries = 0; tries < 10000; tries++) {
      const p = shuffle(idx, rand);
      let ok = true;
      for (let k = 0; k < n; k++) if (p[k] === k) { ok = false; break; }
      if (ok) return p;
    }
    // Practically unreachable (about 1 shuffle in 3 works): chain a shuffled circle instead.
    const s = shuffle(idx, rand), out = new Array(n);
    for (let m = 0; m < n; m++) out[s[m]] = s[(m + 1) % n];
    return out;
  }

  /**
   * Pass-the-phone mode: pull one name for `who` out of the sack.
   *   pool    – ids of the names still in the sack
   *   waiting – ids of the people who haven't pulled yet (includes `who`)
   * Never returns `who`, and never leaves the last person with only their own name in the sack.
   * (With 2 or more people still waiting, any pull leaves a way to finish, so the only trap is
   * the last two, and that is handled below.)
   */
  function pickFromPool(who, pool, waiting, rand = randInt) {
    if (pool.length !== waiting.length) throw new Error('The sack and the waiting list are out of step');
    if (waiting.indexOf(who) < 0) throw new Error('This person already pulled a name');
    let choices = pool.filter((x) => x !== who);
    const others = waiting.filter((w) => w !== who);
    if (others.length === 1 && pool.indexOf(others[0]) >= 0) {
      // Two people left and the other one's own name is still in the sack: it has to be pulled
      // now, or the last person would be left pulling themselves.
      choices = [others[0]];
    }
    if (!choices.length) throw new Error('No valid name left in the sack');
    return choices[rand(choices.length)];
  }

  // ---------- names ----------

  function cleanName(s) {
    const one = String(s == null ? '' : s).normalize('NFC').replace(/\s+/g, ' ').trim();
    return Array.from(one).slice(0, MAX_NAME).join('').trim();
  }
  function splitNames(text) {
    return String(text == null ? '' : text).split(/[\n\r,;\t]+/).map(cleanName).filter(Boolean);
  }
  function nameKey(s) { return cleanName(s).toLocaleLowerCase(); }
  function sameName(a, b) { return nameKey(a) === nameKey(b); }

  /** The first festive emoji nobody has yet (repeats once all of them are taken). */
  function nextEmoji(used) {
    const taken = new Set(used);
    for (const e of EMOJIS) if (!taken.has(e)) return e;
    return EMOJIS[used.length % EMOJIS.length];
  }
  /** The emoji after `current` that nobody else has. */
  function cycleEmoji(current, othersUsed) {
    const taken = new Set(othersUsed);
    const start = EMOJIS.indexOf(current);
    for (let k = 1; k <= EMOJIS.length; k++) {
      const e = EMOJIS[(start + k + EMOJIS.length) % EMOJIS.length];
      if (!taken.has(e)) return e;
    }
    return EMOJIS[(start + 1 + EMOJIS.length) % EMOJIS.length];
  }

  // ---------- secret links ----------
  // A link carries one person's name and the name they pulled. It is scrambled so nothing is
  // readable in the address bar or in a chat preview. It is NOT strong encryption: the page has
  // to be able to unscramble it with no server, so whoever holds a link can see what is inside.

  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  function b64urlEncode(bytes) {
    let out = '', i = 0;
    for (; i + 2 < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    const rest = bytes.length - i;
    if (rest === 1) {
      const n = bytes[i] << 16;
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    } else if (rest === 2) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63];
    }
    return out;
  }

  function b64urlDecode(str) {
    const clean = String(str).replace(/[=\s]/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    if (/[^A-Za-z0-9_-]/.test(clean) || clean.length % 4 === 1) return null;
    const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
    let o = 0, buf = 0, bits = 0;
    for (let i = 0; i < clean.length; i++) {
      buf = ((buf << 6) | B64.indexOf(clean[i])) & 0xffffff;
      bits += 6;
      if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 255; }
    }
    return out.subarray(0, o);
  }

  function keystream(seed, n) {
    let x = (seed ^ 0x9e3779b9) >>> 0;
    if (x === 0) x = 0x6d2b79f5;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5; x >>>= 0;
      out[i] = (x >>> 24) & 255;
    }
    return out;
  }

  function seedOf(b) { return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0; }

  /** Turn a ticket object into the text that goes after "#s=" in a link. */
  function encodeTicket(obj, salt) {
    const data = new TextEncoder().encode(JSON.stringify(obj));
    const s = salt || randomBytes(4);
    const ks = keystream(seedOf(s), data.length);
    const out = new Uint8Array(4 + data.length);
    out.set(s.slice(0, 4), 0);
    for (let i = 0; i < data.length; i++) out[4 + i] = data[i] ^ ks[i];
    return 'a' + b64urlEncode(out); // "a" = link format 1
  }

  /** Read a link's code back. Returns null for anything broken or tampered with. */
  function decodeTicket(code) {
    try {
      if (typeof code !== 'string') return null;
      const c = code.trim();
      if (c.length < 10 || c.length > 4000 || c[0] !== 'a') return null;
      const bytes = b64urlDecode(c.slice(1));
      if (!bytes || bytes.length < 8) return null;
      const ks = keystream(seedOf(bytes), bytes.length - 4);
      const data = new Uint8Array(bytes.length - 4);
      for (let i = 0; i < data.length; i++) data[i] = bytes[4 + i] ^ ks[i];
      return cleanTicket(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data)));
    } catch (e) {
      return null;
    }
  }

  function cleanTicket(raw) {
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
    if (typeof raw.n !== 'string' || typeof raw.t !== 'string' || typeof raw.i !== 'string') return null;
    const str = (v, max) => (typeof v === 'string' ? Array.from(v).slice(0, max).join('').trim() : '');
    const tk = {
      v: 1,
      i: str(raw.i, 24),
      n: cleanName(raw.n),
      t: cleanName(raw.t),
      ne: str(raw.ne, 8),
      te: str(raw.te, 8),
      e: str(raw.e, 60),
      b: str(raw.b, 24),
      d: typeof raw.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.d) ? raw.d : '',
      l: raw.l === 'es' || raw.l === 'en' ? raw.l : '',
    };
    if (!tk.i || !tk.n || !tk.t || sameName(tk.n, tk.t)) return null;
    return tk;
  }

  function newId() { return b64urlEncode(randomBytes(6)); }

  return {
    MAX_PEOPLE, MAX_NAME, EMOJIS,
    randInt, shuffle, derangement, pickFromPool,
    cleanName, splitNames, nameKey, sameName, nextEmoji, cycleEmoji,
    encodeTicket, decodeTicket, newId, b64urlEncode, b64urlDecode,
  };
});
