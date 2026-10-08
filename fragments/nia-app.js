// Nia's lab — frontend fragment.
//
// COORDINATOR: merge into app.js:
//   1. Add to the import block: import { niaAnswer, niaIsIpProbe, niaRepeatRefusal } from './lib/niachat.js';
//   2. Call initNia() in boot() next to initWendyAnim();
//   3. Call renderNiaPanel(summary) in loadSummary() next to renderWendy();
//
// Uses the module-level $, DATA_BASE, and summary from app.js.
import { niaAnswer, niaIsIpProbe, niaRepeatRefusal } from './lib/niachat.js';

/* ---------------- Nia's lab ---------------- */
function renderNiaPanel(summary) {
  if (!$('niTilt')) return;
  const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  const nw = summary && summary.news;
  const sb = summary && summary.windows && summary.windows.all && summary.windows.all.news;
  // live stat cards
  if (nw) {
    const b = nw.bias || 0;
    const dirWord = b > 0.0005 ? 'upbeat' : b < -0.0005 ? 'worrying' : 'quiet';
    setT('niTilt', (b >= 0 ? '+' : '') + b.toFixed(4));
    setT('niTiltSub', dirWord + (b > 0.0005 ? ' · XRP-positive headlines' : b < -0.0005 ? ' · XRP-negative headlines' : ''));
    const act = Array.isArray(nw.activeCatalysts) ? nw.activeCatalysts : [];
    setT('niActive', String(act.length));
    const nPos = act.filter((a) => a.dir > 0).length, nNeg = act.filter((a) => a.dir < 0).length;
    setT('niActiveSub', act.length ? nPos + ' pushing up · ' + nNeg + ' pushing down' : 'wire quiet on the XRP front');
    const top = act[0];
    setT('niLast', top ? (top.headline.length > 72 ? top.headline.slice(0, 72) + '…' : top.headline) : '—');
    setT('niLastSub', top ? (top.dir > 0 ? '▲ upbeat' : '▼ worrying') : 'no catalysts live');
    setT('niStatus', nw.degraded ? 'Blind' : 'Live');
    setT('niStatusSub', nw.degraded ? 'both feeds unreachable — abstaining'
      : (nw.feeds || []).map((f) => f.name + ':' + (f.ok ? 'ok' : 'down')).join(' · ') || 'free public RSS');
    const w = nw.weight || 0;
    setT('niDisciplinesSub', w > 0 ? 'scored · active at weight ' + w.toFixed(2) : 'scored only, not used');
    setT('niCats24', String(nw.catalysts24h != null ? nw.catalysts24h : '—'));
    // tilt sparkline
    try {
      const cv = $('niSpark'), ctx = cv.getContext('2d');
      const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      const series = ((summary.nia && summary.nia.log) || [])
        .filter((e) => e.computed && !e.computed.degraded)
        .slice(-48).map((e) => e.computed.bias);
      if (series.length > 1) {
        const lo = -0.02, hi = 0.02;
        const yOf = (v) => H - 3 - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (H - 6);
        ctx.strokeStyle = 'rgba(140,160,190,.35)'; ctx.beginPath();
        ctx.moveTo(0, yOf(0)); ctx.lineTo(W, yOf(0)); ctx.stroke();
        ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 1.5; ctx.beginPath();
        series.forEach((v, i) => {
          const x = (i / (series.length - 1)) * W;
          i ? ctx.lineTo(x, yOf(v)) : ctx.moveTo(x, yOf(v));
        });
        ctx.stroke();
      }
    } catch { /* canvas optional */ }
  }
  if (sb && sb.n >= 30) {
    setT('niVerdict', sb.brierNews.toFixed(5));
    setT('niVerdictSub', 'n=' + sb.n + ' scored' + (sb.brierNews < sb.brierBase ? ' · beats baseline ✓' : ''));
    if (sb.skill24h && sb.skill24h.n >= 30) {
      setT('niSkill', (sb.skill24h.hitRate * 100).toFixed(1) + '%');
      setT('niSkillSub', 'n=' + sb.skill24h.n + ' · 24h direction');
    }
  }
  // lab panel: board + notebook
  const L = summary && summary.nia;
  const rowsEl = $('niLogRows');
  const bubble = $('niBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'tuning into the wire…';
    setT('niBoardTilt', 'warming up…'); setT('niBoardActive', ''); setT('niBoardTop', ''); setT('niBoardVerdict', '');
    const sp = $('niBoardSpark'); if (sp) sp.setAttribute('points', '');
    setT('niBoardSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Nia is tuning into the wire — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    const dirWord = c.bias > 0.0005 ? 'upbeat' : c.bias < -0.0005 ? 'worrying' : 'quiet';
    setT('niBoardTilt', `news tilt  ${c.bias >= 0 ? '+' : ''}${c.bias.toFixed(4)}  (${dirWord})`);
    setT('niBoardActive', `catalysts live: ${c.active_catalysts || 0}${c.catalysts_24h != null ? ` (${c.catalysts_24h} in 24h)` : ''}`);
    setT('niBoardTop', '');
  } else {
    setT('niBoardTilt', c && c.degraded ? 'wire blind…' : 'warming up…');
    setT('niBoardActive', 'scanning headlines…'); setT('niBoardTop', '');
  }
  const vEl = $('niBoardVerdict');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879';
  }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded).slice(-24).map((e) => e.computed.bias);
  const sp = $('niBoardSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('niBoardSparkLabel', `news tilt · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('niBoardSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('niBubble');
      if (b) { b.classList.remove('ni-talk'); void b.offsetWidth; b.classList.add('ni-talk'); }
    }
  }
  if (rowsEl) {
    $('niLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
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
      v.className = 'lm-v ' + (e.verdict === 'useful' ? 'lm-v-useful' : e.verdict === 'insufficient data' ? 'lm-v-insuf' : 'lm-v-not');
      v.textContent = e.verdict;
      const f = document.createElement('span'); f.className = 'lm-f'; f.textContent = e.finding;
      head.append(t, v, f);
      const det = document.createElement('div');
      det.className = 'lm-detail'; det.hidden = true;
      const col = e.collected || {};
      det.innerHTML =
        '<div class="lm-sec"><span class="lm-k">COLLECTED</span><br>' +
        (col.source || 'public RSS feeds') + ' · ' + (col.window || '') + '<br>' +
        (col.catalysts_seen_24h != null ? col.catalysts_seen_24h + ' catalysts seen in 24h · ' : '') +
        (col.feeds || 'feeds') + '</div>' +
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

/* ---------------- Nia's standing verdict ---------------- */
async function loadNiaVerdict() {
  const panel = $('niVPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'nia_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('niVBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'nv-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('niVPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('niVEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · decisive catalyst reads <b>' + pct(ev.decisive_frac) + '</b> · ' +
    'live-catalyst cycles <b>' + (ev.catalyst_cycles || 0) + '</b> · ' +
    (ev.member_n >= 200
      ? 'out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('niVDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="nv-line"><span class="nv-d">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('niVHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="nv-hyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>' +
    'status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('niVMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' +
    esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + esc(p.id) + '" target="_blank" rel="noopener">' + esc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
  // standing verdict also lights the "Standing verdict" stat card
  const sv = $('niDisciplines');
  if (sv) sv.textContent = label;
  // hypotheses summary on the hypotheses card
  const hs = (doc.hypotheses || []);
  const hsv = $('niHypotheses');
  if (hsv) hsv.textContent = hs.filter((h) => h.status === 'supported').length + '/' + hs.length + ' supported';
  const hsSub = $('niHypothesesSub');
  if (hsSub) hsSub.textContent = 'NI1–NI4: ' + hs.map((h) => h.id + '=' + h.status).join(' · ');
}

/* ---------------- Nia DM chat ---------------- */
function initNiaChat() {
  const log = $('niChatLog'), input = $('niChatText'), send = $('niChatSend'), chips = $('niChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'nchat-row ' + who;
    if (who === 'nia') {
      const av = document.createElement('img');
      av.src = 'nia-headshot.webp'; av.alt = 'Nia';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'nchat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What is a news catalyst?', "What's your verdict?", 'Is it in the forecast?', 'What do you do?'];
  if (chips) {
    chips.innerHTML = '';
    for (const q of CHIP_QS) {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'nchat-chip'; c.textContent = q;
      c.addEventListener('click', () => { input.value = q; doSend(); });
      chips.appendChild(c);
    }
  }
  // repeat IP probers are counted (per browser) and get a firmer refusal
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('niaChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'nchat-row nia';
    typing.innerHTML = '<img src="nia-headshot.webp" alt="Nia"><div class="nchat-bubble"><span class="nchat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (niaIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('niaChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? niaRepeatRefusal() : niaAnswer(text);
    } else {
      reply = niaAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('nia', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('nia', "Hello hello! 🧡 Nia here — wire's live, eyes on the headlines! Ask me about news catalysts, my verdicts, or how I decide what enters the forecast model!"), 800);
}

/* ---------------- Nia flipbook animation ---------------- */
function initNiaAnim() {
  const img = $('niHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'nia.webp', WRITE = 'nia-write.webp', BLINK = 'nia-blink.webp';
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

/* ---------------- boot hook ---------------- */
function initNia() {
  initNiaAnim();
  loadNiaVerdict();
  initNiaChat();
}
