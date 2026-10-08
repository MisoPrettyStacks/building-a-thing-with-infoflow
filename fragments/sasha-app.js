// Sasha's page fragment — init / render / chat / flipbook animation.
//
// Assembled by the coordinator into the page bundle. Mirrors the Wendy
// functions in app.js. Uses only local helpers (falls back cleanly if the
// app.js $ / setT helpers are unavailable); DATA_BASE is read defensively.

import { sashaAnswer, sashaIsIpProbe, sashaRepeatRefusal } from '../lib/sashachat.js';

const $s = (id) => document.getElementById(id);
const setTs = (id, txt) => { const el = $s(id); if (el) el.textContent = txt; };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const dataBase = () => (typeof DATA_BASE !== 'undefined' ? DATA_BASE : null);

/* ---------------- Sasha's standing verdict ---------------- */
async function loadSashaVerdict() {
  const panel = $s('ssVerdictPanel');
  const base = dataBase();
  if (!panel || !base) return;
  let doc;
  try {
    const r = await fetch(base + 'sasha_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $s('ssVerdictBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'ss-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $s('ssVerdictPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $s('ssVerdictEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · decisive mood <b>' + pct(ev.decisive_frac) + '</b> · ' +
    'strong-mood cycles <b>' + (ev.strong_mood_cycles || 0) + '</b> · ' +
    (ev.member_n >= 200
      ? 'out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  $s('ssDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="ss-line"><span class="ss-d">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $s('ssHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="ss-hyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>' +
    'status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $s('ssVerdictMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' +
    esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + esc(p.id) + '" target="_blank" rel="noopener">' + esc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Sasha's lab panel: signal stats + notebook ---------------- */
function moodLean(z) {
  return z > 0.5 ? 'optimistic lean' : z < -0.5 ? 'fearful lean' : 'quiet';
}

export function renderSashaPanel(summary) {
  const st = summary && summary.sentiment;
  const sb = summary && summary.windows && summary.windows.all && summary.windows.all.sentiment;
  // signal stat cards
  if (st) {
    const b = st.bias || 0, z = st.z || 0;
    setTs('ssTilt', (b >= 0 ? '+' : '') + b.toFixed(4));
    setTs('ssTiltSub', moodLean(z));
    setTs('ssZ', (z >= 0 ? '+' : '') + z.toFixed(2));
    setTs('ssPosts', String(st.postsScanned || 0));
    setTs('ssStatus', st.degraded ? 'Blind' : st.warmingUp ? 'Warming up' : 'Live');
    setTs('ssStatusSub', st.degraded ? 'Reddit unreachable — abstaining' : (st.postsScanned || 0) + ' titles read');
    const w = st.weight || 0;
    setTs('ssWeight', w > 0 ? 'Active' : 'Scored only');
    setTs('ssWeightNote', w > 0 ? 'blended at weight ' + w.toFixed(2) : 'scored only, not used');
  }
  if (sb && sb.n >= 30) {
    setTs('ssSkill', sb.brierSentiment != null ? sb.brierSentiment.toFixed(5) : '—');
    setTs('ssSkillN', 'n=' + sb.n + ' scored' + (sb.brierSentiment != null && sb.brierBase != null && sb.brierSentiment < sb.brierBase ? ' · beats baseline ✓' : ''));
  }
  // lab panel: board + notebook
  const L = st;
  const rowsEl = $s('ssLogRows');
  const bubble = $s('ssBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    setTs('ssBias', 'warming up…'); setTs('ssZLine', ''); setTs('ssPostsLine', ''); setTs('ssVerdictLine', '');
    const sp = $s('ssSpark'); if (sp) sp.setAttribute('points', '');
    setTs('ssSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Sasha is setting up her lab — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    const z = c.z || 0;
    setTs('ssBias', `mood tilt  ${(c.bias || 0) >= 0 ? '+' : ''}${(c.bias || 0).toFixed(4)}  (${moodLean(z)})`);
    setTs('ssZLine', `mood z  ${z >= 0 ? '+' : ''}${z.toFixed(2)}${c.decisive ? '  · decisive' : ''}`);
    setTs('ssPostsLine', `posts scanned: ${c.posts_scanned || 0}`);
  } else {
    setTs('ssBias', c && c.degraded ? 'Reddit blind…' : 'warming up…');
    setTs('ssZLine', 'collecting history…'); setTs('ssPostsLine', '');
  }
  const vEl = $s('ssVerdictLine');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#d9b8f0';
  }
  // decisive-read rate + tilt canvas + sparkline from recent notes
  const good = (L.log || []).filter((e) => e.computed && !e.computed.degraded && !e.computed.warming_up);
  if (good.length) {
    const dec = good.filter((e) => e.computed.decisive).length;
    setTs('ssDecisive', ((dec / good.length) * 100).toFixed(1) + '%');
    setTs('ssDecisiveSub', 'of ' + good.length + ' recent notes');
  }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded).slice(-24).map((e) => e.computed.bias);
  const sp = $s('ssSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setTs('ssSparkLabel', `mood tilt · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setTs('ssSparkLabel', ''); }
  }
  const cv = $s('ssSparkC');
  if (cv && cv.getContext && pts.length > 1) {
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
    ctx.strokeStyle = '#b49ae0'; ctx.lineWidth = 1.5; ctx.beginPath();
    pts.forEach((v, i) => {
      const x = (W * i) / (pts.length - 1), y = H - 4 - ((v - mn) / rg) * (H - 8);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b2 = $s('ssBubble');
      if (b2) { b2.classList.remove('ss-talk'); void b2.offsetWidth; b2.classList.add('ss-talk'); }
    }
  }
  if (rowsEl) {
    setTs('ssLogCount', '· ' + (L.log || []).length + ' notes saved');
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
        esc(col.source || 'Reddit public JSON') + ' · ' + esc(col.posts_scanned != null ? col.posts_scanned + ' titles' : '?') + ' · ' + esc(col.window || '') + '<br>' +
        esc(col.pipeline || '') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">CHECKS</span><br>' +
        (e.checks || []).map((k) => '<span class="' + (k.pass ? 'lm-check-pass' : 'lm-check-fail') + '">' +
          (k.pass ? '✓' : '✗') + '</span> ' + esc(k.name) + ' — ' + esc(k.detail)).join('<br>') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">WHY</span><br>' + esc(e.verdict_why || '') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">MATHEMATICAL EFFECT</span><br>' + esc((e.math_effect || {}).detail || '') + '</div>';
      head.addEventListener('click', () => { det.hidden = !det.hidden; });
      row.append(head, det);
      rowsEl.appendChild(row);
    }
  }
}

/* ---------------- Sasha DM chat ---------------- */
export function initSashaChat() {
  const log = $s('ssChatLog'), input = $s('ssChatText'), send = $s('ssChatSend'), chips = $s('ssChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'sschats-row ' + who;
    if (who === 'sasha') {
      const av = document.createElement('img');
      av.src = 'sasha-headshot.webp'; av.alt = 'Sasha';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'sschats-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What is a decisive read?', "What's your verdict?", 'Is it in the forecast?', 'Why are you so skeptical?'];
  if (chips) {
    chips.innerHTML = '';
    for (const q of CHIP_QS) {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'sschats-chip'; c.textContent = q;
      c.addEventListener('click', () => { input.value = q; doSend(); });
      chips.appendChild(c);
    }
  }
  // repeat IP probers are counted (per browser) and get a firmer refusal
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('sashaChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'sschats-row sasha';
    typing.innerHTML = '<img src="sasha-headshot.webp" alt="Sasha"><div class="sschats-bubble"><span class="sschats-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (sashaIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('sashaChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? sashaRepeatRefusal() : sashaAnswer(text);
    } else {
      reply = sashaAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('sasha', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('sasha', "Hi! I'm Sasha 💜 Ask me anything about crowd mood — my verdicts, how I read Reddit, or why I'm so skeptical of my own data!"), 800);
}

/* ---------------- Sasha flipbook animation ---------------- */
export function initSashaAnim() {
  const img = $s('ssHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'sasha.webp', WRITE = 'sasha-write.webp', BLINK = 'sasha-blink.webp';
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

/* ---------------- entry point: coordinator calls initSasha(summary) ---------------- */
export function initSasha(summary) {
  initSashaAnim();
  initSashaChat();
  renderSashaPanel(summary);
  loadSashaVerdict();
}
