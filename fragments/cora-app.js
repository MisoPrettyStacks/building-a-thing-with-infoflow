// Cora's lab — app fragment (assembled by the coordinator into app.js).
// Assumes the host app provides: $, esc, DATA_BASE, summary, coraAnswer,
// coraIsIpProbe, coraRepeatRefusal (from lib/corachat.js).

/* ---------------- Cora's lab ---------------- */
function fmtBp(x) {
  if (x == null || !isFinite(x)) return '—';
  const bp = x * 1e4;
  return (bp >= 0 ? '+' : '') + bp.toFixed(1) + ' bp';
}

function renderCoraPanel(s) {
  if (!$('coBias')) return;
  const sum = s || (typeof summary !== 'undefined' ? summary : null);
  const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  const xa = sum && sum.xasset;
  const sb = sum && sum.windows && sum.windows.all && sum.windows.all.xasset;
  // live stat cards
  if (xa) {
    const b = xa.bias || 0;
    const dirWord = b > 0.0005 ? 'tailwind' : b < -0.0005 ? 'headwind' : 'quiet';
    setT('coTilt', (b >= 0 ? '+' : '') + b.toFixed(4));
    setT('coTiltSub', dirWord + (b > 0.0005 ? ' · broad momentum up' : b < -0.0005 ? ' · broad momentum down' : ''));
    setT('coETH', fmtBp(xa.momETH));
    setT('coSOL', fmtBp(xa.momSOL));
    const me = xa.momETH, ms = xa.momSOL;
    const agree = me != null && ms != null && isFinite(me) && isFinite(ms) && ((me > 0 && ms > 0) || (me < 0 && ms < 0));
    setT('coETHSub', isFinite(me) ? (agree ? 'agrees with SOL' : 'disagrees with SOL') : 'ETH-USD');
    setT('coSOLSub', isFinite(ms) ? (agree ? 'agrees with ETH' : 'disagrees with ETH') : 'SOL-USD');
    setT('coStatus', xa.degraded ? 'Blind' : xa.warmingUp ? 'Warming up' : 'Live');
    setT('coStatusSub', xa.degraded ? 'Coinbase unreachable — abstaining' : 'ETH-USD + SOL-USD candles');
    const w = xa.weight || 0;
    setT('coWeight', w > 0 ? 'Active' : 'Scored only');
    setT('coWeightNote', w > 0 ? 'blended at weight ' + w.toFixed(2) : 'scored only, not used');
  }
  if (sb && sb.n >= 30) {
    setT('coBrier', sb.brierXasset.toFixed(5));
    setT('coBrierN', 'n=' + sb.n + ' scored' + (sb.brierXasset < sb.brierBase ? ' · beats baseline ✓' : ''));
    if (sb.skill24h && sb.skill24h.n >= 30) {
      setT('coSkill', (sb.skill24h.hitRate * 100).toFixed(1) + '%');
      setT('coSkillSub', 'n=' + sb.skill24h.n + ' · 24h direction');
    }
  }
  // lab panel: board + notebook
  const L = sum && sum.cora;
  const rowsEl = $('coLog');
  const bubble = $('coBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    setT('coBias', 'warming up…'); setT('coMomETH', ''); setT('coMomSOL', ''); setT('coVerdict', '');
    const sp = $('coSpark'); if (sp) sp.setAttribute('points', '');
    setT('coSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Cora is setting up her lab — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    const dirWord = c.bias > 0.0005 ? 'tailwind' : c.bias < -0.0005 ? 'headwind' : 'quiet';
    setT('coBias', `cross-asset tilt  ${c.bias >= 0 ? '+' : ''}${c.bias.toFixed(4)}  (${dirWord})`);
    setT('coMomETH', `ETH momentum: ${fmtBp(c.mom_eth)}`);
    setT('coMomSOL', `SOL momentum: ${fmtBp(c.mom_sol)}`);
  } else {
    setT('coBias', c && c.degraded ? 'feed blind…' : 'warming up…');
    setT('coMomETH', 'collecting history…'); setT('coMomSOL', '');
  }
  const vEl = $('coVerdict');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879';
  }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded).slice(-24).map((e) => e.computed.bias);
  const sp = $('coSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('coSparkLabel', `cross-asset tilt · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('coSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('coBubble');
      if (b) { b.classList.remove('co-talk'); void b.offsetWidth; b.classList.add('co-talk'); }
    }
  }
  if (rowsEl) {
    $('coLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
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
        (col.source || 'Coinbase') + ' · ' + (col.products || 'ETH-USD + SOL-USD') + ' · ' + (col.window || '') + '</div>' +
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
  // the verdict panel reads her weekly supervisor file (staleness-guarded)
  loadCoraVerdict();
}

/* ---------------- Cora's standing verdict ---------------- */
let coraVerdictFetchedAt = 0;
async function loadCoraVerdict() {
  const panel = $('coVPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  const now = Date.now();
  if (now - coraVerdictFetchedAt < 10 * 60 * 1000) return; // refresh at most every 10 minutes
  coraVerdictFetchedAt = now;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'cora_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('coVBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'cv-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('coVPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('coVEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · decisive momentum <b>' + pct(ev.decisive_frac) + '</b> · ' +
    (ev.agreement_frac != null ? 'ETH/SOL agreement <b>' + pct(ev.agreement_frac) + '</b> · ' : '') +
    (ev.member_n >= 200
      ? 'out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  $('coDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="cv-line"><span class="cv-d">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('coHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="cv-hyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>' +
    'status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('coVMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' +
    esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + esc(p.id) + '" target="_blank" rel="noopener">' + esc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Cora DM chat ---------------- */
function initCoraChat() {
  const log = $('coChatLog'), input = $('coChatText'), send = $('coChatSend'), chips = $('coChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'cchat-row ' + who;
    if (who === 'cora') {
      const av = document.createElement('img');
      av.src = 'cora-headshot.webp'; av.alt = 'Cora';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'cchat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What is cross-asset momentum?', "What's your verdict?", 'Is it in the forecast?', 'Masha vs Cora?'];
  if (chips) {
    chips.innerHTML = '';
    for (const q of CHIP_QS) {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'cchat-chip'; c.textContent = q;
      c.addEventListener('click', () => { input.value = q; doSend(); });
      chips.appendChild(c);
    }
  }
  // repeat IP probers are counted (per browser) and get a firmer refusal
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('coraChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'cchat-row cora';
    typing.innerHTML = '<img src="cora-headshot.webp" alt="Cora"><div class="cchat-bubble"><span class="cchat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (coraIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('coraChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? coraRepeatRefusal() : coraAnswer(text);
    } else {
      reply = coraAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('cora', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('cora', "Hi! I'm Cora 💙 Ask me about cross-asset momentum — ETH/SOL spillover, my verdicts, or how I compare notes with Masha!"), 800);
}

/* ---------------- Cora flipbook animation ---------------- */
function initCoraAnim() {
  const img = $('coHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'cora.webp', WRITE = 'cora-write.webp', BLINK = 'cora-blink.webp';
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

/* ---------------- Cora boot ---------------- */
function initCora() {
  initCoraAnim();
  renderCoraPanel();
  initCoraChat();
}
