/* ---------------- Nora's lab (network health) — FRAGMENT ----------------
 * Coordinator wiring:
 *   - call initNora() in boot() (next to initWendyAnim()/initWendyChat()).
 *   - call renderNoraPanel(summary) inside loadSummary() after the Wendy
 *     render, so her cards, chalkboard and notebook refresh every cycle.
 * Relies on app.js globals: $, setT, DATA_BASE. Uses noraAnswer,
 * noraIsIpProbe, noraRepeatRefusal from lib/norachat.js (same pattern as
 * wendychat.js).
 */

/* ---------------- Nora's standing verdict ---------------- */
async function loadNoraVerdict() {
  const panel = $('noPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'nora_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('noBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'no-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('noVerdict').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('noEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · decisive crowd <b>' + pct(ev.decisive_frac) + '</b> · ' +
    (ev.member_n >= 200
      ? 'out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('noDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="no-line"><span class="no-d">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('noHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="no-hyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>' +
    'status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('noMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' +
    esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + esc(p.id) + '" target="_blank" rel="noopener">' + esc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Nora DM chat ---------------- */
function initNoraChat() {
  const log = $('noChatLog'), input = $('noChatText'), send = $('noChatSend'), chips = $('noChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'nchat-row ' + who;
    if (who === 'nora') {
      const av = document.createElement('img');
      av.src = 'nora-headshot.webp'; av.alt = 'Nora';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'nchat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What do you watch?', "What's your verdict?", 'Is it in the forecast?', 'Crowd vs whales?'];
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
  try { ipCount = parseInt(localStorage.getItem('noraChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'nchat-row nora';
    typing.innerHTML = '<img src="nora-headshot.webp" alt="Nora"><div class="nchat-bubble"><span class="nchat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (noraIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('noraChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? noraRepeatRefusal() : noraAnswer(text);
    } else {
      reply = noraAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('nora', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('nora', "Hi! I'm Nora 💚 Ask me anything about network health — my verdicts, how I read the crowd, or how I decide what enters the forecast!"), 800);
}

/* ---------------- Nora flipbook animation ---------------- */
function initNoraAnim() {
  const img = $('noHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'nora.webp', WRITE = 'nora-write.webp', BLINK = 'nora-blink.webp';
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

/* ---------------- Nora's live panel (cards, chalkboard, notebook) ---------------- */
function noFmt(x) {
  if (x == null) return '—';
  const a = Math.abs(x);
  if (a >= 1e6) return (x / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return (x / 1e3).toFixed(1) + 'K';
  return String(Math.round(x));
}

function renderNoraPanel(summary) {
  // signal stat cards: summary.network
  const N = summary && summary.network;
  if (N) {
    const z = Number.isFinite(N.activityZ) ? N.activityZ : 0;
    const gardenWord = z > 0 ? 'blooming 🌿' : z < 0 ? 'wilting 🍂' : 'calm 🌱';
    setT('noTilt', (N.bias >= 0 ? '+' : '') + (N.bias != null ? N.bias.toFixed(4) : '—'));
    setT('noTiltSub', N.degraded ? 'blind — no read' : N.warmingUp ? 'warming up — abstaining' : gardenWord);
    setT('noTx', noFmt(N.txCount24h));
    setT('noTxSub', N.txCountMed7d != null ? 'median ' + noFmt(N.txCountMed7d) + ' / 7d' : 'median building…');
    setT('noAddrs', noFmt(N.uniqueAddrs24h));
    setT('noAddrsSub', 'distinct wallets');
    setT('noVol', noFmt(N.volumeXrp24h));
    setT('noStatus', N.degraded ? 'Blind' : N.warmingUp ? 'Warming up' : 'Live');
    setT('noStatusSub', N.degraded ? 'scan feed down' : N.warmingUp ? 'history building' : 'scan feed healthy');
    setT('noZ', (z >= 0 ? '+' : '') + z.toFixed(2));
    setT('noZSub', N.degraded || N.warmingUp ? 'no honest read' : gardenWord + ' vs norm');
  }
  const sb = summary && summary.windows && summary.windows.all && summary.windows.all.network;
  if (sb) {
    setT('noSkill', sb.brierNetwork != null ? sb.brierNetwork.toFixed(5) : '—');
    setT('noSkillSub', 'n=' + sb.n + ' scored' + (sb.brierNetwork != null && sb.brierBase != null && sb.brierNetwork < sb.brierBase ? ' · beats baseline ✓' : ''));
  }
  setT('noState', N && (N.degraded || N.warmingUp) ? 'warming up' : 'scored only, not used');
  // lab panel: board + notebook
  const L = summary && summary.nora;
  const rowsEl = $('noLog');
  const bubble = $('noBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    setT('noTiltLine', 'warming up…'); setT('noTxLine', ''); setT('noAddrsLine', ''); setT('noVerdictLine', '');
    const sp = $('noSpark'); if (sp) sp.setAttribute('points', '');
    setT('noSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Nora is setting up her lab — notebook entries appear after the next runner cycle.</div>';
    loadNoraVerdict();
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    const z = c.activity_z || 0;
    const gw = z > 0 ? 'blooming' : z < 0 ? 'wilting' : 'calm';
    setT('noTiltLine', 'activity tilt ' + (c.bias >= 0 ? '+' : '') + c.bias.toFixed(4) + ' — ' + gw);
    setT('noTxLine', 'payments 24h: ' + noFmt(c.tx_count_24h) + ' (median ' + noFmt(c.tx_count_med_7d) + ')');
    setT('noAddrsLine', 'wallets: ' + noFmt(c.unique_addrs_24h) + ' · moved ' + noFmt(c.volume_xrp_24h) + ' XRP');
  } else {
    setT('noTiltLine', c && c.degraded ? 'blind this cycle' : 'warming up…');
    setT('noTxLine', 'growing my history…'); setT('noAddrsLine', '');
  }
  const nvEl = $('noVerdictLine');
  if (nvEl) {
    nvEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    nvEl.style.color = n.verdict === 'useful' ? '#a7e8c9' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879';
  }
  // sparkline: activityZ history from the notebook window
  const zpts = (L.log || []).filter((e) => e.computed && !e.computed.degraded && !e.computed.warming_up && Number.isFinite(e.computed.activity_z)).slice(-24).map((e) => e.computed.activity_z);
  const sp = $('noSpark');
  if (sp) {
    if (zpts.length > 1) {
      const mn = Math.min.apply(null, zpts), mx = Math.max.apply(null, zpts), rg = (mx - mn) || 1;
      sp.setAttribute('points', zpts.map((v, i) =>
        (300 * i / (zpts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      sp.setAttribute('stroke', '#10b981');
      sp.setAttribute('stroke-width', '2');
      setT('noSparkLabel', `activity z · last ${zpts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('noSparkLabel', ''); }
  }
  if (bubble) {
    const short = (n.finding || '').length > 150 ? n.finding.slice(0, 150) + '…' : (n.finding || '');
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('noBubble');
      if (b) { b.classList.remove('no-talk'); void b.offsetWidth; b.classList.add('no-talk'); }
    }
  }
  // notebook rows (expandable, mirrored from Wendy's lab)
  if (rowsEl) {
    $('noLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
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
      const esc3 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      det.innerHTML =
        '<div class="lm-sec"><span class="lm-k">COLLECTED</span><br>' +
        esc3(col.source || 'XRP Ledger') + ' · ' + esc3(col.window || '') + '<br>' + esc3(col.pipeline || '') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">CHECKS</span><br>' +
        (e.checks || []).map((k) => '<span class="' + (k.pass ? 'lm-check-pass' : 'lm-check-fail') + '">' +
          (k.pass ? '✓' : '✗') + '</span> ' + esc3(k.name) + ' — ' + esc3(k.detail)).join('<br>') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">WHY</span><br>' + esc3(e.verdict_why || '') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">MATHEMATICAL EFFECT</span><br>' + esc3((e.math_effect || {}).detail || '') + '</div>';
      head.addEventListener('click', () => { det.hidden = !det.hidden; });
      row.append(head, det);
      rowsEl.appendChild(row);
    }
  }
  loadNoraVerdict();
}

/* ---------------- Nora init ---------------- */
function initNora() {
  initNoraAnim();
  initNoraChat();
  // First paint with whatever summary app.js already holds; the coordinator
  // should also call renderNoraPanel(summary) inside loadSummary() each cycle.
  try { if (typeof summary !== 'undefined' && summary) renderNoraPanel(summary); } catch { /* summary not ready yet */ }
}
