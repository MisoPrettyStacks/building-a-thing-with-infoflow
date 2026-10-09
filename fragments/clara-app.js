/* ---------------- Clara: lab (fragment) ---------------- */
function initClaraAnim() {
  const img = $('clHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'clara.webp', WRITE = 'clara-write.webp', BLINK = 'clara-blink.webp';
  let ready = 0;
  const go = () => { if (++ready >= 2) start(); };
  const fallback = setTimeout(() => start(), 4000);
  [WRITE, BLINK].forEach((src) => { const im = new Image(); im.onload = go; im.onerror = go; im.src = src; });
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
        blinkTimer = setInterval(() => { show(BLINK); setTimeout(() => show(writing ? WRITE : BASE), 170); }, 4200);
      } else if (!active && writeTimer) { clearInterval(writeTimer); clearInterval(blinkTimer); writeTimer = blinkTimer = null; show(BASE); }
    };
    new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; kick(); }, { threshold: 0.1 }).observe(img);
    document.addEventListener('visibilitychange', () => { pageVisible = !document.hidden; kick(); });
    kick();
  }
}

function initClaraChat() {
  const log = $('clChatLog'), input = $('clChatText'), send = $('clChatSend'), chips = $('clChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'wchat-row ' + who;
    if (who === 'clara') { const av = document.createElement('img'); av.src = 'clara-headshot.webp'; av.alt = 'Clara'; row.appendChild(av); }
    const b = document.createElement('div'); b.className = 'wchat-bubble'; b.textContent = text;
    row.appendChild(b); log.appendChild(row); scroll();
  };
  const CHIP_QS = ["What is the quarter-hour effect?", "What's your verdict?", "Is it in the forecast?", "When do you abstain?"];
  if (chips) { chips.innerHTML = ''; for (const q of CHIP_QS) { const c = document.createElement('button'); c.type = 'button'; c.className = 'wchat-chip'; c.textContent = q; c.addEventListener('click', () => { input.value = q; doSend(); }); chips.appendChild(c); } }
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('claraChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'wchat-row clara';
    typing.innerHTML = '<img src="clara-headshot.webp" alt="Clara"><div class="wchat-bubble"><span class="wchat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (claraIsIpProbe(text)) { ipCount++; try { localStorage.setItem('claraChatIpCount', String(ipCount)); } catch { /* private mode */ } reply = ipCount >= 3 ? claraRepeatRefusal() : claraAnswer(text); }
    else reply = claraAnswer(text);
    setTimeout(() => { typing.remove(); bubble('clara', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('clara', "Hello! I'm Clara \ud83d\udd50 Ask me about the quarter-hour grid \u2014 why the :00/:15/:30/:45 boundaries might carry a footprint, and what I'd need to see before I tilt!"), 800);
}

async function loadClaraVerdict() {
  const panel = $('clPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'clara_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('clVerdict');
  badge.textContent = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.className = 'wv-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('clPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  $('clEvidence').innerHTML = 'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes' +
    (ev.member_n >= 200 ? ' · out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : ' · scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('clDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) => '<div class="wv-line"><span class="wv-d">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('clHypotheses').innerHTML = (doc.hypotheses || []).map((h) => '<div class="wv-hyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' + (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') || '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('clMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' + esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((x) => '<a href="' + esc(x.id) + '" target="_blank" rel="noopener">' + esc(x.title.length > 60 ? x.title.slice(0, 60) + '…' : x.title) + '</a>').join(' · ') : '');
}

function renderClaraPanel(summary) {
  const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  const sb = summary && summary.windows && summary.windows.all && summary.windows.all.boundary;
  if (sb && $('clBrier')) {
    setT('clBrier', sb.brierBoundary != null && isFinite(sb.brierBoundary) ? sb.brierBoundary.toFixed(5) : '—');
    setT('clBrierN', 'n=' + sb.n + ' scored' + (sb.brierBoundary != null && sb.brierBase != null && sb.brierBoundary < sb.brierBase ? ' · beats baseline ✓' : ''));
    if (sb.skill24h && sb.skill24h.n >= 30) { setT('clSkill', (sb.skill24h.hitRate * 100).toFixed(1) + '%'); setT('clSkillSub', 'n=' + sb.skill24h.n + ' · 24h direction'); }
  }
  const S = summary && summary.boundary;
  if (S) {
    const c = S;
    setT('clPhase', c.phaseMin != null ? c.phaseMin + ' min' : '—');
    setT('clBurst', c.burst != null ? '×' + c.burst.toFixed(2) : '—');
    setT('clTilt', (c.bias >= 0 ? '+' : '') + (c.bias || 0).toFixed(4));
    setT('clPhaseSub', c.degraded ? 'feed blind' : c.warmingUp ? 'building history' : 'minutes into the quarter');
    setT('clBurstSub', c.degraded ? 'feed blind' : c.warmingUp ? 'building history' : 'boundary volume vs off-grid');
    setT('clTiltSub', c.degraded ? 'feed blind' : c.warmingUp ? 'building history' : 'boundary tilt');
    setT('clStatus', c.degraded ? 'Blind' : c.warmingUp ? 'Warming up' : 'Live');
    setT('clSignalState', (c.degraded || c.warmingUp) ? 'warming up' : Math.abs(c.bias || 0) >= 0.004 ? 'decisive read' : 'abstaining');
  }
  const spark = $('clSpark');
  if (spark) {
    const g = spark.getContext('2d');
    g.clearRect(0, 0, spark.width, spark.height);
    const pts = ((summary && summary.clara && summary.clara.log) || []).filter((e) => e.computed && !e.computed.degraded && e.computed.bias != null).slice(-40).map((e) => e.computed.bias);
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      g.strokeStyle = '#888'; g.lineWidth = 1.5; g.beginPath();
      pts.forEach((v, i) => { const x = 4 + (i / (pts.length - 1)) * (spark.width - 8); const y = spark.height - 4 - ((v - mn) / rg) * (spark.height - 8); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
    }
  }
  const L = summary && summary.clara;
  const rowsEl = $('clLogRows');
  const bubble = $('clBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    setT('clBoardRet', `last boundary bar  ${c.boundary_ret_bps != null ? (c.boundary_ret_bps >= 0 ? '+' : '') + c.boundary_ret_bps.toFixed(1) + ' bps' : '—'}`);
    setT('clBoardBurst', `burst ×${c.burst != null ? c.burst.toFixed(2) : '—'} · persistence ${c.persistence != null ? (c.persistence * 100).toFixed(0) + '%' : '—'}`);
    setT('clBoardTilt', `boundary tilt  ${c.bias >= 0 ? '+' : ''}${(c.bias || 0).toFixed(4)}`);
  } else {
    setT('clBoardRet', c && c.degraded ? 'feed blind…' : 'warming up…');
  }
  const vEl = $('clBoardVerdict');
  if (vEl) { vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`; vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879'; }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded && e.computed.bias != null).slice(-24).map((e) => e.computed.bias);
  const sp = $('clBoardSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) => (300 * i / (pts.length - 1)).toFixed(1) + ',' + (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('clBoardSparkLabel', `boundary tilt · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('clBoardSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) { bubble.textContent = short; const b = $('clBubble'); if (b) { b.classList.remove('ww-talk'); void b.offsetWidth; b.classList.add('ww-talk'); } }
  }
  if (rowsEl) {
    $('clLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
    rowsEl.innerHTML = '';
    const notes = (L.log || []).slice().reverse().slice(0, 40);
    if (!notes.length) rowsEl.innerHTML = '<div class="lm-empty">No notes yet.</div>';
    for (const e of notes) {
      const row = document.createElement('div'); row.className = 'lm-row';
      const head = document.createElement('button'); head.className = 'lm-rowhead';
      const tt = document.createElement('span'); tt.className = 'lm-t';
      const dt = new Date(e.t);
      tt.textContent = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      const vv = document.createElement('span');
      vv.className = 'lm-v ' + (e.verdict === 'useful' ? 'lm-v-useful' : e.verdict === 'insufficient data' ? 'lm-v-insuf' : 'lm-v-not');
      vv.textContent = e.verdict;
      const f = document.createElement('span'); f.className = 'lm-f'; f.textContent = e.finding;
      head.append(tt, vv, f);
      const det = document.createElement('div'); det.className = 'lm-detail'; det.hidden = true;
      det.innerHTML = '<div class="lm-sec"><span class="lm-k">CHECKS</span><br>' + (e.checks || []).map((k) => '<span class="' + (k.pass ? 'lm-check-pass' : 'lm-check-fail') + '">' + (k.pass ? '✓' : '✗') + '</span> ' + k.name + ' — ' + k.detail).join('<br>') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">WHY</span><br>' + (e.verdict_why || '') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">MATHEMATICAL EFFECT</span><br>' + (e.math_effect ? e.math_effect.detail : '') + '</div>';
      head.addEventListener('click', () => { det.hidden = !det.hidden; });
      row.append(head, det);
      rowsEl.appendChild(row);
    }
  }
}
