/* ---------------- Lena: lab (fragment) ---------------- */
function initLenaAnim() {
  const img = $('lnHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'lena.webp', WRITE = 'lena-write.webp', BLINK = 'lena-blink.webp';
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

function initLenaChat() {
  const log = $('lnChatLog'), input = $('lnChatText'), send = $('lnChatSend'), chips = $('lnChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'wchat-row ' + who;
    if (who === 'lena') { const av = document.createElement('img'); av.src = 'lena-headshot.webp'; av.alt = 'Lena'; row.appendChild(av); }
    const b = document.createElement('div'); b.className = 'wchat-bubble'; b.textContent = text;
    row.appendChild(b); log.appendChild(row); scroll();
  };
  const CHIP_QS = ["What is venue lead-lag?", "What's your verdict?", "Is it in the forecast?", "When do you abstain?"];
  if (chips) { chips.innerHTML = ''; for (const q of CHIP_QS) { const c = document.createElement('button'); c.type = 'button'; c.className = 'wchat-chip'; c.textContent = q; c.addEventListener('click', () => { input.value = q; doSend(); }); chips.appendChild(c); } }
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('lenaChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'wchat-row lena';
    typing.innerHTML = '<img src="lena-headshot.webp" alt="Lena"><div class="wchat-bubble"><span class="wchat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (lenaIsIpProbe(text)) { ipCount++; try { localStorage.setItem('lenaChatIpCount', String(ipCount)); } catch { /* private mode */ } reply = ipCount >= 3 ? lenaRepeatRefusal() : lenaAnswer(text); }
    else reply = lenaAnswer(text);
    setTimeout(() => { typing.remove(); bubble('lena', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('lena', "Hello! I'm Lena \u26a1 Ask me about Binance leading Coinbase \u2014 the gap, the drift, and why I only follow a leader who's actually ahead!"), 800);
}

async function loadLenaVerdict() {
  const panel = $('lnPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'lena_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('lnVerdict');
  badge.textContent = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.className = 'wv-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('lnPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  $('lnEvidence').innerHTML = 'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes' +
    (ev.member_n >= 200 ? ' · out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : ' · scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('lnDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) => '<div class="wv-line"><span class="wv-d">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('lnHypotheses').innerHTML = (doc.hypotheses || []).map((h) => '<div class="wv-hyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' + (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') || '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('lnMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' + esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((x) => '<a href="' + esc(x.id) + '" target="_blank" rel="noopener">' + esc(x.title.length > 60 ? x.title.slice(0, 60) + '…' : x.title) + '</a>').join(' · ') : '');
}

function renderLenaPanel(summary) {
  const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  const sb = summary && summary.windows && summary.windows.all && summary.windows.all.leadlag;
  if (sb && $('lnBrier')) {
    setT('lnBrier', sb.brierLeadlag != null && isFinite(sb.brierLeadlag) ? sb.brierLeadlag.toFixed(5) : '—');
    setT('lnBrierN', 'n=' + sb.n + ' scored' + (sb.brierLeadlag != null && sb.brierBase != null && sb.brierLeadlag < sb.brierBase ? ' · beats baseline ✓' : ''));
    if (sb.skill24h && sb.skill24h.n >= 30) { setT('lnSkill', (sb.skill24h.hitRate * 100).toFixed(1) + '%'); setT('lnSkillSub', 'n=' + sb.skill24h.n + ' · 24h direction'); }
  }
  const S = summary && summary.leadlag;
  if (S) {
    const c = S;
    setT('lnGap', c.gapBps != null ? (c.gapBps >= 0 ? '+' : '') + c.gapBps.toFixed(1) + ' bps' : '—');
    setT('lnLead', c.leadRetBps != null ? (c.leadRetBps >= 0 ? '+' : '') + c.leadRetBps.toFixed(1) + ' bps' : '—');
    setT('lnTilt', (c.bias >= 0 ? '+' : '') + (c.bias || 0).toFixed(4));
    setT('lnGapSub', c.degraded ? 'feed blind' : c.warmingUp ? 'building history' : 'Binance minus Coinbase');
    setT('lnLeadSub', c.degraded ? 'feed blind' : c.warmingUp ? 'building history' : 'lead drift, last 15 min');
    setT('lnTiltSub', c.degraded ? 'feed blind' : c.warmingUp ? 'building history' : 'lead-lag tilt');
    setT('lnStatus', c.degraded ? 'Blind' : c.warmingUp ? 'Warming up' : 'Live');
    setT('lnSignalState', (c.degraded || c.warmingUp) ? 'warming up' : Math.abs(c.bias || 0) >= 0.004 ? 'decisive read' : 'abstaining');
  }
  const spark = $('lnSpark');
  if (spark) {
    const g = spark.getContext('2d');
    g.clearRect(0, 0, spark.width, spark.height);
    const pts = ((summary && summary.lena && summary.lena.log) || []).filter((e) => e.computed && !e.computed.degraded && e.computed.gap_bps != null).slice(-40).map((e) => e.computed.gap_bps);
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      g.strokeStyle = '#888'; g.lineWidth = 1.5; g.beginPath();
      pts.forEach((v, i) => { const x = 4 + (i / (pts.length - 1)) * (spark.width - 8); const y = spark.height - 4 - ((v - mn) / rg) * (spark.height - 8); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
    }
  }
  const L = summary && summary.lena;
  const rowsEl = $('lnLogRows');
  const bubble = $('lnBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    setT('lnBoardGap', `venue gap  ${c.gap_bps != null ? (c.gap_bps >= 0 ? '+' : '') + c.gap_bps.toFixed(1) + ' bps' : '—'}`);
    setT('lnBoardLead', `lead drift  ${c.lead_ret_bps != null ? (c.lead_ret_bps >= 0 ? '+' : '') + c.lead_ret_bps.toFixed(1) + ' bps' : '—'} · aligned ${c.aligned != null ? c.aligned : '—'}`);
    setT('lnBoardTilt', `lead-lag tilt  ${c.bias >= 0 ? '+' : ''}${(c.bias || 0).toFixed(4)}`);
  } else {
    setT('lnBoardGap', c && c.degraded ? 'feed blind…' : 'warming up…');
  }
  const vEl = $('lnBoardVerdict');
  if (vEl) { vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`; vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879'; }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded && e.computed.gap_bps != null).slice(-24).map((e) => e.computed.gap_bps);
  const sp = $('lnBoardSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) => (300 * i / (pts.length - 1)).toFixed(1) + ',' + (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('lnBoardSparkLabel', `venue gap (bps) · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('lnBoardSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) { bubble.textContent = short; const b = $('lnBubble'); if (b) { b.classList.remove('ww-talk'); void b.offsetWidth; b.classList.add('ww-talk'); } }
  }
  if (rowsEl) {
    $('lnLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
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
