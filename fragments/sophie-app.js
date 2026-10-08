/* ---------------- Sophie: session-seasonality lab (fragment) ---------------- */
/* Assembly: index.html includes fragments/sophie-section.html; this script is
   concatenated after app.js. Relies on app.js helpers: $(), setT(),
   DATA_BASE, esc. Chat engine: lib/sophiechat.js (sophieAnswer,
   sophieIsIpProbe, sophieRepeatRefusal, SOPHIE_CHAT_VERSION). */

/* Sophie flipbook animation: write arm moves, she blinks. */
function initSophieAnim() {
  const img = $('soHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'sophie.webp', WRITE = 'sophie-write.webp', BLINK = 'sophie-blink.webp';
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

/* ---------------- Sophie DM chat ---------------- */
function initSophieChat() {
  const log = $('soChatLog'), input = $('soChatText'), send = $('soChatSend'), chips = $('soChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'wchat-row ' + who;
    if (who === 'sophie') {
      const av = document.createElement('img');
      av.src = 'sophie-headshot.webp'; av.alt = 'Sophie';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'wchat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['Which session is it now?', "What's your verdict?", 'Is it in the forecast?', 'How do you measure time-of-day effects?'];
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
  try { ipCount = parseInt(localStorage.getItem('sophieChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'wchat-row sophie';
    typing.innerHTML = '<img src="sophie-headshot.webp" alt="Sophie"><div class="wchat-bubble"><span class="wchat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (sophieIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('sophieChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? sophieRepeatRefusal() : sophieAnswer(text);
    } else {
      reply = sophieAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('sophie', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('sophie', "Hi! I'm Sophie 🪸 Ask me anything about session rhythms — my verdicts, time-of-day effects, or how I decide what enters the forecast!"), 800);
}

/* ---------------- Sophie's standing verdict ---------------- */
async function loadSophieVerdict() {
  const panel = $('soPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'sophie_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('soVerdictBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'wv-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('soPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('soEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · decisive seasonality <b>' + pct(ev.decisive_frac) + '</b> · ' +
    'expressive cycles <b>' + (ev.decisive_cycles || 0) + '</b> · ' +
    (ev.member_n >= 200
      ? 'out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  $('soDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="wv-line"><span class="wv-d">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('soHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="wv-hyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>' +
    'status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('soMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' +
    esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + esc(p.id) + '" target="_blank" rel="noopener">' + esc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Sophie live panel ---------------- */
function fmtUtcHour(h) { return String(h).padStart(2, '0') + ':00 UTC'; }

let soVerdictFetched = false; // standing verdict fetched once per page load

function renderSophiePanel(summary) {
  const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  // the standing verdict lives here too: pull sophie_supervisor.json on first render
  if (!soVerdictFetched) { soVerdictFetched = true; loadSophieVerdict(); }
  // scoreboard
  if ($('soSkill')) {
    const sb = summary && summary.windows && summary.windows.all && summary.windows.all.session;
    if (sb) {
      setT('soSkill', sb.brierSession != null ? sb.brierSession.toFixed(5) : '—');
      setT('soSkillSub', 'n=' + sb.n + ' scored' + (sb.brierSession != null && sb.brierSession < sb.brierBase ? ' · beats baseline ✓' : ''));
      if (sb.skill24h && sb.skill24h.n >= 30) {
        setT('soSkill24', (sb.skill24h.hitRate * 100).toFixed(1) + '%');
        setT('soSkill24Sub', 'n=' + sb.skill24h.n + ' · 24h direction');
      }
    }
  }
  // signal cards from live summary.session
  const S = summary && summary.session;
  if (S) {
    const b = S.bias || 0;
    const dirWord = b > 0.001 ? 'warm · upward tilt' : b < -0.001 ? 'cool · downward tilt' : 'quiet';
    setT('soTilt', (b >= 0 ? '+' : '') + b.toFixed(4));
    setT('soTiltSub', S.degraded ? 'bar history unreadable' : S.warmingUp ? 'building a week of bars' : dirWord);
    setT('soSession', S.session || '—');
    setT('soBestHour', S.bestHour != null ? fmtUtcHour(S.bestHour) : '—');
    setT('soBestHourSub', S.bestHour != null && S.hourlyMeans && S.hourlyMeans[S.bestHour] != null
      ? 'mean ' + (S.hourlyMeans[S.bestHour] >= 0 ? '+' : '') + S.hourlyMeans[S.bestHour].toFixed(6)
      : 'historical hourly mean');
    setT('soStatus', S.degraded ? 'unreadable' : S.warmingUp ? 'warming up' : 'live');
    setT('soStatusSub', S.degraded ? 'abstaining' : S.warmingUp ? 'needs a week of bars' : 'reading the clock');
    const w = S.weight || 0;
    setT('soVerdict', w > 0 ? 'Active' : 'Scored only');
    const tilt = $('soTilt');
    if (tilt) tilt.style.color = b > 0.001 ? '#fb7185' : b < -0.001 ? '#8fa3bd' : '';
  }
  // spark canvas: seasonal tilt history
  const spark = $('soSpark');
  if (spark) {
    const g = spark.getContext('2d');
    g.clearRect(0, 0, spark.width, spark.height);
    const pts = (summary && summary.sophie && summary.sophie.log || [])
      .filter((e) => e.computed && e.computed.bias != null && !e.computed.degraded)
      .slice(-40).map((e) => e.computed.bias);
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      g.strokeStyle = '#fb7185'; g.lineWidth = 1.5; g.beginPath();
      pts.forEach((v, i) => {
        const x = 4 + (i / (pts.length - 1)) * (spark.width - 8);
        const y = spark.height - 4 - ((v - mn) / rg) * (spark.height - 8);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.stroke();
    }
  }
  // lab panel: board + notebook
  const L = summary && summary.sophie;
  const rowsEl = $('soLogRows');
  const bubble = $('soBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    setT('soBoardTilt', 'warming up…'); setT('soBoardSession', ''); setT('soBoardBest', ''); setT('soBoardVerdict', '');
    const sp = $('soBoardSpark'); if (sp) sp.setAttribute('points', '');
    setT('soBoardSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Sophie is setting up her lab — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    const dirWord = c.bias > 0.001 ? 'warm (upward tilt)' : c.bias < -0.001 ? 'cool (downward tilt)' : 'quiet';
    setT('soBoardTilt', `seasonal tilt  ${c.bias >= 0 ? '+' : ''}${c.bias.toFixed(4)}  (${dirWord})`);
    setT('soBoardSession', `session ${c.session || '—'} · target hours ${(c.target_hours || []).map(fmtUtcHour).join(', ') || '—'}`);
    setT('soBoardBest', c.best_hour != null ? `strongest hour ${fmtUtcHour(c.best_hour)}` : 'no hourly means yet');
  } else {
    setT('soBoardTilt', c && c.degraded ? 'bar history unreadable…' : 'warming up…');
    setT('soBoardSession', 'collecting history…'); setT('soBoardBest', '');
  }
  const vEl = $('soBoardVerdict');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879';
  }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded && e.computed.bias != null).slice(-24).map((e) => e.computed.bias);
  const sp = $('soBoardSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('soBoardSparkLabel', `seasonal tilt · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('soBoardSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('soBubble');
      if (b) { b.classList.remove('ww-talk'); void b.offsetWidth; b.classList.add('ww-talk'); }
    }
  }
  if (rowsEl) {
    $('soLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
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
        (col.source || '5-minute XRP candles') + '<br>' + (col.window || '') + '<br>' + (col.sessions || '') + '</div>' +
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

/* Sophie fragment entry point: called by the boot code the coordinator adds.
   The render loop should also call renderSophiePanel(summary) on each refresh. */
function initSophie() {
  initSophieAnim();
  initSophieChat();
  loadSophieVerdict();
}
