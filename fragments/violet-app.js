// ================= Violet app glue (fragment) =================
// Coordinator notes:
//   1) Add to app.js imports:
//        import { violetAnswer, violetIsIpProbe, violetRepeatRefusal } from './lib/violetchat.js';
//   2) Splice these functions into app.js (they reuse the existing $() helper,
//      the global `summary`, and the lm-* log/chalkboard styles shared with Masha/Wendy).
//   3) Call initViolet() in boot(), after loadSummary() has run.

/* ---------------- Violet's lab panel ---------------- */
function renderVioletPanel(sum) {
  if (!$('viBoardRegime')) return;
  const s = sum || (typeof summary !== 'undefined' ? summary : null);
  const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  const vv = s && s.volatility;
  const sb = s && s.windows && s.windows.all && s.windows.all.volatility;
  // live stat cards
  if (vv) {
    const rg = vv.regime || 'unknown';
    setT('viRegime', rg);
    setT('viRegimeSub', vv.warmingUp ? 'baseline building' : rg === 'wild' ? 'dampener nominated' : rg === 'calm' ? 'dampener parked' : 'within baseline');
    setT('viVolNow', vv.volNow != null && isFinite(vv.volNow) ? vv.volNow.toFixed(4) : '—');
    setT('viVolNowSub', 'realized vol');
    setT('viVolMed', vv.volMedian != null && isFinite(vv.volMedian) ? vv.volMedian.toFixed(4) : '—');
    setT('viVolMedSub', 'rolling baseline');
    setT('viStatus', vv.degraded ? 'Blind' : vv.warmingUp ? 'Warming up' : 'Live');
    setT('viStatusSub', vv.degraded ? 'feed unreadable — abstaining' : vv.warmingUp ? 'needs days of history' : 'candles flowing');
    const armed = vv.dampenerOn ? true : false;
    setT('viDamp', armed ? 'Armed' : 'Scored only');
    setT('viDampNote', armed ? 'shrinking confidence in wild regimes' : 'scored only, not used');
  }
  if (sb && sb.n >= 30) {
    setT('viBrier', sb.brierMember.toFixed(5));
    setT('viBrierN', 'n=' + sb.n + ' scored' + (sb.brierMember < sb.brierBase ? ' · beats baseline ✓' : ''));
  }
  // board + notebook
  const L = s && s.violet;
  const rowsEl = $('viLog');
  const bubble = $('viBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'consulting the regimes…';
    setT('viBoardRegime', 'warming up…'); setT('viBoardVol', ''); setT('viBoardDamp', ''); setT('viVerdict', '');
    const sp = $('viSpark'); if (sp) sp.setAttribute('points', '');
    setT('viSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Violet is consulting the regimes — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    const rg = c.regime || 'unknown';
    setT('viBoardRegime', `regime: ${rg}`);
    setT('viBoardVol', `vol ${c.vol_now != null ? c.vol_now.toFixed(4) : '—'}  vs baseline ${c.vol_median != null ? c.vol_median.toFixed(4) : '—'}`);
    setT('viBoardDamp', rg === 'wild' ? 'dampener: nominated — confidence shrinks toward 0.5' : 'dampener: parked');
  } else {
    setT('viBoardRegime', c && c.degraded ? 'feed blind…' : 'warming up…');
    setT('viBoardVol', 'collecting history…'); setT('viBoardDamp', '');
  }
  const vEl = $('viVerdict');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}`;
    vEl.style.color = n.verdict === 'dampening' ? '#c4a5f5' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#a3a3a3';
  }
  const pts = (L.log || []).filter((e) => e.computed && e.computed.vol_now != null && !e.computed.degraded).slice(-24).map((e) => e.computed.vol_now);
  const sp = $('viSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('viSparkLabel', `realized vol · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('viSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('viBubble');
      if (b) { b.classList.remove('vi-talk'); void b.offsetWidth; b.classList.add('vi-talk'); }
    }
  }
  if (rowsEl) {
    const cnt = $('viLogCount'); if (cnt) cnt.textContent = '· ' + (L.log || []).length + ' notes saved';
    rowsEl.innerHTML = '';
    const notes = (L.log || []).slice().reverse().slice(0, 40);
    if (!notes.length) rowsEl.innerHTML = '<div class="lm-empty">No notes yet.</div>';
    for (const e of notes) {
      const row = document.createElement('div');
      row.className = 'lm-row';
      const head = document.createElement('button');
      head.className = 'lm-rowhead';
      const t = document.createElement('span'); t.className = 'lm-t';
      const dt = new Date(e.t);
      t.textContent = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
        dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      const v = document.createElement('span');
      v.className = 'lm-v ' + (e.verdict === 'dampening' ? 'lm-v-useful' : e.verdict === 'insufficient data' ? 'lm-v-insuf' : 'lm-v-not');
      v.textContent = e.verdict;
      const f = document.createElement('span'); f.className = 'lm-f'; f.textContent = e.finding;
      head.append(t, v, f);
      const det = document.createElement('div');
      det.className = 'lm-detail'; det.hidden = true;
      const col = e.collected || {};
      det.innerHTML =
        '<div class="lm-sec"><span class="lm-k">COLLECTED</span><br>' +
        (col.source || 'the lab\u2019s own candles') + ' · ' + (col.window || '') + '<br>' +
        (col.history_note || '') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">CHECKS</span><br>' +
        (e.checks || []).map((k) => '<span class="' + (k.pass ? 'lm-check-pass' : 'lm-check-fail') + '">' +
          (k.pass ? '✓' : '✗') + '</span> ' + k.name + ' — ' + k.detail).join('<br>') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">WHY</span><br>' + (e.verdict_why || '') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">MATHEMATICAL EFFECT</span><br>' + ((e.math_effect || {}).detail || '') + '</div>';
      head.addEventListener('click', () => { det.hidden = !det.hidden; });
      row.append(head, det);
      rowsEl.appendChild(row);
    }
  }
}

