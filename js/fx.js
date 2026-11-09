/* Secret Santa: falling snow, confetti, sparkles, sounds and phone buzzes. */
(function () {
  'use strict';

  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  function sprite(size, paint) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    paint(c.getContext('2d'), size);
    return c;
  }
  function glow(rgb) {
    return sprite(64, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, `rgba(${rgb},1)`);
      r.addColorStop(0.35, `rgba(${rgb},.75)`);
      r.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = r;
      g.fillRect(0, 0, s, s);
    });
  }
  const DOT = glow('255,255,255');
  const GOLD = glow('255,214,102');
  const FLAKE = sprite(64, (g, s) => {
    g.translate(s / 2, s / 2);
    g.strokeStyle = 'rgba(255,255,255,.95)';
    g.lineCap = 'round';
    g.lineWidth = 4;
    for (let k = 0; k < 6; k++) {
      g.rotate(Math.PI / 3);
      g.beginPath();
      g.moveTo(0, 0); g.lineTo(0, -26);
      g.moveTo(0, -15); g.lineTo(-8, -22);
      g.moveTo(0, -15); g.lineTo(8, -22);
      g.stroke();
    }
  });

  // ---------- snow (always falling, behind everything) ----------
  (function snow() {
    const cv = document.getElementById('snow');
    if (!cv) return;
    const g = cv.getContext('2d');
    let W = 0, H = 0, flakes = [], running = false, last = 0, windT = Math.random() * 10;

    function make(anywhere) {
      const r = Math.random();
      const size = 1.4 + r * r * 4.8;
      return {
        x: Math.random() * W, y: anywhere ? Math.random() * H : -12,
        s: size, vy: 0.3 + size * 0.17 + Math.random() * 0.3,
        ph: Math.random() * 6.28, sw: 0.4 + Math.random() * 0.9, a: 0.45 + Math.random() * 0.5,
        big: size > 4.9,
      };
    }
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      const want = Math.round(Math.min(170, Math.max(45, (W * H) / 8000)) * (reduce ? 0.35 : 1));
      while (flakes.length < want) flakes.push(make(true));
      flakes.length = want;
    }
    function frame(ts) {
      if (!running) return;
      const dt = last ? Math.min(3, (ts - last) / 16.67) : 1;
      last = ts;
      windT += 0.0025 * dt;
      const wind = Math.sin(windT) * 0.6 + Math.sin(windT * 2.7) * 0.25;
      g.clearRect(0, 0, W, H);
      for (let i = 0; i < flakes.length; i++) {
        let f = flakes[i];
        f.ph += 0.02 * dt;
        f.y += f.vy * dt * (reduce ? 0.5 : 1);
        f.x += (Math.sin(f.ph) * f.sw + wind) * dt * 0.6;
        if (f.y > H + 12) { f = flakes[i] = make(false); }
        if (f.x > W + 12) f.x = -12; else if (f.x < -12) f.x = W + 12;
        g.globalAlpha = f.a;
        if (f.big) {
          const d = f.s * 2.8;
          g.drawImage(FLAKE, f.x - d / 2, f.y - d / 2, d, d);
        } else {
          const d = f.s * 2.2;
          g.drawImage(DOT, f.x - d / 2, f.y - d / 2, d, d);
        }
      }
      g.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    function start() { if (!running) { running = true; last = 0; requestAnimationFrame(frame); } }
    function stop() { running = false; }
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    resize();
    start();
  })();

  // ---------- confetti and sparkles (on top of everything, only while something is flying) ----------
  const cv = document.getElementById('fx');
  const fg = cv.getContext('2d');
  let FW = 0, FH = 0, parts = [], running = false, last = 0;
  const COLORS = ['#e03a3e', '#ffc94a', '#22a06b', '#ffffff', '#5cc8ff', '#ff8fb1', '#f7f0d6'];

  function resizeFx() {
    FW = window.innerWidth; FH = window.innerHeight;
    cv.width = Math.round(FW * DPR); cv.height = Math.round(FH * DPR);
    cv.style.width = FW + 'px'; cv.style.height = FH + 'px';
    fg.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resizeFx);
  resizeFx();

  function star(g, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
  }

  function loop(ts) {
    const dt = last ? Math.min(3, (ts - last) / 16.67) : 1;
    last = ts;
    fg.clearRect(0, 0, FW, FH);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.kind === 'c') {
        const drag = Math.pow(0.986, dt);
        p.vx *= drag;
        p.vy = p.vy * drag + 0.18 * dt;
        if (p.vy > p.term) p.vy = p.term;
        p.x += (p.vx + Math.sin(p.age * 0.08 + p.seed) * 0.7) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.flip += p.vf * dt;
        if (p.y > FH + 30 || p.age > p.max) { parts.splice(i, 1); continue; }
        fg.globalAlpha = p.age > p.max - 40 ? Math.max(0, (p.max - p.age) / 40) : 1;
        fg.save();
        fg.translate(p.x, p.y);
        fg.rotate(p.rot);
        fg.scale(1, Math.cos(p.flip));
        fg.fillStyle = p.color;
        if (p.shape === 0) fg.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        else if (p.shape === 1) { fg.beginPath(); fg.arc(0, 0, p.w / 2, 0, 6.2832); fg.fill(); }
        else { star(fg, p.w * 0.8); fg.fill(); }
        fg.restore();
      } else {
        const drag = Math.pow(0.95, dt);
        p.vx *= drag;
        p.vy = p.vy * drag - 0.03 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.age > p.max) { parts.splice(i, 1); continue; }
        const k = p.age / p.max;
        fg.globalAlpha = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
        const s = p.size * (1 - k * 0.4);
        if (p.spin) {
          fg.save();
          fg.translate(p.x, p.y);
          fg.rotate(p.age * p.spin);
          fg.drawImage(p.img, -s / 2, -s / 2, s, s);
          fg.restore();
        } else {
          fg.drawImage(p.img, p.x - s / 2, p.y - s / 2, s, s);
        }
      }
    }
    fg.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(loop);
    else { running = false; last = 0; fg.clearRect(0, 0, FW, FH); }
  }
  function kick() { if (!running) { running = true; last = 0; requestAnimationFrame(loop); } }

  function confettiPiece(x, y, vx, vy) {
    const shape = Math.random() < 0.6 ? 0 : (Math.random() < 0.6 ? 1 : 2);
    const w = 6 + Math.random() * 6;
    return {
      kind: 'c', x, y, vx, vy, w, h: shape === 0 ? 9 + Math.random() * 9 : w, shape,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
      flip: Math.random() * 6.28, vf: 0.05 + Math.random() * 0.12,
      term: 2.5 + Math.random() * 2.5, seed: Math.random() * 6.28, age: 0, max: 420,
    };
  }

  /** A party-popper burst from one point. */
  function burst(x, y, n = 150) {
    const count = reduce ? Math.round(n / 5) : n;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
      const sp = 5 + Math.random() * 11;
      parts.push(confettiPiece(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 2));
    }
    kick();
  }

  /** Confetti falling from the top of the screen for a while. */
  function rain(ms = 3000) {
    const end = performance.now() + ms;
    const rate = reduce ? 1 : 4;
    (function drip() {
      if (performance.now() > end || document.hidden) return;
      for (let i = 0; i < rate; i++) parts.push(confettiPiece(Math.random() * FW, -20, (Math.random() - 0.5) * 2, 1 + Math.random() * 2));
      kick();
      setTimeout(drip, 60);
    })();
  }

  /** The slip of paper turns into sparkles and snowflakes that float away. */
  function poof(rect, n = 90) {
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const count = reduce ? 24 : n;
    for (let i = 0; i < count; i++) {
      const x = rect.left + Math.random() * rect.width, y = rect.top + Math.random() * rect.height;
      const dx = (x - cx) / (rect.width / 2), dy = (y - cy) / (rect.height / 2);
      const r = Math.random();
      parts.push({
        kind: 's', x, y,
        vx: dx * (2 + Math.random() * 3) + (Math.random() - 0.5) * 1.5,
        vy: dy * (1.5 + Math.random() * 2) - 1.5 - Math.random() * 2.5,
        size: r < 0.25 ? 18 + Math.random() * 14 : 8 + Math.random() * 14,
        img: r < 0.25 ? FLAKE : (r < 0.6 ? GOLD : DOT),
        spin: r < 0.25 ? (Math.random() - 0.5) * 0.1 : 0,
        age: 0, max: 45 + Math.random() * 50,
      });
    }
    kick();
  }

  /** Little twinkles popping up around the edges of a box for a while. */
  function twinkle(getRect, ms = 2600) {
    if (reduce) return;
    const end = performance.now() + ms;
    (function one() {
      if (performance.now() > end || document.hidden) return;
      const r = getRect();
      if (!r || !r.width) return;
      const pad = 16, side = Math.floor(Math.random() * 4), u = Math.random();
      let x, y;
      if (side === 0) { x = r.left - pad + u * (r.width + pad * 2); y = r.top - pad; }
      else if (side === 1) { x = r.right + pad; y = r.top - pad + u * (r.height + pad * 2); }
      else if (side === 2) { x = r.left - pad + u * (r.width + pad * 2); y = r.bottom + pad; }
      else { x = r.left - pad; y = r.top - pad + u * (r.height + pad * 2); }
      parts.push({ kind: 's', x, y, vx: 0, vy: -0.25, size: 12 + Math.random() * 16, img: Math.random() < 0.5 ? GOLD : FLAKE, spin: 0.05, age: 0, max: 40 + Math.random() * 30 });
      kick();
      setTimeout(one, 110);
    })();
  }

  // ---------- sounds (made on the fly, no sound files) ----------
  const sound = (function () {
    let ctx = null, master = null, noiseBuf = null, enabled = true;

    function ac() {
      if (!enabled) return null;
      try {
        if (!ctx) {
          const C = window.AudioContext || window.webkitAudioContext;
          if (!C) return null;
          ctx = new C();
          master = ctx.createGain();
          master.gain.value = 0.7;
          master.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
      } catch (e) {
        return null;
      }
    }
    function env(g, t, peak, attack, decay) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }
    function tone(freq, t, decay, peak, type, endFreq) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + decay);
      env(g, t, peak, 0.005, decay);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + decay + 0.06);
    }
    function bell(freq, t, decay, peak) {
      tone(freq, t, decay, peak);
      tone(freq * 2, t, decay * 0.5, peak * 0.3);
      tone(freq * 3.01, t, decay * 0.25, peak * 0.12);
    }
    function noise(t, dur, peak, type, f0, f1, q) {
      if (!noiseBuf) {
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.Q.value = q || 1;
      f.frequency.setValueAtTime(f0, t);
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain();
      env(g, t, peak, Math.min(0.02, dur / 4), dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t, Math.random() * 0.4);
      src.stop(t + dur + 0.1);
    }
    const play = (fn) => () => { const c = ac(); if (c) { try { fn(c.currentTime + 0.01); } catch (e) { /* no sound */ } } };

    return {
      get enabled() { return enabled; },
      set enabled(v) { enabled = !!v; },
      unlock() { ac(); },
      jingle: play((t) => {            // sleigh bells while the sack shakes
        for (let i = 0; i < 13; i++) noise(t + i * 0.095 + Math.random() * 0.02, 0.07, 0.11, 'highpass', 6500);
        for (let i = 0; i < 6; i++) bell(2500 + Math.random() * 1500, t + 0.05 + i * 0.2, 0.25, 0.035);
      }),
      whoosh: play((t) => noise(t, 0.45, 0.17, 'bandpass', 300, 2600, 0.8)),
      tada: play((t) => {              // the name appears
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, t + i * 0.09, 1.1, 0.15));
        [1046.5, 1318.5, 1568].forEach((f) => bell(f, t + 0.42, 1.6, 0.07));
      }),
      poof: play((t) => {              // the name disappears
        noise(t, 0.55, 0.2, 'lowpass', 2800, 180, 0.7);
        bell(1568, t + 0.05, 0.5, 0.04);
        bell(2093, t + 0.12, 0.5, 0.03);
      }),
      click: play((t) => { tone(1300, t, 0.05, 0.12, 'square'); tone(650, t + 0.03, 0.08, 0.1, 'triangle'); }),
      plop: play((t) => tone(420, t, 0.16, 0.13, 'sine', 900)),
      fanfare: play((t) => {
        [392, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, t + i * 0.12, 0.9, 0.12));
      }),
    };
  })();

  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* not supported */ }
  }

  window.SantaFX = { reduce, burst, rain, poof, twinkle, sound, buzz };
})();
