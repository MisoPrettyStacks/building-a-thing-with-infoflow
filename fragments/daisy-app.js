// ---- Daisy fragment (paste into app.js) ----
// import: import { daisyAnswer, daisyIsIpProbe, daisyRepeatRefusal } from './lib/daisychat.js';
// wire: call initDaisy() in boot() and renderDaisyPanel(summary) in loadSummary()'s render chain.

/* ---------------- Daisy's lab ---------------- */
function renderDaisyPanel(summary) {
  if (!$('daBoardBias')) return;
  const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  const dv = summary && summary.deriv;
  const sb = summary && summary.windows && summary.windows.all && summary.windows.all.deriv;
  // live stat cards
  if (dv) {
    const b = dv.bias || 0;
    const dirWord = b > 0.0005 ? 'crowded shorts' : b < -0.0005 ? 'crowded longs' : 'balanced';
    setT('daTilt', (b >= 0 ? '+' : '') + b.toFixed(4));
    setT('daTiltSub', dirWord + (b > 0.0005 ? ' · shorts packed (bullish tilt)' : b < -0.0005 ? ' · longs packed (bearish tilt)' : ''));
    setT('daFunding', dv.funding8h != null ? (dv.funding8h * 100).toFixed(4) + '%/8h' : '—');
    setT('daFundingSub', dv.funding8h == null ? '—'
      : dv.funding8h > 0.00005 ? 'longs paying — crowded long side'
      : dv.funding8h < -0.00005 ? 'shorts paying — crowded short side'
      : 'near neutral — balanced crowd');
    setT('daOI', dv.oiTrend != null ? (dv.oiTrend >= 0 ? '+' : '') + (dv.oiTrend * 100).toFixed(1) + '%' : '—');
    setT('daOISub', dv.oiRising ? 'rising — fresh money confirming' : 'flat/falling — read held lightly');
    setT('daStatus', dv.degraded ? 'Blind' : dv.warmingUp ? 'Warming up' : 'Live');
    setT('daStatusSub', dv.degraded ? 'feed unreachable — abstaining' : 'public derivatives feed');
    const w = dv.weight || 0;
    setT('daWeight', w > 0 ? 'Active' : 'Scored only');
    setT('daWeightNote', w > 0 ? 'blended at weight ' + w.toFixed(2) : 'scored only, not used');
  }
  if (sb && sb.n >= 30) {
    setT('daBrier', sb.brierDeriv != null ? sb.brierDeriv.toFixed(5) : '—');
    setT('daBrierN', 'n=' + sb.n + ' scored' + (sb.brierDeriv != null && sb.brierBase != null && sb.brierDeriv < sb.brierBase ? ' · beats baseline ✓' : ''));
    if (sb.skill24h && sb.skill24h.n >= 30) {
      setT('daSkill', (sb.skill24h.hitRate * 100).toFixed(1) + '%');
      setT('daSkillSub', 'n=' + sb.skill24h.n + ' · 24h direction');
    }
  }
  // sparkline of the tilt across recent cycles
  const L = summary && summary.daisy;
  const cv = $('daSpark');
  if (cv) {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    const pts = (L && L.log ? L.log : []).filter((e) => e.computed && !e.computed.degraded && !e.computed.warming_up).slice(-40).map((e) => e.computed.bias);
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      g.strokeStyle = '#a8842c'; g.lineWidth = 1.5; g.beginPath();
      pts.forEach((v, i) => {
        const x = 150 * i / (pts.length - 1), y = 36 - ((v - mn) / rg) * 32;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.stroke();
    }
  }
  // lab panel: board + notebook
  const rowsEl = $('daLog');
  const bubble = $('daBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    setT('daBoardBias', 'warming up…'); setT('daBoardFund', ''); setT('daBoardOI', ''); setT('daBoardVerdict', '');
    const sp = $('daSparkLine'); if (sp) sp.setAttribute('points', '');
    setT('daSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Daisy is setting up her lab — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    const dirWord = c.bias > 0.0005 ? 'crowded shorts' : c.bias < -0.0005 ? 'crowded longs' : 'balanced';
    setT('daBoardBias', `positioning tilt  ${c.bias >= 0 ? '+' : ''}${c.bias.toFixed(4)}  (${dirWord})`);
    setT('daBoardFund', `funding  ${c.funding_8h != null ? (c.funding_8h * 100).toFixed(4) + '%/8h' : '—'}`);
    setT('daBoardOI', `open interest  ${c.oi_trend != null ? (c.oi_trend >= 0 ? '+' : '') + (c.oi_trend * 100).toFixed(1) + '%' : '—'}`);
  } else {
    setT('daBoardBias', c && c.degraded ? 'feed blind…' : 'warming up…');
    setT('daBoardFund', 'collecting history…'); setT('daBoardOI', '');
  }
  const vEl = $('daBoardVerdict');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879';
  }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded).slice(-24).map((e) => e.computed.bias);
  const sp = $('daSparkLine');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('daSparkLabel', `positioning tilt · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('daSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('daBubble');
      if (b) { b.classList.remove('dd-talk'); void b.offsetWidth; b.classList.add('dd-talk'); }
    }
  }
  if (rowsEl) {
    $('daLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
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
        (col.source || 'derivatives feed') + ' · ' + (col.window || '') + '</div>' +
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

/* ---------------- Daisy's standing verdict ---------------- */
async function loadDaisyVerdict() {
  const panel = $('daVerdict');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'daisy_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('daVBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'dv-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('daVPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('daVEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · decisive positioning <b>' + pct(ev.decisive_frac) + '</b> · ' +
    'crowded-long cycles <b>' + (ev.crowded_long_cycles || 0) + '</b> · crowded-short cycles <b>' + (ev.crowded_short_cycles || 0) + '</b> · ' +
    (ev.member_n >= 200
      ? 'out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('daDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="dv-line"><span class="dv-d">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('daHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="dv-hyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>' +
    'status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('daVMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' +
    esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + esc(p.id) + '" target="_blank" rel="noopener">' + esc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Daisy DM chat ---------------- */
function initDaisyChat() {
  const log = $('daChatLog'), input = $('daChatText'), send = $('daChatSend'), chips = $('daChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'dchat-row ' + who;
    if (who === 'daisy') {
      const av = document.createElement('img');
      av.src = 'daisy-headshot.webp'; av.alt = 'Daisy';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'dchat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What is a funding rate?', "What's your verdict?", 'Is it in the forecast?', 'What do you do?'];
  if (chips) {
    chips.innerHTML = '';
    for (const q of CHIP_QS) {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'dchat-chip'; c.textContent = q;
      c.addEventListener('click', () => { input.value = q; doSend(); });
      chips.appendChild(c);
    }
  }
  // repeat IP probers are counted (per browser) and get a firmer refusal
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('daisyChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'dchat-row daisy';
    typing.innerHTML = '<img src="daisy-headshot.webp" alt="Daisy"><div class="dchat-bubble"><span class="dchat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (daisyIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('daisyChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? daisyRepeatRefusal() : daisyAnswer(text);
    } else {
      reply = daisyAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('daisy', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('daisy', "Hi! I'm Daisy 🌼 Ask me anything about funding rates, open interest, crowded positioning — my verdicts, how I read the crowd, or how I decide what enters the forecast!"), 800);
}

/* ---------------- Daisy flipbook animation ---------------- */
function initDaisyAnim() {
  const img = $('daHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'daisy.webp', WRITE = 'daisy-write.webp', BLINK = 'daisy-blink.webp';
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

/* ---------------- Daisy: wire everything ---------------- */
function initDaisy() {
  initDaisyAnim();
  initDaisyChat();
  loadDaisyVerdict();
}