/* ---------------- Violet's standing verdict ---------------- */
async function loadVioletVerdict() {
  const panel = $('viVPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'violet_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('viVBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'vi-vbadge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('viVPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('viVEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · wild regimes <b>' + pct(ev.decisive_frac) + '</b> · ' +
    'wild-regime cycles <b>' + (ev.wild_cycles || 0) + '</b> · ' +
    (ev.member_n >= 200
      ? 'out-of-sample dampener Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('viDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="vi-vline"><span class="vi-vd">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('viHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="vi-vhyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>' +
    'status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('viVMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' +
    esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + esc(p.id) + '" target="_blank" rel="noopener">' + esc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Violet DM chat ---------------- */
function initVioletChat() {
  const log = $('viChatLog'), input = $('viChatText'), send = $('viChatSend'), chips = $('viChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'vichat-row ' + who;
    if (who === 'violet') {
      const av = document.createElement('img');
      av.src = 'violet-headshot.webp'; av.alt = 'Violet';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'vichat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What is the volatility dampener?', "What's your verdict?", 'Is it in the forecast?', 'Why not predict direction?'];
  if (chips) {
    chips.innerHTML = '';
    for (const q of CHIP_QS) {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'vichat-chip'; c.textContent = q;
      c.addEventListener('click', () => { input.value = q; doSend(); });
      chips.appendChild(c);
    }
  }
  // repeat IP probers are counted (per browser) and get a firmer refusal
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('violetChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'vichat-row violet';
    typing.innerHTML = '<img src="violet-headshot.webp" alt="Violet"><div class="vichat-bubble"><span class="vichat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (violetIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('violetChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? violetRepeatRefusal() : violetAnswer(text);
    } else {
      reply = violetAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('violet', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('violet', "Hello, dear. 🟣 I'm Violet — ask me anything about volatility regimes, my dampener, or how I decide what enters the forecast!"), 800);
}

/* ---------------- Violet flipbook animation ---------------- */
function initVioletAnim() {
  const img = $('viHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'violet.webp', WRITE = 'violet-write.webp', BLINK = 'violet-blink.webp';
  let ready = 0;
  const go = () => { if (++ready >= 2) start(); };
  const fallback = setTimeout(() => start(), 4000);
  [WRITE, BLINK].forEach((src) => {
    const im = new Image();
    im.onload = go; im.onerror = go;
    im.src = src;
  });
  function start() {
    if (start.done) return; start.done = true;
    clearTimeout(fallback);
    let onScreen = true, pageVisible = !document.hidden;
    let writing = false, writeTimer = null, blinkTimer = null;
    const show = (src) => { if (img.getAttribute('src') !== src) img.setAttribute('src', src); };
    const kick = () => {
      const active = onScreen && pageVisible;
      if (active && !writeTimer) {
        writeTimer = setInterval(() => { writing = !writing; show(writing ? WRITE : BASE); }, 750);
        blinkTimer = setInterval(() => {
          show(BLINK);
          setTimeout(() => show(writing ? WRITE : BASE), 170);
        }, 4200);
      } else if (!active && writeTimer) {
        clearInterval(writeTimer); clearInterval(blinkTimer);
        writeTimer = blinkTimer = null;
        show(BASE);
      }
    };
    new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; kick(); }, { threshold: 0.1 }).observe(img);
    document.addEventListener('visibilitychange', () => { pageVisible = !document.hidden; kick(); });
    kick();
  }
}

/* ---------------- Violet entry point ---------------- */
function initViolet() {
  initVioletAnim();
  renderVioletPanel(typeof summary !== 'undefined' ? summary : null);
  loadVioletVerdict();
  initVioletChat();
}
