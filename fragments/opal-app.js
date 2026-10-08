/* ---------------- Opal's lab (assembled fragment; expects $ and summary in scope) ---------------- */
function opEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
function opFmtUsd(x) {
  if (x == null || !isFinite(x)) return '—';
  const a = Math.abs(x);
  if (a >= 1e6) return '$' + (x / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return '$' + (x / 1e3).toFixed(0) + 'K';
  return '$' + Math.round(x);
}
function opDrawSpark(canvasId, vals) {
  const c = $(canvasId);
  if (!c) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  if (!vals || vals.length < 2) return;
  const mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rg = (mx - mn) || 1;
  ctx.strokeStyle = '#14b8a6'; ctx.lineWidth = 1.5; ctx.beginPath();
  vals.forEach((v, i) => {
    const x = (W * i) / (vals.length - 1);
    const y = H - 3 - ((v - mn) / rg) * (H - 6);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderOpalPanel(summary) {
  if (!$('opBoardBias')) return;
  const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  const ob = summary && summary.orderbook;
  const sb = summary && summary.windows && summary.windows.all && summary.windows.all.orderbook;
  // live stat cards
  if (ob) {
    const b = ob.bias || 0;
    const imb = ob.imbalance || 0;
    const tiltWord = b > 0.001 ? 'demand pressure' : b < -0.001 ? 'supply pressure' : 'quiet';
    setT('opFlowTilt', (b >= 0 ? '+' : '') + b.toFixed(4));
    setT('opFlowTiltSub', tiltWord);
    setT('opImb', (imb >= 0 ? '+' : '') + (imb * 100).toFixed(1) + '%');
    setT('opImbSub', imb > 0.02 ? 'bid-side heavy' : imb < -0.02 ? 'ask-side heavy' : 'balanced');
    setT('opSpread', ob.spreadBps != null ? ob.spreadBps.toFixed(1) + ' bps' : '—');
    setT('opSpreadSub', 'best bid ↔ best ask');
    setT('opDepth', opFmtUsd(ob.depthBid) + ' / ' + opFmtUsd(ob.depthAsk));
    setT('opDepthSub', 'bid / ask resting notional within 1% of mid');
    setT('opStatus', ob.degraded ? 'Book unseen' : ob.warmingUp ? 'Warming up' : 'Live');
    setT('opStatusSub', ob.degraded ? 'feed down — abstaining' : 'level-2 book read each cycle');
    const w = ob.weight || 0;
    setT('opWeight', w > 0 ? 'Active' : 'Scored only');
    setT('opWeightNote', w > 0 ? 'blended at weight ' + w.toFixed(2) : 'scored only, not used');
  }
  if (sb && sb.n >= 30) {
    setT('opBrier', sb.brierOrderbook != null ? sb.brierOrderbook.toFixed(5) : '—');
    setT('opBrierN', 'n=' + sb.n + ' scored' + (sb.brierOrderbook < sb.brierBase ? ' · beats baseline ✓' : ''));
    if (sb.skill24h && sb.skill24h.n >= 30) {
      setT('opSkill', (sb.skill24h.hitRate * 100).toFixed(1) + '%');
      setT('opSkillSub', 'n=' + sb.skill24h.n + ' · 24h direction');
    }
  }
  // chalkboard + notebook
  const L = summary && summary.opal;
  const rowsEl = $('opLogRows');
  const bubble = $('opBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    setT('opBoardBias', 'warming up…'); setT('opBoardImb', ''); setT('opBoardSpread', ''); setT('opBoardVerdict', '');
    const sp = $('opBoardSpark'); if (sp) sp.setAttribute('points', '');
    setT('opBoardSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Opal is setting up her lab — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    const dirWord = c.bias > 0.001 ? 'demand pressure' : c.bias < -0.001 ? 'supply pressure' : 'quiet';
    setT('opBoardBias', `book tilt  ${c.bias >= 0 ? '+' : ''}${c.bias.toFixed(4)}  (${dirWord})`);
    const imb = c.imbalance || 0;
    setT('opBoardImb', `imbalance  ${(imb >= 0 ? '+' : '')}${(imb * 100).toFixed(1)}%`);
    setT('opBoardSpread', `spread  ${c.spread_bps != null ? c.spread_bps.toFixed(1) + ' bps' : '—'}`);
  } else {
    setT('opBoardBias', c && c.degraded ? 'book unseen…' : 'warming up…');
    setT('opBoardImb', 'collecting reads…'); setT('opBoardSpread', '');
  }
  const vEl = $('opBoardVerdict');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879';
  }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded).slice(-24).map((e) => e.computed.bias);
  opDrawSpark('opSpark', pts);
  const sp = $('opBoardSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('opBoardSparkLabel', `book tilt · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('opBoardSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('opBubble');
      if (b) { b.classList.remove('op-talk'); void b.offsetWidth; b.classList.add('op-talk'); }
    }
  }
  if (rowsEl) {
    $('opLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
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
        opEsc(col.source || 'Coinbase order book') + ' · ' + opEsc(col.window || '') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">CHECKS</span><br>' +
        (e.checks || []).map((k) => '<span class="' + (k.pass ? 'lm-check-pass' : 'lm-check-fail') + '">' +
          (k.pass ? '✓' : '✗') + '</span> ' + opEsc(k.name) + ' — ' + opEsc(k.detail)).join('<br>') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">WHY</span><br>' + opEsc(e.verdict_why || '') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">MATHEMATICAL EFFECT</span><br>' + opEsc((e.math_effect || {}).detail || '') + '</div>';
      head.addEventListener('click', () => { det.hidden = !det.hidden; });
      row.append(head, det);
      rowsEl.appendChild(row);
    }
  }
}

/* ---------------- Opal's standing verdict ---------------- */
async function loadOpalVerdict() {
  const panel = $('opPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'opal_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('opBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'op-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('opPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('opEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · decisive book <b>' + pct(ev.decisive_frac) + '</b> · ' +
    (ev.member_n >= 200
      ? 'out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  $('opDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="op-line"><span class="op-d">' + opEsc(d.discipline) + ':</span> ' + opEsc(d.assessment) + '</div>').join('');
  $('opHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="op-hyp"><b>' + opEsc(h.id) + '</b> — ' + opEsc(h.claim) + '<br>' +
    'status: <span class="st ' + opEsc(h.status) + '">' + opEsc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + opEsc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('opMeta').innerHTML = 'Charter v' + opEsc(doc.charter_version) + ' · updated ' +
    opEsc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + opEsc(p.id) + '" target="_blank" rel="noopener">' + opEsc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Opal DM chat ---------------- */
function initOpalChat() {
  const log = $('opChatLog'), input = $('opChatText'), send = $('opChatSend'), chips = $('opChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'ochat-row ' + who;
    if (who === 'opal') {
      const av = document.createElement('img');
      av.src = 'opal-headshot.webp'; av.alt = 'Opal';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'ochat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What is order-book imbalance?', "What's your verdict?", 'Is it in the forecast?', 'What do you measure?'];
  if (chips) {
    chips.innerHTML = '';
    for (const q of CHIP_QS) {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'ochat-chip'; c.textContent = q;
      c.addEventListener('click', () => { input.value = q; doSend(); });
      chips.appendChild(c);
    }
  }
  // repeat IP probers are counted (per browser) and get a firmer refusal
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('opalChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'ochat-row opal';
    typing.innerHTML = '<img src="opal-headshot.webp" alt="Opal"><div class="ochat-bubble"><span class="ochat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (opalIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('opalChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? opalRepeatRefusal() : opalAnswer(text);
    } else {
      reply = opalAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('opal', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('opal', "Hi! I'm Opal 🦪 Ask me anything about the order book — imbalance, spread, depth, my verdicts, or how I decide what enters the forecast!"), 800);
}

/* ---------------- Opal flipbook animation ---------------- */
function initOpalAnim() {
  const img = $('opHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'opal.webp', WRITE = 'opal-write.webp', BLINK = 'opal-blink.webp';
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
    let writeTimer = null, blinkTimer = null;
    const show = (src) => { if (img.getAttribute('src') !== src) img.setAttribute('src', src); };
    const kick = () => {
      const active = onScreen && pageVisible;
      if (active && !writeTimer) {
        // writing pose: 1.6s every ~9s
        writeTimer = setInterval(() => {
          show(WRITE);
          setTimeout(() => show(BASE), 1600);
        }, 9000);
        // blink: 180ms every ~4.5s
        blinkTimer = setInterval(() => {
          show(BLINK);
          setTimeout(() => show(BASE), 180);
        }, 4500);
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

function initOpal() {
  initOpalAnim();
  if (typeof summary !== 'undefined' && summary) renderOpalPanel(summary);
  loadOpalVerdict();
  initOpalChat();
}
