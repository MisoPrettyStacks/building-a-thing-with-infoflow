/* ---------------- Sage's lab ---------------- */
// Expects globals from the page shell: $ (element getter) and DATA_BASE.
// Data contract (mirrors the Wendy side):
//   summary.stable = { bias, totalChange, usdtChange24h, usdcChange24h,
//                      degraded, warmingUp, cached, staleNote, weight }
//   summary.sage   = { latest, log }   (latest = newest buildSageNote output)
//   summary.windows.all.stable = { n, brierStable, brierBase, skill24h }
function fmtPct2(x) {
  if (x == null || !isFinite(x)) return '—';
  return (x >= 0 ? '+' : '') + x.toFixed(2) + '%';
}
function drawSparkInto(canvasId, vals) {
  const cv = document.getElementById(canvasId);
  if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (!vals || vals.length < 2) return;
  const mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rg = (mx - mn) || 1;
  ctx.strokeStyle = '#8aa888'; ctx.lineWidth = 1.5; ctx.beginPath();
  vals.forEach((v, i) => {
    const x = 4 + (cv.width - 8) * i / (vals.length - 1);
    const y = 4 + (cv.height - 8) * (1 - (v - mn) / rg);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
}
function renderSagePanel(summary) {
  if (!$('sgTilt')) return;
  const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  const st = summary && summary.stable;
  const sb = summary && summary.windows && summary.windows.all && summary.windows.all.stable;
  // live stat cards
  if (st) {
    const b = st.bias || 0;
    const tc = st.totalChange;
    const dirWord = tc != null ? (tc > 0.05 ? 'entering' : tc < -0.05 ? 'leaving' : 'calm') : 'quiet';
    setT('sgTilt', (b >= 0 ? '+' : '') + b.toFixed(4));
    setT('sgTiltSub', 'liquidity tide · ' + dirWord);
    setT('sgUsdt', fmtPct2(st.usdtChange24h));
    setT('sgUsdtSub', 'tether · 24h market cap');
    setT('sgUsdc', fmtPct2(st.usdcChange24h));
    setT('sgUsdcSub', 'usd-coin · 24h market cap');
    setT('sgStatus', st.degraded ? 'Blind' : st.warmingUp ? 'Warming up' : st.staleNote ? 'Cached' : 'Live');
    setT('sgStatusSub', st.degraded ? 'CoinGecko unreachable — abstaining'
      : st.staleNote ? String(st.staleNote)
      : st.cached ? 'hourly cache read' : 'fresh read');
    const w = st.weight || 0;
    setT('sgVerdict', w > 0 ? 'Active' : 'Scored only');
    setT('sgVerdictSub', w > 0 ? 'blended at weight ' + w.toFixed(2) : 'scored only, not used');
  }
  if (sb && sb.n >= 30) {
    setT('sgSkill', sb.brierStable.toFixed(5));
    setT('sgSkillSub', 'n=' + sb.n + ' scored' + (sb.brierStable < sb.brierBase ? ' · beats baseline ✓' : ''));
  }
  // lab panel: board + notebook
  const L = summary && summary.sage;
  const rowsEl = $('sgLog');
  const bubble = $('sgBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    setT('sgBias', 'warming up…'); setT('sgLiquidity', ''); setT('sgChange', ''); setT('sgBoardVerdict', '');
    const sp = $('sgBoardSpark'); if (sp) sp.setAttribute('points', '');
    setT('sgBoardSparkLabel', '');
    drawSparkInto('sgSpark', []);
    setT('sgDecisive', '—'); setT('sgDecisiveSub', 'awaiting notes');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Sage is setting up her lab — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    const tc = c.total_change_24h;
    const dirWord = tc != null ? (tc > 0.05 ? 'liquidity entering' : tc < -0.05 ? 'liquidity leaving' : 'calm') : 'quiet';
    setT('sgBias', `liquidity tilt  ${c.bias >= 0 ? '+' : ''}${c.bias.toFixed(4)}  (${dirWord})`);
    setT('sgLiquidity', `combined 24h change: ${fmtPct2(tc)}`);
    setT('sgChange', `USDT ${fmtPct2(c.usdt_change_24h)} · USDC ${fmtPct2(c.usdc_change_24h)}`);
  } else {
    setT('sgBias', c && c.degraded ? 'tide blind…' : 'warming up…');
    setT('sgLiquidity', 'waiting for a clean read…'); setT('sgChange', '');
  }
  const vEl = $('sgBoardVerdict');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#8aa888';
  }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded).slice(-24).map((e) => e.computed.bias);
  const sp = $('sgBoardSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('sgBoardSparkLabel', `liquidity tilt · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('sgBoardSparkLabel', ''); }
  }
  drawSparkInto('sgSpark', pts.slice(-60));
  // decisive-read share from the notebook history
  const hist = (L.log || []).filter((e) => e.computed && !e.computed.degraded && !e.computed.warming_up);
  if (hist.length) {
    const dec = hist.filter((e) => e.computed.decisive).length;
    setT('sgDecisive', (dec / hist.length * 100).toFixed(1) + '%');
    setT('sgDecisiveSub', dec + ' of ' + hist.length + ' notes decisive');
  } else { setT('sgDecisive', '—'); setT('sgDecisiveSub', 'awaiting notes'); }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('sgBubble');
      if (b) { b.classList.remove('sg-talk'); void b.offsetWidth; b.classList.add('sg-talk'); }
    }
  }
  if (rowsEl) {
    setT('sgLogCount', '· ' + (L.log || []).length + ' notes saved');
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
      const v = document.createElement('span');
      v.className = 'lm-v ' + (e.verdict === 'useful' ? 'lm-v-useful' : e.verdict === 'insufficient data' ? 'lm-v-insuf' : 'lm-v-not');
      v.textContent = e.verdict;
      const f = document.createElement('span'); f.className = 'lm-f'; f.textContent = e.finding;
      head.append(tt, v, f);
      const det = document.createElement('div');
      det.className = 'lm-detail'; det.hidden = true;
      const col = e.collected || {};
      det.innerHTML =
        '<div class="lm-sec"><span class="lm-k">COLLECTED</span><br>' +
        (col.source || 'CoinGecko free API') +
        (col.assets ? ' · ' + col.assets.join(' + ') : '') + '<br>' +
        (col.window || '') + (col.cached ? ' · cached read' : '') + '</div>' +
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
  loadSageVerdict();
}

