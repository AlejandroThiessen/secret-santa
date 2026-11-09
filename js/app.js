/* Secret Santa: the screens and what every button does. */
(function () {
  'use strict';

  const L = window.SantaLogic;
  const I18N = window.SantaI18n;
  const FX = window.SantaFX;
  const app = document.getElementById('app');
  const sheetRoot = document.getElementById('sheet-root');
  const reduce = FX.reduce;
  const canAnimate = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';

  // ---------- little helpers ----------
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const tone = (i) => 'tone-' + (i % 6);

  /** Run a Web Animation; on browsers without them, jump straight to the last frame. */
  function anim(el, frames, opts) {
    if (canAnimate) {
      try {
        const a = el.animate(frames, opts);
        const done = new Promise((res) => { a.onfinish = res; a.oncancel = res; });
        return { finished: Promise.race([done, sleep((opts.duration || 0) + (opts.delay || 0) + 500)]) };
      } catch (e) { /* fall through */ }
    }
    const last = frames[frames.length - 1];
    Object.keys(last).forEach((k) => { if (k !== 'offset' && k !== 'easing') el.style[k] = last[k]; });
    return { finished: Promise.resolve() };
  }

  function makeStore(area) {
    let s = null;
    try { s = window[area]; s.setItem('__santa', '1'); s.removeItem('__santa'); } catch (e) { s = null; }
    return {
      ok: !!s,
      get(k) { if (!s) return null; try { const v = s.getItem(k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
      set(k, v) { if (!s) return false; try { s.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
      del(k) { if (!s) return; try { s.removeItem(k); } catch (e) { /* ignore */ } },
    };
  }
  const store = makeStore('localStorage');
  const session = makeStore('sessionStorage');
  const K = {
    hat: 'santa.hat.v1',          // the organizer's Secret Santa on this device
    draft: 'santa.draft.v1',      // the setup form while it is being filled in
    ui: 'santa.ui.v1',            // language and sound
    pending: 'santa.pending.v1',  // a name pulled but not hidden yet (survives a reload of this tab only)
    lock: (id, name) => 'santa.lock.v1.' + id + '.' + L.nameKey(name), // "already pulled on this phone"
  };

  // ---------- language and sound ----------
  const ui = Object.assign({ lang: '', sound: true }, store.get(K.ui) || {});
  const browserLang = /^es\b/i.test(navigator.language || '') ? 'es' : 'en';
  let lang = ui.lang === 'es' || ui.lang === 'en' ? ui.lang : browserLang;
  const t = (k, p) => I18N.t(lang, k, p);
  FX.sound.enabled = ui.sound !== false;

  const langBtn = $('#langBtn');
  const soundBtn = $('#soundBtn');
  let rerender = null;

  function paintChrome() {
    document.documentElement.lang = lang;
    document.title = t('appName') + ' 🎅';
    $('.brand-name').textContent = t('appName');
    langBtn.textContent = lang === 'en' ? 'ES' : 'EN';
    langBtn.setAttribute('aria-label', t('switchLang'));
    langBtn.title = t('switchLang');
    soundBtn.textContent = FX.sound.enabled ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-label', FX.sound.enabled ? t('soundOff') : t('soundOn'));
    soundBtn.title = soundBtn.getAttribute('aria-label');
  }
  langBtn.addEventListener('click', () => {
    if (!rerender) return;
    lang = lang === 'en' ? 'es' : 'en';
    ui.lang = lang;
    store.set(K.ui, ui);
    paintChrome();
    rerender();
  });
  soundBtn.addEventListener('click', () => {
    FX.sound.enabled = !FX.sound.enabled;
    ui.sound = FX.sound.enabled;
    store.set(K.ui, ui);
    paintChrome();
    FX.sound.plop();
  });

  // ---------- decorations ----------
  const BULBS = ['#ff4d5a', '#ffd23f', '#3ddc84', '#4fc3ff', '#ff8ad8'];
  function buildLights() {
    const el = $('.lights');
    if (!el) return;
    const W = document.documentElement.clientWidth || window.innerWidth;
    const n = Math.max(6, Math.round(W / 54));
    const step = W / n;
    let d = 'M 0 6';
    let bulbs = '';
    for (let i = 0; i < n; i++) {
      const xm = i * step + step / 2;
      d += ` Q ${xm.toFixed(1)} 30 ${((i + 1) * step).toFixed(1)} 6`;
      const tilt = ((i * 37) % 21) - 10;
      bulbs += `<span class="bulb" style="left:${xm.toFixed(1)}px;--c:${BULBS[i % BULBS.length]};--d:${((i * 0.37) % 2.4).toFixed(2)}s;--r:${tilt}deg"></span>`;
    }
    el.innerHTML = `<svg width="${W}" height="40" viewBox="0 0 ${W} 40" focusable="false"><path d="${d}" fill="none" stroke="#24324d" stroke-width="2.5"/></svg>${bulbs}`;
  }
  function buildStars() {
    const el = $('.sky-stars');
    if (!el) return;
    let h = '';
    for (let i = 0; i < 46; i++) {
      h += `<i style="left:${(Math.random() * 100).toFixed(2)}%;top:${(Math.random() * 100).toFixed(2)}%;--s:${(1 + Math.random() * 2).toFixed(1)}px;--d:${(Math.random() * 4).toFixed(2)}s"></i>`;
    }
    el.innerHTML = h;
  }

  let svgId = 0;
  function starPoints(cx, cy, R, r) {
    let pts = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R;
      pts += `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)} `;
    }
    return pts;
  }

  /** Santa's sack, with `count` (0-5) paper slips peeking out of the top. */
  function sackSVG(count) {
    const id = 'sk' + (++svgId);
    const cx = 120, cy = 78, rx = 80, ry = 20;
    const fluff = (from, to, steps, r0, fill, dy) => {
      let s = '';
      for (let k = 0; k <= steps; k++) {
        const a = from + ((to - from) * k) / steps;
        s += `<circle cx="${(cx + rx * Math.cos(a)).toFixed(1)}" cy="${(cy + (dy || 0) + ry * Math.sin(a)).toFixed(1)}" r="${r0 + (k % 2 ? 1.6 : 0)}" fill="${fill}"/>`;
      }
      return s;
    };
    // x, bottom y, tilt, width, height
    const SLIPS = [[118, 96, 5, 34, 64], [87, 98, -17, 32, 56], [150, 98, 19, 32, 54], [103, 100, -5, 28, 42], [167, 100, 33, 28, 40]];
    const slips = SLIPS.slice(0, Math.max(0, Math.min(5, count | 0))).map(([x, y, r, w, h]) => (
      `<g transform="translate(${x} ${y}) rotate(${r})">` +
      `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" rx="3" fill="#fff6e3" stroke="#d6bf94" stroke-width="1.3"/>` +
      `<path d="M${-w / 2 + 4} ${-h + 14}h${w - 8}" stroke="#e6d3ab" stroke-width="1.3"/>` +
      `<path d="M${-w / 2 + 7} ${-h + 25}q5 -4 9 0t9 0" stroke="#c9a978" stroke-width="1.5" fill="none" opacity=".75"/></g>`
    )).join('');
    return `<svg viewBox="0 0 240 256" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="${id}b" cx="36%" cy="38%" r="78%"><stop offset="0" stop-color="#f45b5b"/><stop offset=".55" stop-color="#d12f35"/><stop offset="1" stop-color="#8a1521"/></radialGradient>
        <linearGradient id="${id}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a0710"/><stop offset="1" stop-color="#6d1320"/></linearGradient>
      </defs>
      <ellipse cx="120" cy="247" rx="80" ry="8" fill="rgba(0,0,0,.28)"/>
      <path d="M42 80C22 118 8 176 30 210C48 238 88 244 120 244C152 244 192 238 210 210C232 176 218 118 198 80Z" fill="url(#${id}b)"/>
      <path d="M76 102C66 142 66 186 82 226M164 102C176 142 176 188 160 228" stroke="#000" stroke-opacity=".14" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M60 126C54 154 56 180 66 202" stroke="#fff" stroke-opacity=".22" stroke-width="5" fill="none" stroke-linecap="round"/>
      <polygon points="${starPoints(120, 168, 27, 11.5)}" fill="#ffd25e" stroke="#d9971b" stroke-width="2.5" stroke-linejoin="round"/>
      <polygon points="${starPoints(120, 168, 20, 8.4)}" fill="none" stroke="#fff4c7" stroke-width="1.6" stroke-dasharray="3 3" stroke-linejoin="round"/>
      <ellipse cx="${cx}" cy="${cy}" rx="76" ry="17" fill="url(#${id}i)"/>
      <path d="M40 78A80 20 0 0 1 200 78" stroke="#e5eaf3" stroke-width="18" fill="none"/>
      ${fluff(Math.PI, 2 * Math.PI, 10, 9.5, '#e5eaf3')}
      ${slips}
      ${fluff(0, Math.PI, 12, 11.5, '#d7deea', 3.5)}
      <path d="M40 78A80 20 0 0 0 200 78" stroke="#ffffff" stroke-width="19" fill="none"/>
      ${fluff(0, Math.PI, 12, 10.5, '#ffffff')}
      <circle cx="78" cy="90" r="2.2" fill="#fff" opacity=".9"/><circle cx="150" cy="96" r="1.8" fill="#fff"/>
    </svg>`;
  }

  /** A golden padlock with a sprig of holly. */
  function lockSVG() {
    const id = 'lk' + (++svgId);
    return `<svg viewBox="0 0 140 160" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe28f"/><stop offset=".55" stop-color="#f6b733"/><stop offset="1" stop-color="#d98d12"/></linearGradient>
        <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa5b8"/><stop offset=".5" stop-color="#f4f7fb"/><stop offset="1" stop-color="#9aa5b8"/></linearGradient>
      </defs>
      <ellipse cx="70" cy="153" rx="48" ry="6" fill="rgba(0,0,0,.28)"/>
      <g class="lock-shackle"><path d="M38 78V52a32 32 0 0 1 64 0V78" fill="none" stroke="url(#${id}s)" stroke-width="14" stroke-linecap="round"/></g>
      <rect x="18" y="70" width="104" height="78" rx="18" fill="url(#${id}g)" stroke="#b9770f" stroke-width="3"/>
      <rect x="30" y="78" width="80" height="9" rx="4.5" fill="#fff3c4" opacity=".6"/>
      <circle cx="70" cy="104" r="10" fill="#6b3d06"/>
      <rect x="65" y="108" width="10" height="22" rx="5" fill="#6b3d06"/>
      <path d="M96 76c6-12 20-14 28-8-6 1-8 6-6 11-7-3-12 0-14 6-1-5-4-8-8-9z" fill="#1d8a5a" stroke="#0f5c3a" stroke-width="1.5"/>
      <path d="M96 76c-4-12-16-18-26-14 6 2 7 7 5 12 7-3 12 1 13 7 2-5 4-6 8-5z" fill="#239b65" stroke="#0f5c3a" stroke-width="1.5"/>
      <circle cx="95" cy="78" r="5" fill="#e03a3e"/><circle cx="102" cy="82" r="4.5" fill="#c62a33"/><circle cx="90" cy="84" r="4.5" fill="#e8484c"/>
    </svg>`;
  }

  // ---------- screens: the basics ----------
  let token = 0;
  function show(html, name, opts) {
    const o = opts || {};
    token++;
    closeSheet(true);
    document.body.setAttribute('data-screen', name);
    rerender = o.rerender || null;
    document.body.classList.toggle('lang-locked', !rerender);
    app.innerHTML = `<section class="screen screen-${name}">${html}</section>`;
    window.scrollTo(0, 0);
    const sec = app.firstElementChild;
    const h = sec.querySelector('h1, h2');
    if (h) { h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (e) { /* old browser */ } }
    wake(!!o.awake);
    return sec;
  }

  // Keep the screen on while a phone is being passed around.
  let wakeLock = null, wantWake = false;
  async function wake(on) {
    wantWake = on;
    try {
      if (on && !wakeLock && navigator.wakeLock && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) {
        const w = wakeLock;
        wakeLock = null;
        await w.release();
      }
    } catch (e) { wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (wantWake && document.visibilityState === 'visible') wake(true); });

  function fmtDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '';
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    try {
      return new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(d);
    } catch (e) { return iso; }
  }
  function eventInfo(ev) {
    const bits = [];
    if (ev.budget) bits.push(`<span class="info">🎁 ${esc(t('budgetIs', { budget: ev.budget }))}</span>`);
    if (ev.date) bits.push(`<span class="info">📅 ${esc(t('exchangeOn', { date: fmtDate(ev.date) }))}</span>`);
    return (ev.event ? `<div class="ribbon"><span>${esc(ev.event)}</span></div>` : '') +
      (bits.length ? `<div class="infos">${bits.join('')}</div>` : '');
  }
  const evOf = (tk) => ({ event: tk.e, budget: tk.b, date: tk.d });

  // ---------- bottom sheets, confirmations, toasts ----------
  let sheetState = null;
  function openSheet(html, onAct, onDismiss) {
    closeSheet(true);
    sheetRoot.innerHTML = `<div class="sheet-backdrop" data-act="dismiss"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
    sheetRoot.classList.add('open');
    const st = { onDismiss };
    sheetState = st;
    sheetRoot.onclick = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || sheetState !== st) return;
      if (b.getAttribute('data-act') === 'dismiss') { closeSheet(); return; }
      onAct(b.getAttribute('data-act'), b);
    };
    nextFrame().then(() => { if (sheetState === st) sheetRoot.classList.add('show'); });
    setTimeout(() => {
      const first = $('.sheet button', sheetRoot);
      if (sheetState === st && first) try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }, 80);
  }
  function closeSheet(instant) {
    const st = sheetState;
    if (!st) return;
    sheetState = null;
    sheetRoot.classList.remove('show');
    const finish = () => { if (!sheetState) { sheetRoot.classList.remove('open'); sheetRoot.innerHTML = ''; } };
    if (instant) finish(); else setTimeout(finish, 320);
    if (st.onDismiss) st.onDismiss();
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  function confirmSheet(o) {
    return new Promise((resolve) => {
      openSheet(
        `<h3 class="sheet-title">${esc(o.title)}</h3>${o.body ? `<p class="sheet-body">${esc(o.body)}</p>` : ''}
        <div class="stack">
          <button type="button" class="btn ${o.danger ? 'danger' : 'primary'} big" data-act="yes">${esc(o.yes)}</button>
          <button type="button" class="btn soft" data-act="no">${esc(o.no)}</button>
        </div>`,
        (act) => { resolve(act === 'yes'); closeSheet(); },
        () => resolve(false)
      );
    });
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    nextFrame().then(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3000);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* try the old way */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  // ---------- the organizer's data ----------
  function loadDraft() {
    const d = store.get(K.draft) || {};
    const people = Array.isArray(d.people)
      ? d.people.filter((p) => p && typeof p.name === 'string' && L.cleanName(p.name))
        .map((p) => ({ name: L.cleanName(p.name), emoji: typeof p.emoji === 'string' && p.emoji ? p.emoji : '🎁' }))
        .slice(0, L.MAX_PEOPLE)
      : [];
    return {
      people,
      event: typeof d.event === 'string' ? d.event : '',
      budget: typeof d.budget === 'string' ? d.budget : '',
      date: typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : '',
      mode: d.mode === 'pass' ? 'pass' : 'links',
    };
  }
  const saveDraft = (d) => store.set(K.draft, d);

  function loadHat() {
    const h = store.get(K.hat);
    if (!h || h.v !== 1 || typeof h.id !== 'string' || !Array.isArray(h.people) || h.people.length < 2) return null;
    const n = h.people.length;
    const okIdx = (a) => Array.isArray(a) && a.every((x) => Number.isInteger(x) && x >= 0 && x < n) && new Set(a).size === a.length;
    if (h.mode === 'pass') {
      if (!okIdx(h.waiting) || !okIdx(h.pool) || h.waiting.length !== h.pool.length) return null;
    } else if (h.mode === 'links') {
      if (!Array.isArray(h.tickets) || h.tickets.length !== n) return null;
      if (!Array.isArray(h.sent) || h.sent.length !== n) h.sent = h.people.map(() => false);
    } else {
      return null;
    }
    return h;
  }

  function createHat(d) {
    const people = d.people.map((p) => ({ name: p.name, emoji: p.emoji }));
    const hat = {
      v: 1, id: L.newId(), mode: d.mode, lang, people, created: Date.now(),
      event: d.event.trim(), budget: d.budget.trim(), date: d.date,
    };
    if (hat.mode === 'pass') {
      hat.waiting = people.map((_, i) => i);
      hat.pool = people.map((_, i) => i);
    } else {
      // The whole draw happens right now; each link carries one person's result.
      const to = L.derangement(people.length);
      hat.tickets = people.map((p, i) => {
        const g = people[to[i]];
        const tk = { v: 1, i: hat.id, n: p.name, t: g.name, ne: p.emoji, te: g.emoji, l: lang };
        if (hat.event) tk.e = hat.event;
        if (hat.budget) tk.b = hat.budget;
        if (hat.date) tk.d = hat.date;
        return L.encodeTicket(tk);
      });
      hat.sent = people.map(() => false);
    }
    store.set(K.hat, hat);
    return hat;
  }

  function ticketURL(code) {
    return location.href.split('#')[0].split('?')[0] + '#s=' + code;
  }

  async function startOver(hat) {
    const ok = await confirmSheet({
      title: t('startOverQ'),
      body: hat.mode === 'pass' ? t('startOverPass') : t('startOverLinks'),
      yes: t('startOverYes'), no: t('cancel'), danger: true,
    });
    if (!ok) return;
    saveDraft({
      people: hat.people.map((p) => ({ name: p.name, emoji: p.emoji })),
      event: hat.event || '', budget: hat.budget || '', date: hat.date || '', mode: hat.mode,
    });
    store.del(K.hat);
    session.del(K.pending);
    screenSetup();
  }

  // ---------- screen: setup ----------
  function modeOption(value, icon, title, desc, current) {
    const on = current === value;
    return `<label class="mode ${on ? 'on' : ''}">
      <input type="radio" name="mode" value="${value}" ${on ? 'checked' : ''}>
      <span class="mode-ico" aria-hidden="true">${icon}</span>
      <span class="mode-text"><b>${esc(title)}</b><small>${esc(desc)}</small></span>
    </label>`;
  }

  function screenSetup() {
    const d = loadDraft();
    const fresh = new Set();
    const sec = show(`
      <div class="hero">
        <div class="hero-sack">${sackSVG(5)}</div>
        <h1 class="title">${esc(t('appName'))}</h1>
        <p class="tagline">${esc(t('tagline'))}</p>
      </div>
      ${store.ok ? '' : `<p class="warn">${esc(t('noStorage'))}</p>`}
      <div class="card candy">
        <h2 class="card-title"><span class="num">1</span><span>${esc(t('setupTitle'))}</span></h2>
        <form class="add-row" id="addForm" autocomplete="off">
          <textarea id="nameIn" class="input name-in" rows="1" wrap="off" autocapitalize="words" autocorrect="off" spellcheck="false"
            enterkeyhint="enter" placeholder="${esc(t('namePlaceholder'))}" aria-label="${esc(t('namePlaceholder'))}"></textarea>
          <button class="btn green" type="submit">${esc(t('add'))}</button>
        </form>
        <p class="err" id="nameErr" role="alert"></p>
        <ul class="chips" id="chips"></ul>
        <p class="count" id="countLine" aria-live="polite"></p>
        <p class="hint" id="emojiHint">${esc(t('emojiHint'))}</p>
        <p class="hint">${esc(t('pasteHint'))}</p>
      </div>
      <div class="card">
        <h2 class="card-title"><span class="num">2</span><span>${esc(t('detailsTitle'))} <small>(${esc(t('optional'))})</small></span></h2>
        <label class="field"><span>${esc(t('eventLabel'))}</span>
          <input id="evIn" class="input" maxlength="50" placeholder="${esc(t('eventPlaceholder'))}" value="${esc(d.event)}"></label>
        <div class="field-row">
          <label class="field"><span>${esc(t('budgetLabel'))}</span>
            <input id="budIn" class="input" maxlength="20" placeholder="${esc(t('budgetPlaceholder'))}" value="${esc(d.budget)}"></label>
          <label class="field"><span>${esc(t('dateLabel'))}</span>
            <input id="dateIn" class="input" type="date" value="${esc(d.date)}"></label>
        </div>
      </div>
      <div class="card">
        <h2 class="card-title"><span class="num">3</span><span>${esc(t('modeTitle'))}</span></h2>
        <div class="modes" role="radiogroup" aria-label="${esc(t('modeTitle'))}">
          ${modeOption('links', '💌', t('modeLinksTitle'), t('modeLinksDesc'), d.mode)}
          ${modeOption('pass', '📱', t('modePassTitle'), t('modePassDesc'), d.mode)}
        </div>
      </div>
      <p class="err center" id="startErr" role="alert"></p>
      <div class="stack narrow"><button type="button" class="btn primary big" id="startBtn">${esc(t('startBtn'))}</button></div>
    `, 'setup', { rerender: screenSetup });

    const chips = $('#chips', sec);
    const nameIn = $('#nameIn', sec);
    const nameErr = $('#nameErr', sec);
    const countLine = $('#countLine', sec);
    const startErr = $('#startErr', sec);

    function renderChips() {
      chips.innerHTML = d.people.map((p, i) => `<li class="chip ${tone(i)} ${fresh.has(i) ? 'fresh' : ''}">
          <button type="button" class="chip-emoji" data-emoji="${i}" aria-label="${esc(t('changeEmoji', { name: p.name }))}">${esc(p.emoji)}</button>
          <span class="chip-name">${esc(p.name)}</span>
          <button type="button" class="chip-x" data-x="${i}" aria-label="${esc(t('removeName', { name: p.name }))}">×</button>
        </li>`).join('');
      fresh.clear();
      const n = d.people.length;
      countLine.textContent = n ? t('countPeople', { n }) + (n < 3 ? ' · ' + t('needThree') : ' ✓') : '';
      countLine.classList.toggle('ok', n >= 3);
      $('#emojiHint', sec).hidden = n === 0;
      if (n >= 3) startErr.textContent = '';
    }

    function addFrom(text) {
      const names = L.splitNames(text);
      if (!names.length) return false;
      let err = '', added = 0;
      for (const nm of names) {
        if (d.people.length >= L.MAX_PEOPLE) { err = t('tooMany', { max: L.MAX_PEOPLE }); break; }
        if (d.people.some((p) => L.sameName(p.name, nm))) { err = t('dupName', { name: nm }); continue; }
        d.people.push({ name: nm, emoji: L.nextEmoji(d.people.map((p) => p.emoji)) });
        fresh.add(d.people.length - 1);
        added++;
      }
      saveDraft(d);
      renderChips();
      nameErr.textContent = err;
      if (added) FX.sound.plop();
      return added > 0 || !err;
    }

    $('#addForm', sec).addEventListener('submit', (e) => {
      e.preventDefault();
      if (addFrom(nameIn.value)) nameIn.value = '';
      nameIn.focus();
    });
    nameIn.addEventListener('paste', (e) => {
      const cd = e.clipboardData || window.clipboardData;
      const text = cd ? cd.getData('text') : '';
      if (/[\n\r,;\t]/.test(text)) {
        e.preventDefault();
        addFrom(text);
      }
    });
    // A list can arrive in many ways (paste, a keyboard's clipboard button, dictation): split on line breaks.
    nameIn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (addFrom(nameIn.value)) nameIn.value = '';
      }
    });
    nameIn.addEventListener('input', () => {
      if (nameErr.textContent) nameErr.textContent = '';
      if (/[\n\r]/.test(nameIn.value)) {
        addFrom(nameIn.value);
        nameIn.value = '';
      }
    });

    chips.addEventListener('click', (e) => {
      const em = e.target.closest('[data-emoji]');
      const x = e.target.closest('[data-x]');
      if (em) {
        const i = +em.getAttribute('data-emoji');
        const others = d.people.filter((_, k) => k !== i).map((p) => p.emoji);
        d.people[i].emoji = L.cycleEmoji(d.people[i].emoji, others);
        em.textContent = d.people[i].emoji;
        em.classList.remove('boing');
        void em.offsetWidth;
        em.classList.add('boing');
        saveDraft(d);
        FX.sound.plop();
      } else if (x) {
        d.people.splice(+x.getAttribute('data-x'), 1);
        saveDraft(d);
        renderChips();
      }
    });

    const bindText = (id, key) => {
      const el = $(id, sec);
      el.addEventListener('input', () => { d[key] = el.value; saveDraft(d); });
    };
    bindText('#evIn', 'event');
    bindText('#budIn', 'budget');
    bindText('#dateIn', 'date');
    $('#dateIn', sec).addEventListener('change', (e) => { d.date = e.target.value; saveDraft(d); });

    $$('.mode input', sec).forEach((r) => r.addEventListener('change', () => {
      d.mode = r.value;
      saveDraft(d);
      $$('.mode', sec).forEach((m) => m.classList.toggle('on', $('input', m).checked));
    }));

    $('#startBtn', sec).addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (nameIn.value.trim()) addFrom(nameIn.value) && (nameIn.value = '');
      if (d.people.length < 3) {
        startErr.textContent = t('needThree');
        btn.classList.remove('nope');
        void btn.offsetWidth;
        btn.classList.add('nope');
        return;
      }
      btn.disabled = true;
      FX.sound.unlock();
      createHat(d);
      await fillSack(d.people);
      organizerRoute();
    });

    renderChips();
  }

  /** Names fly into the sack after "Fill Santa's sack!". */
  async function fillSack(people) {
    if (reduce || !canAnimate) return;
    const ov = document.createElement('div');
    ov.className = 'fill-overlay';
    ov.innerHTML = `<div class="fill-box"><div class="sack-wrap fill-sack">${sackSVG(5)}</div><p class="fill-text">${esc(t('filling'))}</p></div>`;
    document.body.appendChild(ov);
    await nextFrame();
    ov.classList.add('show');
    await sleep(300);
    const sack = $('.fill-sack', ov);
    const r = sack.getBoundingClientRect();
    const tx = r.left + r.width / 2, ty = r.top + r.height * 0.3;
    const list = people.slice(0, 24);
    const gap = Math.max(70, Math.min(160, 1700 / list.length));
    list.forEach((p, i) => setTimeout(() => {
      const s = document.createElement('div');
      s.className = 'fill-slip';
      s.textContent = p.emoji + ' ' + p.name;
      ov.appendChild(s);
      const sw = s.offsetWidth, sh = s.offsetHeight;
      const left = i % 2 === 0;
      const x0 = left ? -sw / 2 - 10 : window.innerWidth + sw / 2 + 10;
      const y0 = window.innerHeight * (0.15 + Math.random() * 0.55);
      const mx = (x0 + tx) / 2, my = Math.min(y0, ty) - 90 - Math.random() * 70;
      const spin = left ? 1 : -1;
      anim(s, [
        { transform: `translate(${x0 - sw / 2}px, ${y0 - sh / 2}px) rotate(${-30 * spin}deg) scale(1)`, opacity: 1 },
        { transform: `translate(${mx - sw / 2}px, ${my - sh / 2}px) rotate(${150 * spin}deg) scale(.85)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${tx - sw / 2}px, ${ty - sh / 2}px) rotate(${330 * spin}deg) scale(.15)`, opacity: 0.3 },
      ], { duration: 850, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' }).finished.then(() => {
        s.remove();
        sack.classList.remove('gulp');
        void sack.offsetWidth;
        sack.classList.add('gulp');
        FX.sound.plop();
      });
    }, i * gap));
    await sleep(list.length * gap + 1050);
    ov.classList.remove('show');
    await sleep(320);
    ov.remove();
  }

  // ---------- pass-the-phone mode ----------
  function screenPassList(hat) {
    const left = hat.pool.length;
    const sec = show(`
      ${eventInfo(hat)}
      <h2 class="screen-title">${esc(t('passTitle'))}</h2>
      <p class="screen-sub">${esc(t('passSub'))}</p>
      <div class="sack-count"><div class="sack-wrap mini">${sackSVG(Math.min(left, 5))}</div><span class="badge">${esc(t('left', { n: left }))}</span></div>
      <div class="people">
        ${hat.people.map((p, i) => {
          const done = hat.waiting.indexOf(i) < 0;
          return `<button type="button" class="person ${tone(i)} ${done ? 'done' : ''}" data-i="${i}" ${done ? 'disabled' : ''}>
            <span class="p-emoji" aria-hidden="true">${esc(p.emoji)}</span><span class="p-name">${esc(p.name)}</span>
            ${done ? `<span class="p-done">${esc(t('done'))}</span>` : ''}</button>`;
        }).join('')}
      </div>
      <div class="center"><button type="button" class="link-btn" id="overBtn">${esc(t('startOver'))}</button></div>
    `, 'pass', { rerender: () => organizerRoute(), awake: true });
    $('.people', sec).addEventListener('click', (e) => {
      const b = e.target.closest('.person');
      if (b && !b.disabled) screenPassConfirm(hat, +b.getAttribute('data-i'));
    });
    $('#overBtn', sec).addEventListener('click', () => startOver(hat));
  }

  function screenPassConfirm(hat, i, resumeTarget) {
    const p = hat.people[i];
    const sec = show(`
      <div class="who-big"><span class="avatar">${esc(p.emoji)}</span></div>
      <h2 class="screen-title">${esc(t('areYou', { name: p.name }))}</h2>
      ${resumeTarget ? `<p class="screen-sub">${esc(t('resumeSub'))}</p>` : ''}
      <p class="screen-sub strong">${esc(t('noPeek'))}</p>
      <div class="stack narrow">
        <button type="button" class="btn primary big" id="yesBtn">${esc(t('yesMe', { name: p.name }))}</button>
        ${resumeTarget ? '' : `<button type="button" class="btn ghost" id="backBtn">${esc(t('goBack'))}</button>`}
      </div>`, 'confirm', { rerender: () => screenPassConfirm(hat, i, resumeTarget), awake: true });
    $('#yesBtn', sec).addEventListener('click', () => { FX.sound.unlock(); passDraw(hat, i, resumeTarget); });
    const bb = $('#backBtn', sec);
    if (bb) bb.addEventListener('click', () => screenPassList(hat));
  }

  function passDraw(hat, i, resumeTarget) {
    const p = hat.people[i];
    screenDraw({
      heading: t('yourTurn', { name: p.name }),
      sackCount: Math.min(hat.pool.length, 5),
      kind: 'pass',
      resume: resumeTarget || null,
      pull() {
        const saved = loadHat();
        const h = saved && saved.id === hat.id ? saved : hat;
        const pick = L.pickFromPool(i, h.pool, h.waiting);
        h.pool = h.pool.filter((x) => x !== pick);
        h.waiting = h.waiting.filter((x) => x !== i);
        store.set(K.hat, h);
        Object.assign(hat, h);
        // Who got whom is never saved. Only this tab keeps it, until "Hide it" is pressed.
        const target = { name: h.people[pick].name, emoji: h.people[pick].emoji };
        session.set(K.pending, { kind: 'pass', id: h.id, who: i, name: target.name, emoji: target.emoji });
        return target;
      },
      onBack: resumeTarget ? null : () => screenPassList(hat),
      onHidden() {
        session.del(K.pending);
        screenLockedPass(hat, i);
      },
    });
  }

  function screenLockedPass(hat, i, quiet) {
    const p = hat.people[i];
    const last = hat.pool.length === 0;
    const sec = show(`
      <div class="lock-wrap">${lockSVG()}</div>
      <h2 class="screen-title">${esc(t('lockedTitle'))}</h2>
      <p class="screen-sub">${esc(last ? t('lockedLast', { name: p.name }) : t('lockedPass', { name: p.name }))}</p>
      <div class="stack narrow"><button type="button" class="btn primary big" id="nextBtn">${esc(last ? t('finishBtn') : t('nextBtn'))}</button></div>
    `, 'locked', { rerender: () => screenLockedPass(hat, i, true), awake: true });
    if (!quiet) playLock(sec);
    $('#nextBtn', sec).addEventListener('click', () => (last ? screenFinale(hat, true) : screenPassList(hat)));
  }

  function screenFinale(hat, party) {
    const sec = show(`
      ${eventInfo(hat)}
      <div class="finale-sack"><div class="sack-wrap">${sackSVG(0)}</div></div>
      <h2 class="screen-title big">${esc(t('finaleTitle'))}</h2>
      <p class="screen-sub">${esc(t('finaleSub'))}</p>
      <div class="center"><button type="button" class="link-btn" id="newBtn">${esc(t('newDraw'))}</button></div>
    `, 'finale', { rerender: () => screenFinale(hat, false) });
    if (party) { FX.rain(4200); FX.sound.fanfare(); FX.buzz([40, 60, 40]); }
    $('#newBtn', sec).addEventListener('click', () => startOver(hat));
  }

  // ---------- secret-links mode: the organizer's list ----------
  function screenLinks(hat) {
    const sec = show(`
      ${eventInfo(hat)}
      <h2 class="screen-title">${esc(t('linksTitle'))}</h2>
      ${location.protocol === 'file:' ? `<p class="warn">${esc(t('fileWarning'))}</p>` : ''}
      <ol class="steps">
        <li><span aria-hidden="true">💌</span><p>${esc(t('linksStep1'))}</p></li>
        <li><span aria-hidden="true">🎅</span><p>${esc(t('linksStep2'))}</p></li>
        <li><span aria-hidden="true">📱</span><p>${esc(t('linksStep3'))}</p></li>
      </ol>
      <div class="card list-card">
        <div class="progress"><div class="bar"></div><span class="progress-text" aria-live="polite"></span></div>
        <ul class="link-list">
          ${hat.people.map((p, i) => `<li><button type="button" class="link-row" data-i="${i}">
            <span class="p-emoji ${tone(i)}" aria-hidden="true">${esc(p.emoji)}</span>
            <span class="p-name">${esc(p.name)}</span>
            <span class="status"></span></button></li>`).join('')}
        </ul>
        <p class="hint center">${esc(t('selfHint'))}</p>
      </div>
      <p class="note center">${esc(t('noPeekLinks'))}</p>
      <div class="center"><button type="button" class="link-btn" id="overBtn">${esc(t('startOver'))}</button></div>
    `, 'links', { rerender: () => screenLinks(loadHat() || hat) });

    function paint() {
      const n = hat.sent.filter(Boolean).length, total = hat.people.length;
      $('.bar', sec).style.width = ((n / total) * 100).toFixed(1) + '%';
      $('.progress-text', sec).textContent = t('sentCount', { n, total });
      $$('.link-row', sec).forEach((b) => {
        const i = +b.getAttribute('data-i');
        b.classList.toggle('is-sent', !!hat.sent[i]);
        $('.status', b).textContent = hat.sent[i] ? t('sent') : t('notSent');
      });
    }
    paint();
    $('.link-list', sec).addEventListener('click', (e) => {
      const b = e.target.closest('.link-row');
      if (b) personSheet(hat, +b.getAttribute('data-i'), paint);
    });
    $('#overBtn', sec).addEventListener('click', () => startOver(hat));
  }

  function personSheet(hat, i, repaint) {
    const p = hat.people[i];
    const url = ticketURL(hat.tickets[i]);
    const message = t('shareText', { name: p.name });
    const canShare = typeof navigator.share === 'function';
    const mark = () => {
      if (!hat.sent[i]) { hat.sent[i] = true; store.set(K.hat, hat); }
      repaint();
    };
    openSheet(`
      <div class="sheet-head"><span class="p-emoji big ${tone(i)}" aria-hidden="true">${esc(p.emoji)}</span>
        <h3 class="sheet-title">${esc(t('sheetTitle', { name: p.name }))}</h3></div>
      <div class="stack">
        ${canShare ? `<button type="button" class="btn primary big" data-act="share">${esc(t('send', { name: p.name }))}</button>` : ''}
        <button type="button" class="btn ${canShare ? 'soft' : 'primary big'}" data-act="copy">${esc(t('copy'))}</button>
      </div>
      <div class="link-box"><span>${esc(t('linkLabel'))}</span><div class="link-text">${esc(url)}</div></div>
      <div class="sheet-foot">
        <button type="button" class="link-btn dark" data-act="me">${esc(t('itsMe'))}</button>
        <button type="button" class="link-btn dark" data-act="dismiss">${esc(t('cancel'))}</button>
      </div>
    `, async (act) => {
      if (act === 'share') {
        try {
          await navigator.share({ title: t('appName'), text: message, url });
          mark();
          closeSheet();
        } catch (e) { /* the person closed the share menu */ }
      } else if (act === 'copy') {
        if (await copyText(message + '\n' + url)) {
          mark();
          closeSheet();
          toast(t('copied', { name: p.name }));
        } else {
          toast(t('copyFail'));
          const box = $('.link-text', sheetRoot);
          if (box && window.getSelection) {
            const range = document.createRange();
            range.selectNodeContents(box);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      } else if (act === 'me') {
        closeSheet(true);
        const ok = await confirmSheet({ title: t('itsMeQ', { name: p.name }), body: t('itsMeBody'), yes: t('itsMeYes'), no: t('cancel') });
        if (ok) {
          mark();
          location.hash = 's=' + hat.tickets[i];
        }
      }
    });
  }

  // ---------- secret-links mode: the person who opens a link ----------
  function ticketRoute(code) {
    const tk = L.decodeTicket(code);
    if (!tk) return screenBroken();
    if (!(ui.lang === 'es' || ui.lang === 'en') && tk.l) lang = tk.l; // follow the organizer unless this phone chose
    paintChrome();
    const pend = session.get(K.pending);
    if (pend && pend.kind === 'ticket' && pend.code === code) return screenHello(tk, code, true);
    if (store.get(K.lock(tk.i, tk.n))) return screenLockedTicket(tk, true);
    screenHello(tk, code, false);
  }

  function screenHello(tk, code, resume) {
    const sec = show(`
      ${eventInfo(evOf(tk))}
      <div class="who-big"><span class="avatar">${esc(tk.ne || '🎅')}</span></div>
      <h2 class="screen-title">${esc(resume ? t('areYou', { name: tk.n }) : t('hiTitle', { name: tk.n }))}</h2>
      <p class="screen-sub">${esc(resume ? t('resumeSub') : (tk.e ? t('hiSubEvent', { event: tk.e }) : t('hiSub')))}</p>
      <p class="screen-sub strong">${esc(t('isThisYou'))}</p>
      <div class="stack narrow">
        <button type="button" class="btn primary big" id="yesBtn">${esc(t('yesMe', { name: tk.n }))}</button>
        ${resume ? '' : `<button type="button" class="btn ghost" id="noBtn">${esc(t('notMe', { name: tk.n }))}</button>`}
      </div>`, 'hello', { rerender: () => screenHello(tk, code, resume) });
    $('#yesBtn', sec).addEventListener('click', () => { FX.sound.unlock(); ticketDraw(tk, code, resume); });
    const nb = $('#noBtn', sec);
    if (nb) nb.addEventListener('click', () => screenNotMe(tk, code));
  }

  function screenNotMe(tk, code) {
    const sec = show(`
      <div class="who-big"><span class="avatar">🎅</span></div>
      <h2 class="screen-title">${esc(t('notMeTitle'))}</h2>
      <p class="screen-sub">${esc(t('notMeBody', { name: tk.n }))}</p>
      <div class="stack narrow"><button type="button" class="btn ghost" id="backBtn">${esc(t('back'))}</button></div>
    `, 'notme', { rerender: () => screenNotMe(tk, code) });
    $('#backBtn', sec).addEventListener('click', () => screenHello(tk, code, false));
  }

  function ticketDraw(tk, code, resume) {
    const target = { name: tk.t, emoji: tk.te };
    screenDraw({
      heading: t('hereWeGo', { name: tk.n }),
      sackCount: 5,
      kind: 'ticket',
      resume: resume ? target : null,
      pull() {
        store.set(K.lock(tk.i, tk.n), Date.now());
        session.set(K.pending, { kind: 'ticket', code });
        return target;
      },
      onBack: resume ? null : () => screenHello(tk, code, false),
      onHidden() {
        session.del(K.pending);
        screenLockedTicket(tk, false);
      },
    });
  }

  function screenLockedTicket(tk, already, quiet) {
    const hasHat = !!loadHat();
    const sec = show(`
      <div class="lock-wrap">${lockSVG()}</div>
      <h2 class="screen-title">${esc(already ? t('alreadyTitle') : t('lockedTitle'))}</h2>
      <p class="screen-sub">${esc(already ? t('alreadyBody', { name: tk.n }) : t('lockedLink', { name: tk.n }))}</p>
      ${eventInfo(evOf(tk))}
      <p class="hint center light">${esc(t('closeHint'))}</p>
      ${hasHat ? `<div class="center"><button type="button" class="link-btn" id="orgBtn">${esc(t('organizerPage'))}</button></div>` : ''}
    `, already ? 'already' : 'locked', { rerender: () => screenLockedTicket(tk, already, true) });
    if (!already && !quiet) playLock(sec);
    const ob = $('#orgBtn', sec);
    if (ob) ob.addEventListener('click', goOrganizer);
  }

  function screenBroken() {
    paintChrome();
    show(`
      <div class="who-big"><span class="avatar">🧐</span></div>
      <h2 class="screen-title">${esc(t('brokenTitle'))}</h2>
      <p class="screen-sub">${esc(t('brokenBody'))}</p>
    `, 'broken', { rerender: screenBroken });
  }

  function goOrganizer() {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; return; }
    route();
  }

  // ---------- the big moment: pulling a name ----------
  function screenDraw(o) {
    const sec = show(`
      <h2 class="screen-title draw-title">${esc(o.heading)}</h2>
      <p class="screen-sub draw-sub">${esc(t('tapSack'))}</p>
      <div class="stage">
        <div class="rays-clip" aria-hidden="true"><div class="rays"><div class="rays-in"></div></div></div>
        <div class="stage-glow" aria-hidden="true"></div>
        <button type="button" class="sack-wrap idle" id="sackBtn" aria-label="${esc(t('pullAria'))}">${sackSVG(o.sackCount)}<span class="tap-hand" aria-hidden="true">👆</span></button>
        <div class="fly-layer" aria-hidden="true"></div>
        <div class="ticket" aria-hidden="true">
          <div class="ticket-float">
            <div class="ticket-inner">
              <div class="ticket-face ticket-front">
                <span class="t-stamp">🎄</span>
                <div class="t-label">${esc(t('youGot'))}</div>
                <div class="t-emoji"></div>
                <div class="t-name"></div>
              </div>
              <div class="ticket-face ticket-back"><span class="seal">?</span></div>
            </div>
          </div>
        </div>
      </div>
      <p class="sr-only" aria-live="assertive" id="srName"></p>
      <div class="draw-before stack narrow">
        <button type="button" class="btn primary big pulse" id="pullBtn">${esc(t('pullBtn'))}</button>
        ${o.onBack ? `<div class="center"><button type="button" class="link-btn" id="notMeBtn">${esc(t('notMeShort'))}</button></div>` : ''}
      </div>
      <div class="draw-after" hidden>
        <p class="remember">${esc(t('remember'))}</p>
        <p class="tip">${esc(t('writeTip'))}</p>
        <div class="stack narrow"><button type="button" class="btn green big" id="hideBtn">${esc(t('hideBtn'))}</button></div>
      </div>
    `, 'draw', { awake: o.kind === 'pass' });
    const my = token;
    let target = null;

    function revealed() {
      $('.draw-title', sec).textContent = t('shh');
      $('.draw-sub', sec).hidden = true;
      $('.stage', sec).classList.add('revealed');
      $('#srName', sec).textContent = t('youGot') + ' ' + target.name;
      setTimeout(() => {
        if (my !== token) return;
        const after = $('.draw-after', sec);
        after.hidden = false;
        after.classList.add('rise');
      }, reduce ? 0 : 900);
      FX.twinkle(() => { const el = $('.ticket-inner', sec); return my === token && el ? el.getBoundingClientRect() : null; }, 3200);
    }

    async function pull() {
      if (target) return;
      FX.sound.unlock();
      try {
        target = o.pull();
      } catch (e) {
        toast(t('oops'));
        route();
        return;
      }
      await animatePull(sec, target, my);
      if (my === token) revealed();
    }

    if (o.resume) {
      target = o.resume;
      instantReveal(sec, target);
      revealed();
    }

    $('#sackBtn', sec).addEventListener('click', pull);
    $('#pullBtn', sec).addEventListener('click', pull);
    const nb = $('#notMeBtn', sec);
    if (nb) nb.addEventListener('click', () => { if (!target) o.onBack(); });

    $('#hideBtn', sec).addEventListener('click', async () => {
      const yes = await confirmSheet({
        title: t('sureQ'),
        body: o.kind === 'pass' ? t('sureBodyPass') : t('sureBodyLink'),
        yes: t('sureYes'), no: t('sureNo'),
      });
      if (!yes || my !== token) return;
      await poofTicket(sec);
      if (my === token) o.onHidden();
    });
  }

  function fillTicket(sec, target) {
    $('.t-emoji', sec).textContent = target.emoji || '🎁';
    const el = $('.t-name', sec);
    const words = L.cleanName(target.name).split(' ');
    let i = 0;
    el.innerHTML = words.map((w) => `<span class="w">${Array.from(w).map((ch) => `<span class="l" style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>`).join(' ');
    el.style.setProperty('--step', Math.min(55, Math.round(900 / Math.max(1, i))) + 'ms');
    fitName(el);
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => fitName(el));
  }
  function fitName(el) {
    let size = window.innerWidth <= 340 ? 50 : 58;
    el.classList.remove('wrap');
    el.style.fontSize = size + 'px';
    while (el.scrollWidth > el.clientWidth + 1 && size > 26) {
      size -= 2;
      el.style.fontSize = size + 'px';
    }
    if (el.scrollWidth > el.clientWidth + 1) el.classList.add('wrap');
  }

  function flySlip(layer, x, y, spread) {
    const outer = document.createElement('div');
    outer.className = 'fly';
    outer.style.left = x + 'px';
    outer.style.top = y + 'px';
    const inner = document.createElement('div');
    inner.className = 'fly-in';
    outer.appendChild(inner);
    layer.appendChild(outer);
    const dx = (Math.random() - 0.5) * spread;
    const up = 110 + Math.random() * 170, fall = 70 + Math.random() * 130;
    const rot = (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 520);
    const dur = 950 + Math.random() * 450;
    anim(outer, [{ transform: 'translateX(0px)', opacity: 0 }, { transform: `translateX(${dx * 0.12}px)`, opacity: 1, offset: 0.12 },
      { transform: `translateX(${dx * 0.75}px)`, opacity: 1, offset: 0.75 }, { transform: `translateX(${dx}px)`, opacity: 0 }],
    { duration: dur, easing: 'linear', fill: 'forwards' });
    anim(inner, [
      { transform: 'translateY(0px) rotate(0deg) scale(.5)', easing: 'cubic-bezier(.15,.6,.35,1)' },
      { transform: `translateY(${-up}px) rotate(${rot * 0.5}deg) scale(1)`, offset: 0.45, easing: 'cubic-bezier(.6,0,.85,.45)' },
      { transform: `translateY(${fall}px) rotate(${rot}deg) scale(.85)` },
    ], { duration: dur, fill: 'forwards' }).finished.then(() => outer.remove());
  }

  async function animatePull(sec, target, my) {
    const stage = $('.stage', sec);
    const sack = $('#sackBtn', sec);
    const ticket = $('.ticket', sec);
    const inner = $('.ticket-inner', sec);
    const before = $('.draw-before', sec);
    before.classList.add('gone');
    setTimeout(() => { before.hidden = true; }, 320);
    $('.draw-sub', sec).textContent = t('shaking');
    sack.classList.remove('idle');
    sack.disabled = true;
    fillTicket(sec, target);
    FX.sound.jingle();
    FX.buzz([25, 45, 25, 45, 25, 45, 60]);

    if (reduce || !canAnimate) {
      await sleep(600);
      if (my !== token) return;
      sack.classList.add('fade-out');
      inner.style.transform = 'rotateY(0deg)';
      ticket.classList.add('show-now');
      $('.rays', sec).classList.add('on');
      $('.t-name', sec).classList.add('go');
      FX.sound.tada();
      await sleep(500);
      return;
    }

    // 1. shake the sack; paper slips jump out
    sack.classList.add('shake');
    const sr = stage.getBoundingClientRect(), kr = sack.getBoundingClientRect();
    const mouthX = kr.left - sr.left + kr.width / 2;
    const mouthY = kr.top - sr.top + kr.height * 0.27;
    const spread = Math.min(340, sr.width * 0.9);
    const layer = $('.fly-layer', sec);
    for (let k = 0; k < 16; k++) {
      setTimeout(() => { if (my === token) flySlip(layer, mouthX + (Math.random() - 0.5) * 80, mouthY, spread); }, 120 + k * 70);
    }
    await sleep(1350);
    if (my !== token) return;

    // 2. one slip shoots out and flies to the middle
    sack.classList.remove('shake');
    void sack.offsetWidth;
    sack.classList.add('pop');
    $('.draw-sub', sec).classList.add('gone');
    FX.sound.whoosh();
    FX.buzz(40);
    const tr = ticket.getBoundingClientRect();
    const dx = sr.left + mouthX - (tr.left + tr.width / 2);
    const dy = sr.top + mouthY - (tr.top + tr.height / 2);
    inner.style.transform = 'rotateY(180deg)';
    ticket.style.opacity = '1';
    const fly = anim(ticket, [
      { transform: `translate(${dx}px, ${dy}px) scale(.22) rotate(-420deg)`, opacity: 0 },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 150}px) scale(.62) rotate(-140deg)`, opacity: 1, offset: 0.55 },
      { transform: 'translate(0px, 0px) scale(1) rotate(0deg)', opacity: 1 },
    ], { duration: 950, easing: 'cubic-bezier(.22,.75,.3,1.08)', fill: 'forwards' });
    anim(sack, [{ transform: 'translateY(0px) scale(1)', opacity: 1 }, { transform: 'translateY(90px) scale(.75)', opacity: 0 }],
      { duration: 650, delay: 380, easing: 'ease-in', fill: 'forwards' });
    await fly.finished;
    if (my !== token) return;

    // 3. flip it over: the name!
    $('.rays', sec).classList.add('on');
    FX.sound.tada();
    FX.buzz(70);
    const flip = anim(inner, [{ transform: 'rotateY(540deg)' }, { transform: 'rotateY(0deg)' }],
      { duration: 1150, easing: 'cubic-bezier(.2,1.25,.45,1)', fill: 'forwards' });
    setTimeout(() => {
      if (my !== token) return;
      const r = ticket.getBoundingClientRect();
      FX.burst(r.left + r.width / 2, r.top + r.height / 2, 170);
    }, 380);
    setTimeout(() => {
      if (my !== token) return;
      $('.t-name', sec).classList.add('go');
      const title = $('.draw-title', sec);
      title.textContent = t('shh');
      title.classList.add('pop-in');
    }, 520);
    await flip.finished;
    if (my !== token) return;
    inner.style.transform = 'rotateY(0deg)';
    $('.ticket-float', sec).classList.add('floating');
  }

  function instantReveal(sec, target) {
    fillTicket(sec, target);
    const sack = $('#sackBtn', sec);
    sack.classList.remove('idle');
    sack.classList.add('hidden-sack');
    sack.disabled = true;
    $('.draw-before', sec).hidden = true;
    $('.ticket', sec).style.opacity = '1';
    $('.ticket-inner', sec).style.transform = 'rotateY(0deg)';
    $('.rays', sec).classList.add('on');
    $('.t-name', sec).classList.add('go');
    $('.ticket-float', sec).classList.add('floating');
  }

  /** "Hide it": the slip turns into sparkles and snow, and the name is wiped off the page. */
  async function poofTicket(sec) {
    const ticket = $('.ticket', sec);
    const r = $('.ticket-inner', sec).getBoundingClientRect();
    $('.draw-after', sec).classList.add('gone');
    $('.rays', sec).classList.remove('on');
    $('.ticket-float', sec).classList.remove('floating');
    FX.sound.poof();
    FX.buzz(30);
    FX.poof(r);
    const frames = reduce
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
        { transform: 'translate(0px, 0px) scale(1) rotate(0deg)', opacity: 1, filter: 'blur(0px)' },
        { transform: 'translate(0px, -8px) scale(1.07) rotate(3deg)', opacity: 1, filter: 'blur(0px)', offset: 0.25 },
        { transform: 'translate(0px, -40px) scale(.15) rotate(-30deg)', opacity: 0, filter: 'blur(10px)' },
      ];
    await anim(ticket, frames, { duration: reduce ? 300 : 650, easing: 'ease-in', fill: 'forwards' }).finished;
    $('.t-name', sec).textContent = '';
    $('.t-emoji', sec).textContent = '';
    $('#srName', sec).textContent = '';
    ticket.style.visibility = 'hidden';
    await sleep(reduce ? 100 : 380);
  }

  function playLock(sec) {
    const sh = $('.lock-shackle', sec);
    const wrap = $('.lock-wrap', sec);
    if (!sh || reduce || !canAnimate) { FX.sound.click(); return; }
    anim(sh, [
      { transform: 'translateY(-20px)' }, { transform: 'translateY(-20px)', offset: 0.35 },
      { transform: 'translateY(3px)', offset: 0.8 }, { transform: 'translateY(0px)' },
    ], { duration: 750, easing: 'ease-in', fill: 'backwards' }).finished.then(() => {
      FX.sound.click();
      FX.buzz(25);
      if (wrap) wrap.classList.add('clicked');
    });
  }

  // ---------- which screen to show ----------
  function organizerRoute() {
    paintChrome();
    const hat = loadHat();
    if (!hat) { session.del(K.pending); screenSetup(); return; }
    if (hat.mode === 'pass') {
      const pend = session.get(K.pending);
      if (pend && pend.kind === 'pass' && pend.id === hat.id && hat.people[pend.who] && typeof pend.name === 'string') {
        screenPassConfirm(hat, pend.who, { name: pend.name, emoji: pend.emoji });
        return;
      }
      if (!hat.pool.length) { screenFinale(hat, false); return; }
      screenPassList(hat);
      return;
    }
    screenLinks(hat);
  }

  function route() {
    const h = location.hash || '';
    const m = /^#s=([A-Za-z0-9_-]+)/.exec(h);
    if (m) { ticketRoute(m[1]); return; }
    if (/^#s=/.test(h)) { screenBroken(); return; }
    organizerRoute();
  }

  // ---------- start ----------
  window.addEventListener('hashchange', route);
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildLights, 150);
  });
  buildLights();
  buildStars();
  paintChrome();
  route();
})();
