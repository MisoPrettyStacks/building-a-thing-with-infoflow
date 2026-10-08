/* ---------------- Cherry: correlation-regime lab (fragment) ---------------- */
/* Assembly: index.html includes fragments/cherry-section.html; this script is
   concatenated after app.js. Relies on app.js helpers: $(), setT(),
   DATA_BASE, fmtXrpShort. Chat engine: lib/cherrychat.js (cherryAnswer,
   cherryIsIpProbe, cherryRepeatRefusal, CHERRY_CHAT_VERSION). */

/* Cherry flipbook animation: write arm moves, she blinks. */
function initCherryAnim() {
  const img = $('chHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'cherry.webp', WRITE = 'cherry-write.webp', BLINK = 'cherry-blink.webp';
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

/* ---------------- Cherry DM chat ---------------- */
function initCherryChat() {
  const log = $('chChatLog'), input = $('chChatText'), send = $('chChatSend'), chips = $('chChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'wchat-row ' + who;
    if (who === 'cherry') {
      const av = document.createElement('img');
      av.src = 'cherry-headshot.webp'; av.alt = 'Cherry';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'wchat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What is a coupling regime?', "What's your verdict?", 'Is it in the forecast?', 'Why only follow BTC when coupled?'];
  if (chips) {
    chips.innerHTML = '';
    for (const q of CHIP_QS) {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'wchat-chip'; c.textContent = q;
      c.addEventListener('click', () => { input.value = q; doSend(); });
      chips.appendChild(c);
    }
  }
  // repeat IP probers are counted (per browser) and get a firmer refusal
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('cherryChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'wchat-row cherry';
    typing.innerHTML = '<img src="cherry-headshot.webp" alt="Cherry"><div class="wchat-bubble"><span class="wchat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (cherryIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('cherryChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? cherryRepeatRefusal() : cherryAnswer(text);
    } else {
      reply = cherryAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('cherry', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('cherry', "Hello! I'm Cherry 🍒 Ask me anything about coupling regimes — my verdicts, how I measure the correlation, or how I decide what enters the forecast!"), 800);
}

/* ---------------- Cherry's standing verdict ---------------- */
async function loadCherryVerdict() {
  const panel = $('chPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'cherry_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('chVerdict');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'wv-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('chPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('chEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · decisive coupling <b>' + pct(ev.decisive_frac) + '</b> · ' +
    'coupled <b>' + pct(ev.coupled_frac) + '</b>' +
    (ev.mean_corr24h != null ? ' · mean 24h corr <b>' + ev.mean_corr24h.toFixed(3) + '</b>' : '') + ' · ' +
    (ev.member_n >= 200
      ? 'out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('chDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="wv-line"><span class="wv-d">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('chHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="wv-hyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>' +
    'status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('chMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' +
    esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + esc(p.id) + '" target="_blank" rel="noopener">' + esc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Cherry live panel ---------------- */
function renderCherryPanel(summary) {
  // scoreboard
  if ($('chBrier')) {
    const sb = summary && summary.windows && summary.windows.all && summary.windows.all.corr;
    if (sb) {
      setT('chBrier', sb.brierCorr.toFixed(5));
      setT('chBrierN', 'n=' + sb.n + ' scored' + (sb.brierCorr < sb.brierBase ? ' · beats baseline ✓' : ''));
      if (sb.skill24h && sb.skill24h.n >= 30) {
        setT('chSkill', (sb.skill24h.hitRate * 100).toFixed(1) + '%');
        setT('chSkillSub', 'n=' + sb.skill24h.n + ' · 24h direction');
      }
    }
  }
  // signal cards from live summary.corr
  const C = summary && summary.corr;
  if (C) {
    setT('chCorr', C.corr24h != null ? C.corr24h.toFixed(3) : '—');
    setT('chCorrSub', C.degraded ? 'data blind' : C.warmingUp ? 'building history' : C.coupled ? '24h rolling' : '24h rolling');
    setT('chCoupled', C.degraded ? '—' : C.warmingUp ? '—' : C.coupled ? 'COUPLED' : 'decoupled');
    const cSub = $('chCoupledSub');
    if (cSub) cSub.textContent = C.degraded || C.warmingUp ? 'no read yet' : C.coupled ? "BTC drift licensed" : 'following nothing';
    setT('chTilt', (C.bias >= 0 ? '+' : '') + C.bias.toFixed(4));
    setT('chTiltSub', C.degraded || C.warmingUp ? 'no read' : C.coupled ? (Math.abs(C.bias) >= 0.004 ? 'expressive — decisive' : 'whisper — abstaining') : 'abstaining');
    setT('chStatus', C.degraded ? 'blind' : C.warmingUp ? 'warming up' : 'live');
    const cc = $('chCorr'); if (cc) cc.style.color = C.coupled ? '#ff7d99' : '';
    const ct = $('chCoupled'); if (ct) ct.style.color = C.coupled ? '#ff7d99' : '';
  }
  // spark canvas: recent correlation history
  const spark = $('chSpark');
  if (spark) {
    const g = spark.getContext('2d');
    g.clearRect(0, 0, spark.width, spark.height);
    const pts = (summary && summary.cherry && summary.cherry.log || [])
      .filter((e) => e.computed && e.computed.corr_24h != null && !e.computed.degraded)
      .slice(-40).map((e) => e.computed.corr_24h);
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      g.strokeStyle = '#dc2645'; g.lineWidth = 1.5; g.beginPath();
      pts.forEach((v, i) => {
        const x = 4 + (i / (pts.length - 1)) * (spark.width - 8);
        const y = spark.height - 4 - ((v - mn) / rg) * (spark.height - 8);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.stroke();
    }
  }
  // lab panel: board + notebook
  const L = summary && summary.cherry;
  const rowsEl = $('chLogRows');
  const bubble = $('chBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    setT('chCorrBoard', 'warming up…'); setT('chCoupledBoard', ''); setT('chTiltBoard', ''); setT('chVerdictBoard', '');
    const sp = $('chBoardSpark'); if (sp) sp.setAttribute('points', '');
    setT('chBoardSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Cherry is setting up her lab — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    setT('chCorrBoard', `24h corr  ${c.corr_24h != null ? c.corr_24h.toFixed(3) : '—'}  (${c.coupled ? 'coupled' : 'decoupled'})`);
    setT('chCoupledBoard', c.coupled ? 'BTC drift licensed this cycle' : 'decoupled — following nothing');
    setT('chTiltBoard', `conditional tilt  ${c.bias >= 0 ? '+' : ''}${c.bias.toFixed(4)}`);
  } else {
    setT('chCorrBoard', c && c.degraded ? 'data blind…' : 'warming up…');
    setT('chCoupledBoard', 'collecting history…'); setT('chTiltBoard', '');
  }
  const vEl = $('chVerdictBoard');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879';
  }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded && e.computed.corr_24h != null).slice(-24).map((e) => e.computed.corr_24h);
  const sp = $('chBoardSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('chBoardSparkLabel', `24h corr · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('chBoardSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('chBubble');
      if (b) { b.classList.remove('ww-talk'); void b.offsetWidth; b.classList.add('ww-talk'); }
    }
  }
  if (rowsEl) {
    $('chLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
    rowsEl.innerHTML = '';
    const notes = (L.log || []).slice().reverse().slice(0, 40);
    if (!notes.length) rowsEl.innerHTML = '<div class="lm-empty">No notes yet.</div>';
    for (const e of notes) {
      const row = document.createElement('div');
      row.className = 'lm-row';
      const head = document.createElement('button');
      head.className = 'lm-rowhead';
      const tt = document.createElement('span'); tt.className = 'lm-t';
      const dt = new Date(e.t);
      tt.textContent = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
        dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      const vv = document.createElement('span');
      vv.className = 'lm-v ' + (e.verdict === 'useful' ? 'lm-v-useful' : e.verdict === 'insufficient data' ? 'lm-v-insuf' : 'lm-v-not');
      vv.textContent = e.verdict;
      const f = document.createElement('span'); f.className = 'lm-f'; f.textContent = e.finding;
      head.append(tt, vv, f);
      const det = document.createElement('div');
      det.className = 'lm-detail'; det.hidden = true;
      const col = e.collected || {};
      det.innerHTML =
        '<div class="lm-sec"><span class="lm-k">COLLECTED</span><br>' +
        (col.source || 'XRP + BTC candles') + '<br>' + (col.window || '') + '</div>' +
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

/* Cherry fragment entry point: called by the boot code the coordinator adds. */
function initCherry() {
  initCherryAnim();
  initCherryChat();
  loadCherryVerdict();
}