/* ---------------- Sage's standing verdict ---------------- */
async function loadSageVerdict() {
  const panel = $('sgVerdictPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'sage_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('sgVerdictBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'wv-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('sgVerdictPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('sgVerdictEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · decisive tide <b>' + pct(ev.decisive_frac) + '</b> · ' +
    (ev.member_n >= 200
      ? 'out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('sgDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="wv-line"><span class="wv-d">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('sgHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="wv-hyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>' +
    'status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('sgVerdictMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' +
    esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + esc(p.id) + '" target="_blank" rel="noopener">' + esc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Sage DM chat ---------------- */
function initSageChat() {
  const log = $('sgChatLog'), input = $('sgChatText'), send = $('sgChatSend'), chips = $('sgChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'schat-row ' + who;
    if (who === 'sage') {
      const av = document.createElement('img');
      av.src = 'sage-headshot.webp'; av.alt = 'Sage';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'schat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What is the liquidity tide?', "What's your verdict?", 'Is it in the forecast?', 'Why are you slow?'];
  if (chips) {
    chips.innerHTML = '';
    for (const q of CHIP_QS) {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'schat-chip'; c.textContent = q;
      c.addEventListener('click', () => { input.value = q; doSend(); });
      chips.appendChild(c);
    }
  }
  // repeat IP probers are counted (per browser) and get a firmer refusal
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('sageChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'schat-row sage';
    typing.innerHTML = '<img src="sage-headshot.webp" alt="Sage"><div class="schat-bubble"><span class="schat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (sageIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('sageChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? sageRepeatRefusal() : sageAnswer(text);
    } else {
      reply = sageAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('sage', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('sage', "Hello, darling 🌿 I'm Sage — ask me about the stablecoin liquidity tide, my verdicts, or how I decide what enters the forecast!"), 800);
}

/* ---------------- Sage flipbook animation ---------------- */
function initSageAnim() {
  const img = $('sgHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'sage.webp', WRITE = 'sage-write.webp', BLINK = 'sage-blink.webp';
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

/* ---------------- Sage entry point ---------------- */
function initSage() {
  initSageAnim();
  initSageChat();
}
