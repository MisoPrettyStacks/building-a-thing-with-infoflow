/* ---------------- Reah: lab (fragment) ---------------- */
function initReahAnim() {
  const img = $('raHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'reah.webp', WRITE = 'reah-write.webp', BLINK = 'reah-blink.webp';
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

function initReahChat() {
  const log = $('raChatLog'), input = $('raChatText'), send = $('raChatSend'), chips = $('raChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'wchat-row ' + who;
    if (who === 'reah') { const av = document.createElement('img'); av.src = 'reah-headshot.webp'; av.alt = 'Reah'; row.appendChild(av); }
    const b = document.createElement('div'); b.className = 'wchat-bubble'; b.textContent = text;
    row.appendChild(b); log.appendChild(row); scroll();
  };
  const CHIP_QS = ["What is mean reversion?", "What's your verdict?", "Is it in the forecast?", "When do you abstain?"];
  if (chips) { chips.innerHTML = ''; for (const q of CHIP_QS) { const c = document.createElement('button'); c.type = 'button'; c.className = 'wchat-chip'; c.textContent = q; c.addEventListener('click', () => { input.value = q; doSend(); }); chips.appendChild(c); } }
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('reahChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'wchat-row reah';
    typing.innerHTML = '<img src="reah-headshot.webp" alt="Reah"><div class="wchat-bubble"><span class="wchat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (reahIsIpProbe(text)) { ipCount++; try { localStorage.setItem('reahChatIpCount', String(ipCount)); } catch { /* private mode */ } reply = ipCount >= 3 ? reahRepeatRefusal() : reahAnswer(text); }
    else reply = reahAnswer(text);
    setTimeout(() => { typing.remove(); bubble('reah', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('reah', "Hello! I'm Reah \ud83d\udcc9\u27a1\ufe0f Ask me about fading the last move \u2014 my verdicts, how I size a tilt, or why most moves aren't worth fading!"), 800);
}

async function loadReahVerdict() {
  const panel = $('raPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'reah_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('raVerdict');
  badge.textContent = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.className = 'wv-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('raPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  $('raEvidence').innerHTML = 'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes' +
    (ev.member_n >= 200 ? ' · out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : ' · scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('raDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) => '<div class="wv-line"><span class="wv-d">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('raHypotheses').innerHTML = (doc.hypotheses || []).map((h) => '<div class="wv-hyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' + (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') || '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('raMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' + esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((x) => '<a href="' + esc(x.id) + '" target="_blank" rel="noopener">' + esc(x.title.length > 60 ? x.title.slice(0, 60) + '…' : x.title) + '</a>').join(' · ') : '');
}

function renderReahPanel(summary) {
  const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  const sb = summary && summary.windows && summary.windows.all && summary.windows.all.reversion;
  if (sb && $('raBrier')) {
    setT('raBrier', sb.brierReversion != null && isFinite(sb.brierReversion) ? sb.brierReversion.toFixed(5) : '—');
    setT('raBrierN', 'n=' + sb.n + ' scored' + (sb.brierReversion != null && sb.brierBase != null && sb.brierReversion < sb.brierBase ? ' · beats baseline ✓' : ''));
    if (sb.skill24h && sb.skill24h.n >= 30) { setT('raSkill', (sb.skill24h.hitRate * 100).toFixed(1) + '%'); setT('raSkillSub', 'n=' + sb.skill24h.n + ' · 24h direction'); }
  }
  const S = summary && summary.reversion;
  if (S) {
    const c = S;
    setT('raRet', c.lastRetBps != null ? (c.lastRetBps >= 0 ? '+' : '') + c.lastRetBps.toFixed(1) + ' bps' : '—');
    setT('raFlow', c.volRatio != null ? '×' + c.volRatio.toFixed(2) : '—');
    setT('raTilt', (c.bias >= 0 ? '+' : '') + (c.bias || 0).toFixed(4));
    setT('raRetSub', c.degraded ? 'feed blind' : c.warmingUp ? 'building history' : 'last closed 5-min bar');
    setT('raFlowSub', c.degraded ? 'feed blind' : c.warmingUp ? 'building history' : 'volume vs 24-bar median');
    setT('raTiltSub', c.degraded ? 'feed blind' : c.warmingUp ? 'building history' : 'fade tilt');
    setT('raStatus', c.degraded ? 'Blind' : c.warmingUp ? 'Warming up' : 'Live');
    setT('raSignalState', (c.degraded || c.warmingUp) ? 'warming up' : Math.abs(c.bias || 0) >= 0.004 ? 'decisive read' : 'abstaining');
  }
  const spark = $('raSpark');
  if (spark) {
    const g = spark.getContext('2d');
    g.clearRect(0, 0, spark.width, spark.height);
    const pts = ((summary && summary.reah && summary.reah.log) || []).filter((e) => e.computed && !e.computed.degraded && e.computed.bias != null).slice(-40).map((e) => e.computed.bias);
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      g.strokeStyle = '#888'; g.lineWidth = 1.5; g.beginPath();
      pts.forEach((v, i) => { const x = 4 + (i / (pts.length - 1)) * (spark.width - 8); const y = spark.height - 4 - ((v - mn) / rg) * (spark.height - 8); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
    }
  }
  const L = summary && summary.reah;
  const rowsEl = $('raLogRows');
  const bubble = $('raBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    setT('raBoardMove', `last bar  ${c.last_ret_bps != null ? (c.last_ret_bps >= 0 ? '+' : '') + c.last_ret_bps.toFixed(1) + ' bps' : '—'}`);
    setT('raBoardFlow', `flow intensity  ${c.vol_ratio != null ? '×' + c.vol_ratio.toFixed(2) : '—'}${c.fading ? '  (fading)' : ''}`);
    setT('raBoardTilt', `reversion tilt  ${c.bias >= 0 ? '+' : ''}${(c.bias || 0).toFixed(4)}`);
  } else {
    setT('raBoardMove', c && c.degraded ? 'feed blind…' : 'warming up…');
  }
  const vEl = $('raBoardVerdict');
  if (vEl) { vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`; vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879'; }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded && e.computed.bias != null).slice(-24).map((e) => e.computed.bias);
  const sp = $('raBoardSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) => (300 * i / (pts.length - 1)).toFixed(1) + ',' + (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('raBoardSparkLabel', `reversion tilt · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('raBoardSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) { bubble.textContent = short; const b = $('raBubble'); if (b) { b.classList.remove('ww-talk'); void b.offsetWidth; b.classList.add('ww-talk'); } }
  }
  if (rowsEl) {
    $('raLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
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
