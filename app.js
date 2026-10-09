// Browser app: live chart, official forecast, live scoreboard, in-browser replay, agent panel, source download.
// All numbers come from real exchange data or from the public ledger. Nothing here is simulated.
import { coinbaseCandles, fetchBars } from './lib/data.js';
import { walkForward, gridBars, DEFAULT_CONFIG, QLEVELS, STEP } from './lib/engine.js';
import { binaryScores, quantileScores, dmTest, brier, mean } from './lib/stats.js';
import { mashaAnswer, mashaIsIpProbe, mashaRepeatRefusal } from './lib/mashachat.js';
import { wendyAnswer, wendyIsIpProbe, wendyRepeatRefusal } from './lib/wendychat.js';
import { niaAnswer, niaIsIpProbe, niaRepeatRefusal } from './lib/niachat.js';
import { sashaAnswer, sashaIsIpProbe, sashaRepeatRefusal } from './lib/sashachat.js';
import { sageAnswer, sageIsIpProbe, sageRepeatRefusal } from './lib/sagechat.js';
import { cherryAnswer, cherryIsIpProbe, cherryRepeatRefusal } from './lib/cherrychat.js';
import { coraAnswer, coraIsIpProbe, coraRepeatRefusal } from './lib/corachat.js';
import { sophieAnswer, sophieIsIpProbe, sophieRepeatRefusal } from './lib/sophiechat.js';
import { noraAnswer, noraIsIpProbe, noraRepeatRefusal } from './lib/norachat.js';
import { daisyAnswer, daisyIsIpProbe, daisyRepeatRefusal } from './lib/daisychat.js';
import { violetAnswer, violetIsIpProbe, violetRepeatRefusal } from './lib/violetchat.js';
import { opalAnswer, opalIsIpProbe, opalRepeatRefusal } from './lib/opalchat.js';
import { opheliaAnswer, opheliaIsIpProbe, opheliaRepeatRefusal } from './lib/opheliachat.js';
import { camilleAnswer, camilleIsIpProbe, camilleRepeatRefusal } from './lib/camillechat.js';
import { mollyAnswer, mollyIsIpProbe, mollyRepeatRefusal } from './lib/mollychat.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
const f = (x, d = 4) => (x === null || x === undefined || !isFinite(x) ? '—' : Number(x).toFixed(d));
const pct = (x, d = 2) => (x === null || x === undefined || !isFinite(x) ? '—' : (100 * x).toFixed(d) + '%');
const usd = (x, d = 4) => (isFinite(x) ? '$' + Number(x).toFixed(d) : '—');
const hhmm = (t) => new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const stamp = (t) => new Date(t * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------------- where the data lives ---------------- */
let DATA_BASE = './data/';
let RAW_MAIN = null;
let REPO_URL = null;
async function resolveBases() {
  let cfg = {};
  try { cfg = await (await fetch('site-config.json', { cache: 'no-store' })).json(); } catch { /* optional */ }
  const q = new URLSearchParams(location.search).get('data');
  const host = location.hostname;
  let owner = null, repo = null;
  if (host.endsWith('.github.io')) { owner = host.split('.')[0]; repo = location.pathname.split('/')[1] || null; }
  if (cfg.repo && cfg.repo.includes('/')) [owner, repo] = cfg.repo.split('/');
  if (owner && repo) {
    DATA_BASE = `https://raw.githubusercontent.com/${owner}/${repo}/data/`;
    RAW_MAIN = `https://raw.githubusercontent.com/${owner}/${repo}/main/`;
    REPO_URL = `https://github.com/${owner}/${repo}`;
  }
  if (cfg.dataBase) DATA_BASE = cfg.dataBase.endsWith('/') ? cfg.dataBase : cfg.dataBase + '/';
  if (q) DATA_BASE = q.endsWith('/') ? q : q + '/';
}

let summary = null, champion = null;
async function loadSummary() {
  try {
    const r = await fetch(DATA_BASE + 'summary.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    summary = await r.json();
  } catch { summary = null; }
  renderHeartbeat(); renderForecast(); renderScore(currentWin); renderAgent(); renderIntegrity(); renderInfoflow(); renderMasha(); renderWendy(); renderCalendar(); renderCamillePanel(summary); renderMollyPanel(summary); renderMacro(); renderOnchain(); schedDraw(); renderOpheliaPanel(summary); renderNiaPanel(summary); renderSashaPanel(summary); renderSagePanel(summary); renderCherryPanel(summary); renderCoraPanel(summary); renderSophiePanel(summary); renderNoraPanel(summary); renderDaisyPanel(summary); renderVioletPanel(summary); renderOpalPanel(summary);
}

/* ---------------- information flow (experimental) ---------------- */
function renderInfoflow() {
  if (!$('ifBx')) return;
  const d = summary && summary.infoflow;
  if (!d) {
    ['ifBx','ifXb','ifNet','ifPe','ifBrier','ifEnsBrier','ifWeight'].forEach((id) => { $(id).textContent = '—'; });
    $('ifBxZ').textContent = 'waiting for runner…'; $('ifXbZ').textContent = 'waiting for runner…';
    $('ifVote').textContent = 'member vote —'; $('ifRegime').textContent = '—';
    $('ifBrierN').textContent = '—'; $('ifWeightNote').textContent = 'scored only, not used'; $('ifAge').textContent = '—';
    return;
  }
  $('ifBx').textContent = d.te_btc_xrp.toFixed(4);
  $('ifBxZ').textContent = 'nats · z = ' + d.z_btc_xrp.toFixed(2) + (d.z_btc_xrp > 2 ? ' (significant)' : ' (not significant)');
  $('ifXb').textContent = d.te_xrp_btc.toFixed(4);
  $('ifXbZ').textContent = 'nats · z = ' + d.z_xrp_btc.toFixed(2) + (d.z_xrp_btc > 2 ? ' (significant)' : ' (not significant)');
  const dir = d.net > 0 ? 'BTC → XRP' : d.net < 0 ? 'XRP → BTC' : 'balanced';
  $('ifNet').textContent = dir + ' (' + Math.abs(d.net).toFixed(4) + ')';
  $('ifVote').textContent = 'member vote ' + (d.vote === 0.5 ? 'abstains (0.50)' : 'P(up) = ' + d.vote.toFixed(3));
  $('ifPe').textContent = d.perm_entropy.toFixed(3);
  $('ifRegime').textContent = d.noisy ? 'noisy — guard ' + (d.enabled ? 'ACTIVE (shrinking)' : 'measured only') : 'ordered';
  const mem = summary.windows && summary.windows.all && summary.windows.all.members;
  if (mem && mem.infoflow != null) {
    $('ifBrier').textContent = mem.infoflow.toFixed(5);
    $('ifBrierN').textContent = 'n = ' + (mem.infoflow_n || '?') + ' scored forecasts';
    $('ifEnsBrier').textContent = summary.windows.all.brier != null ? summary.windows.all.brier.toFixed(5) : '—';
  } else {
    $('ifBrier').textContent = '—'; $('ifBrierN').textContent = 'no scored forecasts yet'; $('ifEnsBrier').textContent = '—';
  }
  $('ifWeight').textContent = d.enabled ? 'Active' : 'Scored only';
  $('ifWeight').style.color = d.enabled ? '#b5e6a2' : '';
  $('ifWeightNote').textContent = d.enabled ? 'in the forecast — agent found OOS evidence' : 'not used in the forecast';
  const ageS = Math.max(0, Math.round((Date.now() - Date.parse(d.computed_at)) / 1000));
  $('ifAge').textContent = 'recomputed ' + (ageS < 90 ? ageS + 's ago' : Math.round(ageS / 60) + 'm ago');
  renderTopology();
}

/* ---------------- Masha's lab ---------------- */
function renderMasha() {
  if (!$('lmTe')) return;
  const L = summary && (summary.masha || summary.littleMarlowe);
  const rowsEl = $('lmLogRows');
  const bubble = $('lmBubbleText');
  const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    setT('lmTe', 'warming up…'); setT('lmZ', ''); setT('lmVote', ''); setT('lmVerdict', '');
    const sp = $('lmSpark'); if (sp) sp.setAttribute('points', '');
    setT('lmSparkLabel', '');
    rowsEl.innerHTML = '<div class="lm-empty">Masha is setting up her lab — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c) {
    setT('lmTe', `TE BTC→XRP   ${c.te_btc_xrp.toFixed(4)} nats`);
    setT('lmZ', `z = ${c.z_btc_xrp.toFixed(2)}   (significance bar)`);
    setT('lmVote', `vote: ${c.vote === 0.5 ? 'abstain (0.50)' : 'P(up) = ' + c.vote.toFixed(3)}`);
  } else {
    setT('lmTe', 'not enough data…');
    setT('lmZ', 'collecting bars…');
    setT('lmVote', '');
  }
  const vEl = $('lmVerdict');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879';
  }
  // sparkline of TE BTC→XRP over recent notes (real data)
  const pts = (L.log || []).filter((e) => e.computed).slice(-24).map((e) => e.computed.te_btc_xrp);
  const sp = $('lmSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('lmSparkLabel', `TE BTC→XRP · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('lmSparkLabel', ''); }
  }
  // speech bubble: short version of his finding (pops when it changes)
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('lmBubble');
      if (b) { b.classList.remove('lm-talk'); void b.offsetWidth; b.classList.add('lm-talk'); }
    }
  }
  // the black notebook: newest first, click a row for the full workup
  $('lmLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
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
    const col = e.collected;
    det.innerHTML =
      '<div class="lm-sec"><span class="lm-k">COLLECTED</span><br>' +
      col.source + ' · ' + col.products.join(' + ') + ' · ' + col.window + '<br>' +
      col.xrp_bars + ' XRP bars, ' + col.btc_bars + ' BTC bars, ' + col.aligned_bars + ' aligned in window</div>' +
      '<div class="lm-sec"><span class="lm-k">CHECKS</span><br>' +
      e.checks.map((k) => '<span class="' + (k.pass ? 'lm-check-pass' : 'lm-check-fail') + '">' +
        (k.pass ? '✓' : '✗') + '</span> ' + k.name + ' — ' + k.detail).join('<br>') + '</div>' +
      '<div class="lm-sec"><span class="lm-k">WHY</span><br>' + e.verdict_why + '</div>' +
      '<div class="lm-sec"><span class="lm-k">MATHEMATICAL EFFECT</span><br>' + e.math_effect.detail + '</div>';
    head.addEventListener('click', () => { det.hidden = !det.hidden; });
    row.append(head, det);
    rowsEl.appendChild(row);
  }
}

/* ---------------- Masha's standing verdict ---------------- */
async function loadMashaVerdict() {
  const panel = $('mvPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'masha_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('mvBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'mv-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('mvPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('mvEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · significant flow <b>' + pct(ev.sig_frac) + '</b> · ' +
    'noise regime <b>' + pct(ev.noise_frac) + '</b> · ' +
    (ev.member_n >= 200
      ? 'out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs ensemble <b>' + ev.ensemble_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('mvDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="mv-line"><span class="mv-d">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('mvHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="mv-hyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>' +
    'status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('mvMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' +
    esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + esc(p.id) + '" target="_blank" rel="noopener">' + esc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Masha DM chat ---------------- */
function initMashaChat() {
  const log = $('mchatLog'), input = $('mchatText'), send = $('mchatSend'), chips = $('mchatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'mchat-row ' + who;
    if (who === 'masha') {
      const av = document.createElement('img');
      av.src = 'masha-headshot.webp'; av.alt = 'Masha';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'mchat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What is transfer entropy?', "What's your verdict?", 'Is it in the forecast?', 'What do you do?'];
  chips.innerHTML = '';
  for (const q of CHIP_QS) {
    const c = document.createElement('button');
    c.type = 'button'; c.className = 'mchat-chip'; c.textContent = q;
    c.addEventListener('click', () => { input.value = q; doSend(); });
    chips.appendChild(c);
  }
  // repeat IP probers are counted (per browser) and get a firmer refusal
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('mchatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'mchat-row masha';
    typing.innerHTML = '<img src="masha-headshot.webp" alt="Masha"><div class="mchat-bubble"><span class="mchat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (mashaIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('mchatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? mashaRepeatRefusal() : mashaAnswer(text);
    } else {
      reply = mashaAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('masha', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('masha', "Hi! I'm Masha 🐾 Ask me anything about my information-flow research — my verdicts, how I measure the flow, or how I decide what enters the forecast!"), 800);
}

/* ---------------- Masha flipbook animation ---------------- */
function initMashaAnim() {
  const img = $('lmHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'masha.webp', WRITE = 'masha-write.webp', BLINK = 'masha-blink.webp';
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

/* ---------------- Wendy's lab ---------------- */
function fmtXrpShort(x) {
  if (x == null || !isFinite(x)) return '—';
  const a = Math.abs(x);
  if (a >= 1e6) return (x / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (x / 1e3).toFixed(0) + 'K';
  return String(Math.round(x));
}
function renderWendy() {
  if (!$('wwBias')) return;
  const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  const oc = summary && summary.onchain;
  const sb = summary && summary.windows && summary.windows.all && summary.windows.all.onchain;
  // live stat cards
  if (oc) {
    const b = oc.bias || 0;
    const dirWord = b > 0.0005 ? 'accumulation' : b < -0.0005 ? 'distribution' : 'quiet';
    setT('wBias', (b >= 0 ? '+' : '') + b.toFixed(4));
    setT('wBiasSub', dirWord + (b > 0.0005 ? ' · coins leaving exchanges' : b < -0.0005 ? ' · coins arriving at exchanges' : ''));
    setT('wPulses', String(oc.activePulses || 0));
    setT('wPulsesSub', (oc.activePulses || 0) > 0 ? 'echoing (fade ~2 days)' : 'none recently');
    setT('wNet24', oc.netFlow24h != null ? (oc.netFlow24h >= 0 ? '+' : '−') + fmtXrpShort(oc.netFlow24h) : '—');
    setT('wNet24Sub', oc.netFlow24h != null ? (oc.netFlow24h >= 0 ? 'inflow to exchanges' : 'outflow to custody') : 'XRP across tracked wallets');
    setT('wFeed', oc.degraded ? 'Blind' : oc.warmingUp ? 'Warming up' : 'Live');
    setT('wFeedSub', oc.degraded ? 'XRPL unreachable — abstaining' : (oc.snapshotCount || 0) + ' snapshots');
    const w = oc.weight || 0;
    setT('wWeight', w > 0 ? 'Active' : 'Scored only');
    setT('wWeightNote', w > 0 ? 'blended at weight ' + w.toFixed(2) : 'scored only, not used');
    setT('wSnaps', String(oc.snapshotCount || 0));
    setT('wSnapsSub', 'balance history');
  }
  if (sb && sb.n >= 30) {
    setT('wBrier', sb.brierOnchain.toFixed(5));
    setT('wBrierN', 'n=' + sb.n + ' scored' + (sb.brierOnchain < sb.brierBase ? ' · beats baseline ✓' : ''));
    if (sb.skill24h && sb.skill24h.n >= 30) {
      setT('wSkill', (sb.skill24h.hitRate * 100).toFixed(1) + '%');
      setT('wSkillSub', 'n=' + sb.skill24h.n + ' · 24h direction');
    }
  }
  // lab panel: board + notebook
  const L = summary && summary.wendy;
  const rowsEl = $('wwLogRows');
  const bubble = $('wwBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    setT('wwBias', 'warming up…'); setT('wwPulses', ''); setT('wwFlow', ''); setT('wwVerdict', '');
    const sp = $('wwSpark'); if (sp) sp.setAttribute('points', '');
    setT('wwSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Wendy is setting up her lab — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    const dirWord = c.bias > 0.0005 ? 'accumulation' : c.bias < -0.0005 ? 'distribution' : 'quiet';
    setT('wwBias', `flow tilt  ${c.bias >= 0 ? '+' : ''}${c.bias.toFixed(4)}  (${dirWord})`);
    setT('wwPulses', `whale pulses active: ${c.active_pulses || 0}`);
    setT('wwFlow', `24h net: ${c.net_flow_24h != null ? (c.net_flow_24h >= 0 ? '+' : '−') + fmtXrpShort(c.net_flow_24h) + ' XRP' : '—'}`);
  } else {
    setT('wwBias', c && c.degraded ? 'ledger blind…' : 'warming up…');
    setT('wwPulses', 'collecting history…'); setT('wwFlow', '');
  }
  const vEl = $('wwVerdict');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879';
  }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded).slice(-24).map((e) => e.computed.bias);
  const sp = $('wwSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('wwSparkLabel', `flow tilt · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('wwSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('wwBubble');
      if (b) { b.classList.remove('ww-talk'); void b.offsetWidth; b.classList.add('ww-talk'); }
    }
  }
  if (rowsEl) {
    $('wwLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
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
        (col.source || 'XRP Ledger') + ' · ' + (col.watchlist_wallets || '?') + ' watchlist wallets · ' + (col.window || '') + '<br>' +
        (col.snapshots || 0) + ' balance snapshots on record</div>' +
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

/* ---------------- Wendy's standing verdict ---------------- */
async function loadWendyVerdict() {
  const panel = $('wvPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'wendy_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('wvBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'wv-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('wvPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('wvEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · decisive flow <b>' + pct(ev.decisive_frac) + '</b> · ' +
    'whale-pulse cycles <b>' + (ev.whale_pulse_cycles || 0) + '</b> · ' +
    (ev.member_n >= 200
      ? 'out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('wvDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="wv-line"><span class="wv-d">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('wvHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="wv-hyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>' +
    'status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('wvMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' +
    esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + esc(p.id) + '" target="_blank" rel="noopener">' + esc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Wendy DM chat ---------------- */
function initWendyChat() {
  const log = $('wchatLog'), input = $('wchatText'), send = $('wchatSend'), chips = $('wchatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'wchat-row ' + who;
    if (who === 'wendy') {
      const av = document.createElement('img');
      av.src = 'wendy-headshot.webp'; av.alt = 'Wendy';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'wchat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What is a whale pulse?', "What's your verdict?", 'Is it in the forecast?', 'What do you do?'];
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
  try { ipCount = parseInt(localStorage.getItem('wchatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'wchat-row wendy';
    typing.innerHTML = '<img src="wendy-headshot.webp" alt="Wendy"><div class="wchat-bubble"><span class="wchat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (wendyIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('wchatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? wendyRepeatRefusal() : wendyAnswer(text);
    } else {
      reply = wendyAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('wendy', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('wendy', "Hi! I'm Wendy 🐋 Ask me anything about whale flows — my verdicts, how I read the ledger, or how I decide what enters the forecast!"), 800);
}

/* ---------------- Wendy flipbook animation ---------------- */
function initWendyAnim() {
  const img = $('wwHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'wendy.webp', WRITE = 'wendy-write.webp', BLINK = 'wendy-blink.webp';
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

/* ---------------- topological features (experimental) ---------------- */
function renderTopology() {
  if (!$('topoPE')) return;
  const t = summary && summary.topology;
  if (!t) {
    ['topoPE','topoMaxL','topoDist','topoState'].forEach((id) => { $(id).textContent = '—'; });
    $('topoThr').textContent = 'waiting for runner…'; $('topoBrierN').textContent = '—';
    return;
  }
  $('topoPE').textContent = t.pe != null ? t.pe.toFixed(3) : '—';
  $('topoMaxL').textContent = t.max_lifetime != null ? t.max_lifetime.toFixed(4) : '—';
  $('topoDist').textContent = t.diagram_distance != null ? t.diagram_distance.toFixed(4) : 'warming up';
  $('topoThr').textContent = t.threshold != null
    ? 'threshold ' + t.threshold.toFixed(4) + ' · n=' + (t.history_n || 0)
    : 'collecting baseline (n=' + (t.history_n || 0) + '/50)';
  $('topoState').textContent = t.dampen
    ? 'reorganizing — dampening' + ((t.weight || 0) > 0 ? ' ACTIVE' : ' (scored only)')
    : 'stable';
  const tw = summary.windows && summary.windows.all && summary.windows.all.topology;
  if (tw && tw.regimeWindow) {
    const rw = tw.regimeWindow;
    const helps = rw.brierTopo < rw.brierBase;
    $('topoBrierN').textContent = (helps ? 'helps ✓ ' : 'no edge yet ') +
      'regime-window Brier ' + rw.brierTopo.toFixed(5) + ' vs base ' + rw.brierBase.toFixed(5) + ' · n=' + rw.n;
  } else {
    $('topoBrierN').textContent = tw && tw.n ? 'n=' + tw.n + ' scored · regime window needs ≥10' : 'no scored forecasts yet';
  }
}

/* ---------------- calendar effects (experimental) ---------------- */
function renderCalendar() {
  if (!$('calDays')) return;
  const c = summary && summary.calendar;
  if (!c) {
    ['calDays','calTilt','calRelock','calVerdict'].forEach((id) => { $(id).textContent = '—'; });
    $('calTiltNote').textContent = 'waiting for runner…'; $('calN').textContent = '—';
    return;
  }
  $('calDays').textContent = c.days_since_escrow;
  $('calTilt').textContent = c.tilt > 0 ? '−' + c.tilt.toFixed(4) : 'none';
  $('calTiltNote').textContent = c.enabled ? 'ACTIVE — agent found OOS evidence' : (c.tilt > 0 ? 'would-be tilt · weight 0 (scored only)' : 'outside 1st–7th window');
  $('calRelock').textContent = (c.relock || 0).toFixed(2);
  const esc = summary.windows && summary.windows.all && summary.windows.all.escrow;
  if (esc && esc.tiltWindow) {
    const tw = esc.tiltWindow;
    const helps = tw.brierEscrow < tw.brierBase;
    $('calVerdict').textContent = helps ? 'helps ✓' : 'no edge yet';
    $('calN').textContent = 'tilt-window Brier ' + tw.brierEscrow.toFixed(5) + ' vs base ' + tw.brierBase.toFixed(5) + ' · n=' + tw.n;
  } else {
    $('calVerdict').textContent = 'collecting data';
    $('calN').textContent = esc && esc.n ? 'n=' + esc.n + ' scored · tilt window needs ≥10' : 'no scored forecasts yet';
  }
}

/* ---------------- macro events (experimental) ---------------- */
function fmtCountdown(min) {
  if (min == null || !isFinite(min)) return '—';
  if (min < 0) return Math.abs(min) < 2 ? 'just released' : Math.round(-min) + 'm ago';
  if (min < 60) return 'in ' + Math.round(min) + 'm';
  if (min < 1440) return 'in ' + Math.floor(min / 60) + 'h ' + Math.round(min % 60) + 'm';
  return 'in ' + Math.floor(min / 1440) + 'd ' + Math.floor((min % 1440) / 60) + 'h';
}
function renderMacro() {
  if (!$('macNext')) return;
  const m = summary && summary.macro;
  const banner = $('macBanner');
  if (!m) {
    ['macNext', 'macCount', 'macDamp', 'macVerdict'].forEach((id) => { $(id).textContent = '—'; });
    $('macNextTier').textContent = 'waiting for runner…'; $('macDampNote').textContent = '—';
    $('macN').textContent = '—'; $('macList').innerHTML = ''; banner.textContent = 'checking schedule…';
    return;
  }
  if (m.active) {
    banner.textContent = m.dampening_applied
      ? '● EVENT WINDOW ACTIVE — ' + m.event + ' · forecasts dampened'
      : '● EVENT WINDOW ACTIVE — ' + m.event + ' · measured only (weight 0)';
    banner.style.color = '#ffb020';
  } else {
    banner.textContent = '○ No event window — full confidence';
    banner.style.color = '';
  }
  const nx = (m.next && m.next[0]) || null;
  $('macNext').textContent = nx ? nx.event : '—';
  $('macNextTier').textContent = nx ? ('tier ' + nx.tier + ' · ' + nx.date + ' ' + nx.time_et + ' ET') : '—';
  $('macCount').textContent = nx ? fmtCountdown(nx.minutes_until) : '—';
  $('macDamp').textContent = m.active ? ('×' + m.shrink.toFixed(2) + ' (tier ' + m.tier + ')') : 'none';
  $('macDampNote').textContent = m.enabled ? (m.active ? 'ACTIVE — dampening applied' : 'armed · no window') : 'weight 0 (scored only)';
  const mc = summary.windows && summary.windows.all && summary.windows.all.macro;
  if (mc && mc.eventWindow) {
    const ew = mc.eventWindow;
    const helps = ew.brierMacro < ew.brierBase;
    $('macVerdict').textContent = helps ? 'helps ✓' : 'no edge yet';
    $('macN').textContent = 'window Brier ' + ew.brierMacro.toFixed(5) + ' vs base ' + ew.brierBase.toFixed(5) + ' · n=' + ew.n;
  } else {
    $('macVerdict').textContent = 'collecting data';
    $('macN').textContent = mc && mc.n ? 'n=' + mc.n + ' scored · window needs ≥10' : 'no scored forecasts yet';
  }
  $('macList').innerHTML = (m.next || []).map((e) =>
    '<div style="display:flex;justify-content:space-between;padding:3px 0;border-top:1px solid var(--line)">' +
    '<span>' + esc(e.event) + ' <span class="muted">· tier ' + e.tier + ' · ' + e.date + ' ' + e.time_et + ' ET</span></span>' +
    '<span class="muted">' + fmtCountdown(e.minutes_until) + '</span></div>').join('');
}

/* ---------------- on-chain flows (experimental) ---------------- */
function renderOnchain() {
  if (!$('ocFlow24')) return;
  const o = summary && summary.onchain;
  if (!o) {
    ['ocFlow24', 'ocFlow7', 'ocBias', 'ocWhale', 'ocBrier', 'ocSkill', 'ocStatus'].forEach((id) => { $(id).textContent = '—'; });
    $('ocBiasNote').textContent = 'waiting for runner…'; $('ocWhaleNote').textContent = '—';
    $('ocBrierN').textContent = '—'; $('ocSkillN').textContent = 'the meaningful read for a slow signal';
    $('ocTracked').textContent = '—';
    $('ocPollLog').innerHTML = '<div class="muted">waiting for runner…</div>';
    $('ocSignalLog').innerHTML = '<div class="muted">waiting for runner…</div>';
    $('ocSigTotal').textContent = '—'; $('ocSigTotalN').textContent = '—';
    return;
  }
  const fmtXrp = (x) => x == null ? '—' : (x >= 0 ? '+' : '') + (x / 1e6).toFixed(2) + 'M';
  $('ocFlow24').textContent = fmtXrp(o.netFlow24h);
  $('ocFlow7').textContent = fmtXrp(o.netFlow7d);
  $('ocBias').textContent = (o.bias == null || !isFinite(o.bias)) ? '—' : ((o.bias >= 0 ? '+' : '') + o.bias.toFixed(4));
  $('ocBiasNote').textContent = o.degraded ? 'feed degraded — abstaining (bias 0)' : (o.enabled ? 'ACTIVE — agent found OOS evidence' : (o.warmingUp ? 'warming up (<24h history)' : 'weight 0 (scored only)'));
  $('ocWhale').textContent = (o.whalePulse == null || Math.abs(o.whalePulse) <= 1e-6) ? 'none' : ((o.whalePulse >= 0 ? '+' : '') + o.whalePulse.toFixed(4));
  $('ocWhaleNote').textContent = o.activePulses ? o.activePulses + ' active pulse(s) · decays over 48h' : 'no whale transfers ≥10M XRP recently';
  const oc = summary.windows && summary.windows.all && summary.windows.all.onchain;
  if (oc) {
    const helps = oc.brierOnchain < oc.brierBase;
    $('ocBrier').textContent = helps ? 'helps ✓' : 'no edge yet';
    $('ocBrierN').textContent = '15-min Brier ' + oc.brierOnchain.toFixed(5) + ' vs base ' + oc.brierBase.toFixed(5) + ' · n=' + oc.n;
    const s = oc.skill24h;
    if (s && s.hitRate != null) {
      $('ocSkill').textContent = (s.hitRate > 0.5 ? 'edge ✓ ' : '') + (100 * s.hitRate).toFixed(1) + '%';
      $('ocSkillN').textContent = 'sign(bias) vs 24h return · n=' + s.n + ' · baseline 50%';
    } else {
      $('ocSkill').textContent = 'collecting data';
      $('ocSkillN').textContent = 'n=' + (s ? s.n : 0) + ' · needs ≥30 for a read';
    }
  } else {
    $('ocBrier').textContent = 'collecting data'; $('ocBrierN').textContent = 'no scored forecasts yet';
    $('ocSkill').textContent = 'collecting data';
  }
  $('ocStatus').textContent = o.degraded ? 'degraded' : (o.warmingUp ? 'warming up' : 'live');
  $('ocTracked').textContent = o.totalTracked != null ? (o.totalTracked / 1e6).toFixed(2) + 'M XRP tracked' : '—';
  // sparkline of the slow bias history
  try {
    const cv = $('ocSpark'), ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const series = (o.biasSeries || []).map((p) => p[1]);
    if (series.length > 1) {
      const lo = -0.03, hi = 0.03;
      const yOf = (v) => H - 3 - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (H - 6);
      ctx.strokeStyle = 'rgba(140,160,190,.35)'; ctx.beginPath();
      ctx.moveTo(0, yOf(0)); ctx.lineTo(W, yOf(0)); ctx.stroke();
      ctx.strokeStyle = '#7fd4a8'; ctx.lineWidth = 1.5; ctx.beginPath();
      series.forEach((v, i) => {
        const x = (i / (series.length - 1)) * W;
        i ? ctx.lineTo(x, yOf(v)) : ctx.moveTo(x, yOf(v));
      });
      ctx.stroke();
    }
  } catch { /* canvas optional */ }
  // live data-flow log: the raw information arriving, poll by poll
  const fmtSigned = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(4);
  const polls = (o.pollLog || []).slice().reverse();
  $('ocPollLog').innerHTML = polls.length ? polls.map((p) => {
    const when = p.t ? new Date(p.t * 1000).toLocaleString() : '';
    const txt = p.degraded
      ? `poll failed — XRPL unreachable (${p.ok}/${p.total} wallets answered)`
      : `polled ${p.ok}/${p.total} wallets · snapshot #${p.snapshots} saved${p.whales ? ` · ${p.whales} whale alert${p.whales > 1 ? 's' : ''}` : ''} · bias ${fmtSigned(p.bias || 0)}`;
    return `<div><span class="t">${esc(when)}</span>${esc(txt)}</div>`;
  }).join('') : '<div class="muted">waiting for runner…</div>';
  // signal account: every signal in plain English + totals
  const sigs = (o.signals || []).slice().reverse();
  $('ocSignalLog').innerHTML = sigs.length ? sigs.map((s) => {
    const when = s.t ? new Date(s.t * 1000).toLocaleString() : '';
    const badge = s.status === 'active'
      ? ' <span class="badge">active</span>'
      : ' <span class="badge" style="opacity:.55">expired</span>';
    return `<div><span class="t">${esc(when)}</span>${esc(s.text || '')}${badge}</div>`;
  }).join('') : '<div class="muted">no signals yet — the monitor is still gathering its first 24h of flow history.</div>';
  const active = sigs.filter((s) => s.status === 'active');
  const combined = active.reduce((a, s) => a + (s.effect || 0), 0);
  const bull = sigs.filter((s) => (s.effect || 0) > 0).length;
  const bear = sigs.filter((s) => (s.effect || 0) < 0).length;
  $('ocSigTotal').textContent = sigs.length ? fmtSigned(combined) : '—';
  $('ocSigTotalN').textContent = sigs.length
    ? `${active.length} active · all time ${sigs.length} (${bull} bullish / ${bear} bearish / ${sigs.length - bull - bear} neutral)`
    : 'no signals recorded yet';
}

/* ---------------- live price + chart ---------------- */
const chart = { candles: [], last: null, viewMin: null };
let ws = null, wsAlive = 0;

async function loadCandles() {
  const now = Math.floor(Date.now() / 1000);
  try {
    const rows = await coinbaseCandles(now - 239 * 60, now, 60);
    if (rows.length) { chart.candles = rows; chart.last = rows[rows.length - 1].c; setPrice(chart.last); }
  } catch (e) { $('wsText').textContent = 'candle feed unavailable'; }
  schedDraw();
}
function setPrice(p) { chart.last = p; $('px').textContent = '$' + p.toFixed(4); $('pxTime').textContent = new Date().toLocaleTimeString(); }
function onTick(price, tsMs) {
  const minute = Math.floor(tsMs / 60000) * 60;
  const cs = chart.candles;
  setPrice(price);
  if (!cs.length) return;
  const last = cs[cs.length - 1];
  if (last.t === minute) { last.c = price; last.h = Math.max(last.h, price); last.l = Math.min(last.l, price); }
  else if (minute > last.t) { cs.push({ t: minute, o: price, h: price, l: price, c: price, v: 0 }); if (cs.length > 1600) cs.shift(); }
  schedDraw();
}
function connectWS() {
  try { ws = new WebSocket('wss://ws-feed.exchange.coinbase.com'); } catch { return; }
  ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', product_ids: ['XRP-USD'], channels: ['ticker'] }));
  ws.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      if (m.type === 'ticker' && m.price) { wsAlive = Date.now(); onTick(parseFloat(m.price), m.time ? Date.parse(m.time) : Date.now()); }
    } catch { /* ignore */ }
  };
  ws.onclose = () => setTimeout(connectWS, 3000);
  ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
}
async function pollTicker() {
  if (Date.now() - wsAlive < 8000) return;
  try {
    const r = await fetch('https://api.exchange.coinbase.com/products/XRP-USD/ticker');
    const j = await r.json();
    if (j.price) onTick(parseFloat(j.price), Date.now());
  } catch { /* ignore */ }
}
function renderFeedBadge() {
  const live = Date.now() - wsAlive < 8000;
  $('wsDot').className = 'dot ' + (live ? 'ok' : chart.last ? 'warn' : 'bad');
  $('wsText').textContent = live ? 'live tick feed' : chart.last ? 'polling price' : 'price feed offline';
}

let drawQueued = false;
function schedDraw() { if (!drawQueued) { drawQueued = true; requestAnimationFrame(() => { drawQueued = false; drawChart(); }); } }

/* ---------------- chart zoom (visible time window only; nothing else changes) ---------------- */
const ZMIN = 15, ZMAX = 1440; // minutes
let histLoading = false;
async function ensureHistory(minutes) {
  const need = Math.min(Math.ceil(minutes) + 2, ZMAX);
  const haveMin = chart.candles.length ? (Date.now() / 1000 - chart.candles[0].t) / 60 : 0;
  if (haveMin >= need || histLoading) return;
  histLoading = true;
  try {
    const bars = await fetchBars(need + 5, { step: 60 });
    const m = new Map(bars.map((b) => [b.t, b]));
    for (const c of chart.candles) m.set(c.t, c); // live candles win on overlap
    chart.candles = [...m.values()].sort((a, b) => a.t - b.t);
  } catch { /* keep whatever history we already have */ }
  histLoading = false;
  schedDraw();
}
function setZoom(minutes) {
  chart.viewMin = minutes == null ? null : Math.min(ZMAX, Math.max(ZMIN, minutes));
  if (chart.viewMin != null) ensureHistory(chart.viewMin);
  schedDraw();
}
function zoomBy(f) {
  const cs = chart.candles;
  if (!cs.length) return;
  const cur = chart.viewMin == null ? (cs[cs.length - 1].t + 60 - cs[0].t) / 60 : chart.viewMin;
  setZoom(cur * f);
}
function fmtSpan(m) { return 'last ' + (m >= 60 ? (m / 60).toFixed(1).replace(/\.0$/, '') + 'h' : Math.round(m) + 'm'); }

function drawChart() {
  const cv = $('chart');
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const cs = chart.candles;
  const ink = css('--ink'), muted = css('--muted'), line = css('--line'), up = css('--up'), down = css('--down'), accent = css('--accent');
  if (!cs.length) { ctx.fillStyle = muted; ctx.font = '14px system-ui'; ctx.fillText('Waiting for real-time candles…', 20, 40); return; }
  const pad = { l: 8, r: 64, t: 12, b: 24 };
  const tEnd = cs[cs.length - 1].t + 60;
  const spanMin = (tEnd - cs[0].t) / 60;
  const viewMin = chart.viewMin == null ? spanMin : Math.min(chart.viewMin, spanMin);
  const tMin = tEnd - viewMin * 60;
  const zl = $('zlabel');
  if (zl) zl.textContent = chart.viewMin == null ? 'all' : fmtSpan(viewMin);
  const fc = summary?.latest;
  const nowS = Date.now() / 1000;
  const showCone = fc && fc.q && nowS - fc.t_issue < 45 * 60 && fc.t_issue >= tMin;
  const tMax = Math.max(tEnd + 120, showCone ? fc.target_t + 120 : 0);
  let lo = Infinity, hi = -Infinity;
  for (const c of cs) { if (c.t < tMin) continue; lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); }
  if (showCone) { lo = Math.min(lo, fc.c0 * Math.exp(fc.q[0])); hi = Math.max(hi, fc.c0 * Math.exp(fc.q[6])); }
  const m = (hi - lo) * 0.06 || hi * 0.001; lo -= m; hi += m;
  const X = (t) => pad.l + ((t - tMin) / (tMax - tMin)) * (W - pad.l - pad.r);
  const Y = (p) => pad.t + (1 - (p - lo) / (hi - lo)) * (H - pad.t - pad.b);
  ctx.font = '11px system-ui'; ctx.textBaseline = 'middle';
  // grid
  ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.fillStyle = muted;
  for (let i = 0; i <= 5; i++) {
    const p = lo + ((hi - lo) * i) / 5, y = Y(p);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    ctx.fillText(p.toFixed(4), W - pad.r + 6, y);
  }
  ctx.textBaseline = 'alphabetic';
  const tick = (viewMin <= 60 ? 10 : viewMin <= 180 ? 30 : viewMin <= 720 ? 120 : 240) * 60;
  for (let t = Math.ceil(tMin / tick) * tick; t < tMax; t += tick) {
    const x = X(t);
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke();
    ctx.fillText(hhmm(t), x - 14, H - 7);
  }
  // forecast cone
  if (showCone) {
    const x0 = X(fc.t_issue), x1 = X(fc.target_t), y0 = Y(fc.c0);
    const qp = (k) => Y(fc.c0 * Math.exp(fc.q[k]));
    const band = (a, b, alpha) => {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, qp(a)); ctx.lineTo(x1, qp(b)); ctx.closePath();
      ctx.globalAlpha = alpha; ctx.fillStyle = accent; ctx.fill(); ctx.globalAlpha = 1;
    };
    band(0, 6, 0.12); band(2, 4, 0.22);
    ctx.setLineDash([5, 4]); ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, qp(3)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, pad.t); ctx.lineTo(x1, H - pad.b); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ink; ctx.font = '600 12px system-ui';
    ctx.fillText(`P(up) ${(fc.p * 100).toFixed(1)}%`, Math.max(pad.l + 4, x1 - 92), Math.max(pad.t + 12, qp(6) - 8));
  }
  // candles
  const pxMin = (W - pad.l - pad.r) / ((tMax - tMin) / 60);
  const bw = Math.max(1, pxMin * 0.7);
  for (const c of cs) {
    const x = X(c.t + 30), col = c.c >= c.o ? up : down;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, Y(c.h)); ctx.lineTo(x, Y(c.l)); ctx.stroke();
    const yo = Y(c.o), yc = Y(c.c);
    ctx.fillRect(x - bw / 2, Math.min(yo, yc), bw, Math.max(1, Math.abs(yo - yc)));
  }
  // scored-forecast markers
  if (summary?.recent) {
    for (const r of summary.recent) {
      if (r.t < tMin || r.t > tEnd) continue;
      const hit = r.p === 0.5 ? null : (r.p > 0.5) === (r.y === 1);
      ctx.fillStyle = hit === null ? muted : hit ? up : down;
      ctx.strokeStyle = css('--panel'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(r.t), Y(r.c0), 3.5, 0, 6.2832); ctx.fill(); ctx.stroke();
    }
  }
  // last price tag
  const lp = chart.last ?? cs[cs.length - 1].c, yl = Y(lp);
  ctx.strokeStyle = ink; ctx.globalAlpha = 0.35; ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(pad.l, yl); ctx.lineTo(W - pad.r, yl); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  ctx.fillStyle = ink; ctx.fillRect(W - pad.r + 1, yl - 9, pad.r - 2, 18);
  ctx.fillStyle = css('--bg'); ctx.font = '600 11px system-ui'; ctx.fillText(lp.toFixed(4), W - pad.r + 5, yl + 4);
}

/* ---------------- heartbeat + forecast card ---------------- */
function renderHeartbeat() {
  const d = $('hbDot'), t = $('hbText');
  if (!summary) { d.className = 'dot bad'; t.textContent = 'runner has not published yet'; return; }
  const age = (Date.now() - Date.parse(summary.health?.heartbeat || summary.generated_at)) / 60000;
  d.className = 'dot ' + (age < 12 ? 'ok' : age < 60 ? 'warn' : 'bad');
  t.textContent = age < 12 ? `runner live · ${summary.counts.forecasts.toLocaleString()} forecasts issued` : `runner last seen ${Math.round(age)} min ago`;
}
function renderForecast() {
  const L = summary?.latest;
  if (!L) { $('pUp').textContent = '—'; $('fcNext').textContent = 'waiting for the first forecast'; return; }
  $('pUp').textContent = (L.p * 100).toFixed(1) + '%';
  $('pBar').style.width = (L.p * 100).toFixed(1) + '%';
  $('fcIssued').textContent = stamp(L.t_issue);
  $('fcResolve').textContent = L.res ? `${stamp(L.target_t)} → ${L.res.y === 1 ? 'went up' : L.res.y === 0 ? 'went down' : 'unchanged'} (${usd(L.res.c1)})` : stamp(L.target_t) + ' (pending)';
  $('fcC0').textContent = usd(L.c0);
  if (L.q) {
    $('fcI50').textContent = `${usd(L.c0 * Math.exp(L.q[2]))} – ${usd(L.c0 * Math.exp(L.q[4]))}`;
    $('fcI90').textContent = `${usd(L.c0 * Math.exp(L.q[0]))} – ${usd(L.c0 * Math.exp(L.q[6]))}`;
  }
  $('fcVer').textContent = `v${L.cfg_version} · ${L.cfg_hash}`;
}
function tickCountdown() {
  const t = Date.now() / 1000, next = (Math.floor(t / 300) + 1) * 300 + 10, s = Math.max(0, Math.round(next - t));
  $('fcNext').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  renderFeedBadge();
  renderWindow();
}

/* ---------------- 15-minute window panel (:00/:15/:30/:45) ---------------- */
function windowBounds(nowMs) {
  const s = Math.floor(nowMs / 1000);
  const start = Math.floor(s / 900) * 900;
  return { start, end: start + 900 };
}
const fmtET = (tsMs) => new Date(tsMs).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
function renderWindow() {
  if (!$('wCard')) return;
  const now = Date.now();
  const { start, end } = windowBounds(now);
  $('wRange').textContent = `${fmtET(start * 1000)} – ${fmtET(end * 1000)} ET`;
  const s = Math.max(0, end - Math.floor(now / 1000));
  $('wCount').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const W = summary?.window_fc;
  if (!W || W.p == null || !W.c0) {
    $('wPup').textContent = '—'; $('wPdown').textContent = '—'; $('wRef').textContent = '—';
    $('wPx').textContent = '—'; $('wVs').textContent = 'waiting for the window forecast';
    return;
  }
  $('wPup').textContent = (W.p * 100).toFixed(1) + '%';
  $('wBar').style.width = (W.p * 100).toFixed(1) + '%';
  $('wPdown').textContent = ((1 - W.p) * 100).toFixed(1) + '%';
  $('wRef').textContent = usd(W.c0);
  $('wPx').textContent = W.q ? usd(W.c0 * Math.exp(W.q[3])) : '—';
  const last = chart.last;
  if (last && W.c0) {
    const bps = (last / W.c0 - 1) * 1e4;
    $('wVs').innerHTML = `<span class="${bps >= 0 ? 'up' : 'down'}">${bps >= 0 ? '+' : ''}${bps.toFixed(1)} bps ${bps >= 0 ? 'above' : 'below'}</span>`;
  } else $('wVs').textContent = '—';
}

/* ---------------- score tiles + diagrams ---------------- */
let currentWin = 'all';
const tile = (k, v, s = '') => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
function verdict(dm, label) {
  if (!dm || !isFinite(dm.pALess)) return 'n/a';
  const better = dm.dbar < 0;
  const p = better ? dm.pALess : dm.pBLess;
  return `p = ${p < 0.001 ? '<0.001' : p.toFixed(3)} (${better ? 'better' : 'worse'} than ${label})`;
}
function metricsHtml(w, { showMembers = true } = {}) {
  const ci = w.brierCI ? `95% CI ${f(w.brierCI[0], 4)}–${f(w.brierCI[1], 4)}` : '';
  const sig = w.dmVs50 && w.dmVs50.dbar < 0 && w.dmVs50.pALess < 0.05;
  let h = '<div class="grid g4">';
  h += tile('Scored forecasts', w.n.toLocaleString(), `effective n ≈ ${Math.round(w.nEff)} (overlap-adjusted)`);
  h += tile('Brier score', f(w.brier, 5), `${ci} · no-skill = 0.25000`);
  h += tile('Skill vs 50% (BSS)', pct(w.bss50, 3), w.dmVs50 ? verdict(w.dmVs50, '50%') : '');
  h += tile('Skill vs climatology', pct(w.bssBase, 3), w.dmVsBase ? verdict(w.dmVsBase, 'climatology') : `climatology Brier ${f(w.brierBase, 5)}`);
  h += tile('Log loss', f(w.logloss, 5), 'no-skill = 0.69315');
  h += tile('Direction hit rate', pct(w.accuracy, 2), w.accCI ? `95% CI ${pct(w.accCI[0], 1)}–${pct(w.accCI[1], 1)} · p=${f(w.accP, 3)}` : '');
  h += tile('Calibration error (ECE)', f(w.ece, 4), `REL ${f(w.rel, 5)} · RES ${f(w.res, 5)} · UNC ${f(w.unc, 4)}`);
  h += tile('Calibration slope β', w.calib ? f(w.calib.beta, 2) : '—', w.calib ? `α ${f(w.calib.alpha, 3)} ± ${f(w.calib.seAlpha, 3)} · β ± ${f(w.calib.seBeta, 2)} (ideal 0, 1)` : 'needs more forecasts');
  if (w.interval?.n) {
    h += tile('Interval coverage', `${pct(w.interval.c50, 1)} / ${pct(w.interval.c80, 1)} / ${pct(w.interval.c90, 1)}`, 'targets 50% / 80% / 90%');
    h += tile('Pinball loss', f(w.interval.pinballBps, 3) + ' bps', 'mean over 7 quantiles');
  }
  if (w.ladder) {
    h += tile('Strike-ladder Brier', f(w.ladder.brier, 5), `threshold contracts at ±10/25/40 bps · per-strike climatology ${f(w.ladder.climatology, 5)} · n=${w.ladder.n}`);
  }
  if (showMembers && w.members) {
    h += tile('Member Brier scores', Object.entries(w.members).map(([k, v]) => `${k} ${f(v, 5)}`).join('<br>'), '');
  }
  h += '</div>';
  h += `<p class="${sig ? 'up' : 'muted'}" style="margin:12px 0 0">${sig
    ? 'The forecasts beat the no-skill 50% baseline with statistical significance at the 5% level (Diebold–Mariano, overlap-robust).'
    : 'No statistically significant skill over 50% yet. For a near-efficient 15-minute market this is the expected state until the sample is large; the agent keeps the forecasts calibrated and shrunk accordingly.'}</p>`;
  return h;
}
function drawReliability(cv, bins, deff, note) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const muted = css('--muted'), line = css('--line'), accent = css('--accent'), ink = css('--ink');
  const pad = { l: 44, r: 12, t: 12, b: 34 };
  if (!bins || bins.length < 2) { ctx.fillStyle = muted; ctx.font = '13px system-ui'; ctx.fillText('Reliability diagram appears once there are enough forecasts.', 16, 30); return; }
  let lo = 1, hi = 0;
  for (const b of bins) {
    const se = 1.96 * Math.sqrt(Math.max(b.y * (1 - b.y), 0.05) / Math.max(1, b.n / deff));
    lo = Math.min(lo, b.p, b.y - se); hi = Math.max(hi, b.p, b.y + se);
  }
  lo = Math.max(0, Math.min(lo, 0.5) - 0.01); hi = Math.min(1, Math.max(hi, 0.5) + 0.01);
  const X = (v) => pad.l + ((v - lo) / (hi - lo)) * (W - pad.l - pad.r), Y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  ctx.strokeStyle = line; ctx.fillStyle = muted; ctx.font = '11px system-ui'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke();
    ctx.fillText((v * 100).toFixed(1) + '%', 2, Y(v) + 4);
    ctx.fillText((v * 100).toFixed(1) + '%', X(v) - 14, H - 18);
  }
  ctx.fillText('forecast probability →', W / 2 - 50, H - 4);
  ctx.save(); ctx.translate(10, H / 2 + 40); ctx.rotate(-Math.PI / 2); ctx.fillText('observed frequency →', 0, 0); ctx.restore();
  ctx.strokeStyle = muted; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(lo), Y(lo)); ctx.lineTo(X(hi), Y(hi)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = accent; ctx.fillStyle = accent; ctx.lineWidth = 1.5;
  for (const b of bins) {
    const se = 1.96 * Math.sqrt(Math.max(b.y * (1 - b.y), 0.05) / Math.max(1, b.n / deff));
    ctx.beginPath(); ctx.moveTo(X(b.p), Y(Math.max(lo, b.y - se))); ctx.lineTo(X(b.p), Y(Math.min(hi, b.y + se))); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(b.p), Y(b.y), 4, 0, 6.2832); ctx.fill();
  }
  ctx.fillStyle = ink;
  if (note) { ctx.fillStyle = muted; ctx.font = '11px system-ui'; ctx.fillText(note, pad.l + 6, pad.t + 12); }
}
function drawRolling(cv, series) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const muted = css('--muted'), line = css('--line'), accent = css('--accent'), warn = css('--warn');
  if (!series || series.length < 3) { ctx.fillStyle = muted; ctx.font = '13px system-ui'; ctx.fillText('Rolling 12-hour Brier appears after 144 scored forecasts.', 16, 30); return; }
  const vals = series.flatMap((s) => [s.model, s.base]).concat(0.25);
  let lo = Math.min(...vals), hi = Math.max(...vals); const m = (hi - lo) * 0.1 || 0.002; lo -= m; hi += m;
  const pad = { l: 52, r: 12, t: 12, b: 28 };
  const X = (i) => pad.l + (i / (series.length - 1)) * (W - pad.l - pad.r), Y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  ctx.strokeStyle = line; ctx.fillStyle = muted; ctx.font = '11px system-ui';
  for (let i = 0; i <= 4; i++) { const v = lo + ((hi - lo) * i) / 4; ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.fillText(v.toFixed(4), 2, Y(v) + 4); }
  const path = (key, col, dash) => { ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.setLineDash(dash || []); ctx.beginPath(); series.forEach((s, i) => (i ? ctx.lineTo(X(i), Y(s[key])) : ctx.moveTo(X(i), Y(s[key])))); ctx.stroke(); ctx.setLineDash([]); };
  ctx.strokeStyle = muted; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(pad.l, Y(0.25)); ctx.lineTo(W - pad.r, Y(0.25)); ctx.stroke(); ctx.setLineDash([]);
  path('base', warn, [5, 4]); path('model', accent);
  ctx.fillStyle = accent; ctx.fillText('model', pad.l + 6, H - 8); ctx.fillStyle = warn; ctx.fillText('climatology', pad.l + 56, H - 8); ctx.fillStyle = muted; ctx.fillText('0.25 no-skill (dotted)', pad.l + 140, H - 8);
}
function renderScore(win) {
  currentWin = win;
  document.querySelectorAll('#winTabs button').forEach((b) => b.classList.toggle('on', b.dataset.w === win));
  const body = $('scoreBody');
  const w = summary?.windows?.[win];
  if (!summary) { body.innerHTML = '<div class="empty">The runner has not published a scoreboard yet. Deploy the workflow (see README) and this fills in automatically.</div>'; return; }
  if (!w || !w.n) {
    body.innerHTML = `<div class="empty">No scored live forecasts in this window yet (${summary.counts.forecasts} issued, ${summary.counts.pending} pending). Forecasts are scored 15 minutes after they are issued; statistics appear as soon as there is data. Nothing is pre-filled.</div>`;
    return;
  }
  body.innerHTML = metricsHtml(w) + '<div class="grid g2" style="margin-top:14px"><div><h3>Reliability (equal-count bins, 95% bars use overlap-adjusted n)</h3><canvas id="relCv" class="canvas-sm"></canvas></div><div><h3>Rolling 12-hour Brier: model vs climatology</h3><canvas id="rollCv" class="canvas-sm"></canvas></div></div>';
  let rb = w.bins, rnote = '';
  const ab = summary.windows && summary.windows.all && summary.windows.all.bins;
  if ((!rb || rb.length < 2) && win !== 'all' && ab && ab.length >= 2) {
    rb = ab; rnote = 'not enough in this window yet — showing all-time';
  }
  drawReliability($('relCv'), rb, w.deff || 2.36, rnote);
  drawRolling($('rollCv'), win === 'all' ? summary.rolling : null);
}

/* ---------------- in-browser replay ---------------- */
async function runBacktest() {
  const st = $('btStatus'), body = $('btBody');
  try {
    let cfg = DEFAULT_CONFIG, src = 'default configuration (the runner has not published one yet)';
    try { const r = await fetch(DATA_BASE + 'config.json', { cache: 'no-store' }); if (r.ok) { cfg = (await r.json()).champion; src = 'the agent’s current champion configuration v' + cfg.version; } } catch { /* fall back */ }
    champion = cfg;
    st.textContent = 'Downloading ~2,600 real 5-minute candles from Coinbase (about 9 days)…';
    const raw = await fetchBars(2600);
    const lastStart = raw[raw.length - 1].t;
    const bars = gridBars(raw, STEP, lastStart);
    st.textContent = `Replaying ${bars.length.toLocaleString()} bars through the production engine…`;
    await new Promise((r) => setTimeout(r, 30));
    const evalFrom = 1000;
    const { steps } = walkForward(bars, cfg, { quantFrom: evalFrom });
    const S = steps.filter((s) => s.i >= evalFrom && s.y !== null);
    const ps = S.map((s) => s.p), ys = S.map((s) => s.y);
    const sc = binaryScores(ps, ys, { h: cfg.h });
    const lm = ps.map((p, i) => brier(p, ys[i])), lb = S.map((s, i) => brier(s.m[0], ys[i])), l5 = ys.map(() => 0.25);
    const w = {
      ...sc, brierBase: mean(lb), bssBase: 1 - sc.brier / mean(lb),
      dmVs50: dmTest(lm, l5, { h: cfg.h }), dmVsBase: dmTest(lm, lb, { h: cfg.h }),
      members: Object.fromEntries(['base', 'logit', 'drift', 'short'].map((nm, k) => [nm, mean(S.map((s, i) => brier(s.m[k], ys[i])))])),
      interval: quantileScores(S.filter((s) => s.q).map((s) => ({ q: s.q, r: s.r })), QLEVELS),
    };
    st.innerHTML = `Replayed <b>${S.length.toLocaleString()}</b> forecasts from ${stamp(S[0].t + 300)} to ${stamp(S[S.length - 1].t + 300)} using ${esc(src)}. First ${evalFrom} bars were warm-up.`;
    body.innerHTML = metricsHtml(w) + '<div style="margin-top:14px"><h3>Reliability (replay)</h3><canvas id="btRel" class="canvas-sm"></canvas></div>';
    drawReliability($('btRel'), sc.bins, sc.deff);
  } catch (e) {
    st.innerHTML = `<span class="down">Could not run the replay: ${esc(e.message || e)}</span> (your network may block the exchange API).`;
  }
}

/* ---------------- agent + integrity panels ---------------- */
function describeEvent(e) {
  const ev = e.evidence;
  switch (e.type) {
    case 'search':
      return `<span class="tag">search</span>${esc(e.decision)}${e.reason ? ' — ' + esc(e.reason) : ''}${ev?.best ? `<br><span class="muted">best challenger: ${esc(ev.best.change)} · ΔBrier ${f(ev.best.delta, 6)} · ${ev.tested} tested on ${ev.n} held-out bars</span>` : ''}`;
    case 'adopt': return `<span class="tag adopt">adopt</span>v${e.version}: ${esc(e.change)}<br><span class="muted">ΔBrier ${f(ev?.best?.delta, 6)}, DM p=${f(ev?.best?.dmP, 5)} &lt; ${f(ev?.best?.alphaCorrected, 5)}</span>`;
    case 'shrink': return `<span class="tag shrink">shrink</span>confidence factor ${f(e.from, 2)} → ${f(e.to, 2)} <span class="muted">(n=${e.evidence?.n}, raw optimum ${f(e.evidence?.rawLambda, 2)})</span>`;
    case 'shrink-review': return `<span class="tag">shrink</span>kept ${f(e.current, 2)} (suggested ${f(e.suggested, 2)}, n=${e.n})`;
    case 'rollback-check': return `<span class="tag">verify</span>${e.enough ? `live ${f(e.liveBrier, 5)} vs previous model ${f(e.prevBrier, 5)} over ${e.n} → ${e.rollback ? 'ROLLBACK' : 'keep current'}` : `waiting for evidence (${e.n} live forecasts since adoption)`}`;
    case 'rollback': return `<span class="tag rollback">rollback</span>reverted v${e.from_version} → v${e.to_version}`;
    case 'alarm': return `<span class="tag alarm">alarm</span>live Brier worse than climatology by ${f(e.dbar, 5)} (p=${f(e.p, 3)}); early search triggered`;
    default: return `<span class="tag">${esc(e.type)}</span>`;
  }
}
function renderAgent() {
  const A = summary?.agent, P = summary?.config?.params;
  if (!summary || !P) { $('agentStatus').innerHTML = '<tr><td class="muted">No data published yet.</td></tr>'; return; }
  const st = A?.state || {};
  const ago = (t) => (t ? stamp(t) : 'never');
  $('agentStatus').innerHTML = [
    ['Champion version', 'v' + P.version], ['Previous (rollback target)', A?.previousVersion ? 'v' + A.previousVersion : 'none'],
    ['Confidence factor λ', f(P.shrink, 2) + (P.shrink < 0.2 ? ' — forecasts pulled toward 50% (no proven skill)' : '')],
    ['Last full review', ago(st.lastDeepTs)], ['Last adoption', ago(st.lastAdoptTs)],
    ['Review cadence', 'every 6 h, or 1 h after a degradation alarm'],
  ].map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
  const keys = ['volLambda', 'driftLambda', 'baseLambda', 'lrLogit', 'l2Logit', 'lrShort', 'l2Short', 'hedgeEta', 'fixedShare', 'plattLr', 'kLambda', 'kurtLambda'];
  $('paramTable').innerHTML = keys.map((k) => `<tr><th>${k}</th><td>${Number(P[k]).toPrecision(4)}</td></tr>`).join('') + `<tr><th>features</th><td>${esc(P.features.join(', '))}</td></tr>`;
  const S = summary.model_state;
  if (S) {
    const rows = [['Ensemble weights', ['base', 'logit', 'drift', 'short'].map((n, i) => `${n} ${(S.weights[i] * 100).toFixed(1)}%`).join(' · ')],
      ['Platt a, b', `${f(S.a, 4)}, ${f(S.b, 4)}`], ['Student-t ν (live)', f(Math.min(30, Math.max(3.5, S.m4 / (S.m2 * S.m2) > 3.3 ? 4 + 6 / (S.m4 / (S.m2 * S.m2) - 3) : 30)), 1)],
      ['Variance ratio m₂', f(S.m2, 3)], ['Base rate P(up)', pct(S.base, 2)]];
    S.features.forEach((n, i) => rows.push([`logit coef · ${n}`, f(S.w1[i], 4)]));
    rows.push(['logit coef · bias', f(S.w1[S.features.length], 4)]);
    $('stateTable').innerHTML = rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
  } else $('stateTable').innerHTML = '<tr><td class="muted">Published with the next forecast.</td></tr>';
  const ev = A?.events || [];
  $('agentLog').innerHTML = ev.length ? ev.map((e) => `<div><span class="t">${esc(e.ts ? new Date(e.ts).toLocaleString() : '')}</span>${describeEvent(e)}</div>`).join('') : '<div class="muted">No decisions logged yet.</div>';
}
function renderIntegrity() {
  if (!summary) { $('intTable').innerHTML = '<tr><td class="muted">No data published yet.</td></tr>'; return; }
  const H = summary.health || {}, C = summary.counts || {}, X = H.cross_check;
  const rows = [
    ['Ledger events', `${(H.ledger?.seq ?? 0).toLocaleString()} · chain ${H.ledger?.ok ? '<span class="up">verified</span>' : '<span class="down">BROKEN</span>'}`],
    ['Head hash', `<code title="${esc(H.ledger?.head || '')}">${esc((H.ledger?.head || '').slice(0, 20))}…</code>`],
    ['Forecasts / scored / pending', `${C.forecasts} / ${C.resolved} / ${C.pending}`],
    ['Skipped bars (runner late) / voids / exact ties', `${C.gaps} / ${C.voids} / ${C.ties}`],
    ['Bars loaded / gap-filled', `${H.bars_loaded} / ${H.bars_filled}`],
    ['Cross-venue check', X ? `Coinbase ${usd(X.coinbase)} · Kraken ${usd(X.kraken)} · Bitstamp ${usd(X.bitstamp)} · divergence ${f(X.divergencePct, 3)}%` : 'n/a'],
    ['Scoreboard generated', new Date(summary.generated_at).toLocaleString()],
    ['Code revision', H.commit ? `<code>${esc(String(H.commit).slice(0, 10))}</code>` : '—'],
  ];
  if (REPO_URL) rows.push(['Repository', `<a href="${REPO_URL}" target="_blank" rel="noopener">${REPO_URL.replace('https://', '')}</a> · <a href="${REPO_URL}/tree/data" target="_blank" rel="noopener">ledger branch</a>`]);
  $('intTable').innerHTML = rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
}

/* ---------------- download all source files ---------------- */
/* ---------------- 4-agent operational dashboard ---------------- */
const AGENT_TAG_CLASS = { adopt: 'up', reject: 'muted', recover: 'warn', alarm: 'down', info: 'muted' };
async function loadAgents4() {
  const logEl = $('agentLog4');
  if (!logEl) return;
  try {
    const base = RAW_MAIN || './';
    const link = $('agentLogLink');
    if (link) link.href = base + 'data/agent_log.jsonl';
    const lines = (await (await fetch(base + 'data/agent_log.jsonl?t=' + Date.now(), { cache: 'no-store' })).text()).trim().split('\n').filter(Boolean);
    const evs = lines.map((l) => JSON.parse(l)).reverse();
    logEl.innerHTML = '';
    evs.slice(0, 30).forEach((e) => {
      const d = document.createElement('div');
      const t = e.ts ? new Date(e.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      const tagCls = AGENT_TAG_CLASS[e.tag] || 'muted';
      d.innerHTML = `<span class="t">${esc(t)}</span><span class="tag ${esc(e.tag || '')}">${esc(e.agent || '')}</span>` +
        `<span class="${tagCls}">${esc(e.decision || '')}</span><br><span class="muted" style="font-size:12px">${esc(e.detail || '')}</span>`;
      logEl.appendChild(d);
    });
    // health from latest events + live data
    const last = {};
    evs.forEach((e) => { if (e.agent && !last[e.agent]) last[e.agent] = e.ts; });
    const ago = (ts) => {
      if (!ts) return '—';
      const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
      return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : Math.round(m / 60) + 'h ago';
    };
    const set = (id, txt, sub, ok) => {
      const e = $(id); if (!e) return;
      e.textContent = txt; e.className = 'v ' + (ok === false ? 'warn' : ok === true ? 'up' : '');
      const s = $(id + '_t'); if (s) s.textContent = sub || '';
    };
    try {
      const sj = await (await fetch(DATA_BASE + 'summary.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' })).json();
      const genAge = sj.generated_at ? (Date.now() - new Date(sj.generated_at).getTime()) / 60000 : 999;
      set('h4_fc', genAge < 15 ? '● live' : '● stale', 'forecast ' + ago(sj.generated_at), genAge < 15);
    } catch { set('h4_fc', '● ?', '', null); }
    set('h4_sc', last.scorer ? '● live' : '● standby', last.scorer ? 'last run ' + ago(last.scorer) : 'runs every 15 min', !!last.scorer);
    set('h4_rt', last.retrainer ? '● standby' : '● standby', last.retrainer ? 'last run ' + ago(last.retrainer) : 'runs Sundays', true);
    set('h4_rs', last.researcher ? '● standby' : '● standby', last.researcher ? 'last scan ' + ago(last.researcher) : 'runs Mondays', true);
  } catch {
    logEl.innerHTML = '<div class="empty">Agent log unavailable.</div>';
  }
}

/* ---------------- CF Benchmarks live reference-rate panel (additive) ---------------- */
let cfRate = null;
function vwmJS(pairs) {
  if (!pairs.length) return null;
  const s = pairs.slice().sort((a, b) => a[0] - b[0]);
  const total = s.reduce((a, t) => a + t[1], 0);
  if (total <= 0) return null;
  let cum = 0;
  for (const [p, v] of s) { cum += v; if (cum >= total / 2) return p; }
  return s[s.length - 1][0];
}
async function loadCFRate() {
  try {
    const r = await fetch(DATA_BASE + 'cf-rate.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) throw 0;
    cfRate = await r.json();
    renderCFRate();
  } catch { /* keep previous values on screen */ }
}
function renderCFRate(liveVal, liveAgeS, liveNote) {
  if (!cfRate || !$('cfLive')) return;
  const d = cfRate;
  if (d.official_rr && d.official_rr.value) {
    $('cfRR').textContent = '$' + d.official_rr.value.toFixed(5);
    const pub = new Date(d.official_rr.published);
    $('cfRRTime').textContent = 'published ' + pub.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' · 16:00 London fixing';
  }
  const v = liveVal != null ? liveVal : d.live_rate;
  $('cfLive').textContent = v ? '$' + v.toFixed(5) : '—';
  const ageS = liveAgeS != null ? liveAgeS : Math.max(0, Math.round((Date.now() - Date.parse(d.computed_at)) / 1000));
  const ageTxt = ageS < 90 ? ageS + 's ago' : Math.round(ageS / 60) + 'm ago';
  $('cfLiveAge').textContent = 'recomputed ' + ageTxt + (liveNote ? ' · ' + liveNote : ' · server, ' + (d.venues_used || '?') + ' venues');
  if (d.trade_count) $('cfTrades').textContent = d.trade_count.toLocaleString();
}
async function tickCFLive() {
  // Recompute the current partial 5-minute partition live in the browser from
  // Coinbase + Bitstamp public trades (the two venues whose APIs allow browser
  // fetch), blended with the server's finalized partitions (4 venues).
  if (!cfRate || !cfRate.partitions || !cfRate.partitions.length) return;
  try {
    const pStart = Math.floor(Date.now() / 300000) * 300000;
    const [cb, bs] = await Promise.all([
      fetch('https://api.exchange.coinbase.com/products/XRP-USD/trades?limit=100').then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch('https://www.bitstamp.net/api/v2/transactions/xrpusd/').then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]);
    const trades = [];
    for (const t of cb || []) { const ms = Date.parse(t.time); if (ms >= pStart) trades.push([parseFloat(t.price), parseFloat(t.size)]); }
    for (const t of bs || []) { const ms = parseInt(t.date, 10) * 1000; if (ms >= pStart) trades.push([parseFloat(t.price), parseFloat(t.amount)]); }
    const finalized = cfRate.partitions.filter((p) => p.t1 <= pStart && p.vwm != null).slice(-11);
    const vwms = finalized.map((p) => p.vwm);
    const cur = vwmJS(trades);
    if (cur != null) vwms.push(cur);
    else { const lp = cfRate.partitions[cfRate.partitions.length - 1]; if (lp && lp.vwm != null) vwms.push(lp.vwm); }
    if (!vwms.length) return;
    const live = vwms.reduce((a, b) => a + b, 0) / vwms.length;
    renderCFRate(live, 0, 'live in your browser · Coinbase + Bitstamp');
  } catch { /* keep server value on screen */ }
}

/* ---------------- boot ---------------- */
document.querySelectorAll('#winTabs button').forEach((b) => b.addEventListener('click', () => renderScore(b.dataset.w)));
$('zin').addEventListener('click', () => zoomBy(1 / 1.6));
$('zout').addEventListener('click', () => zoomBy(1.6));
$('zfit').addEventListener('click', () => setZoom(null));
$('chart').addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(e.deltaY > 0 ? 1.25 : 1 / 1.25); }, { passive: false });
window.addEventListener('resize', () => { schedDraw(); renderScore(currentWin); });
window.addEventListener('load', () => {
  if (window.renderMathInElement) {
    window.renderMathInElement($('method'), { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
  }
});
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
  initOpheliaAnim();
  initCamilleAnim();
  initMollyAnim();
  if (typeof summary !== 'undefined' && summary) renderOpalPanel(summary);
  loadOpalVerdict();
  initOpalChat();
  loadOpheliaVerdict();
  initOpheliaChat();
  loadCamilleVerdict();
  initCamilleChat();
  loadMollyVerdict();
  initMollyChat();
}

// ================= Violet app glue (fragment) =================
// Coordinator notes:
//   1) Add to app.js imports:
//        import { violetAnswer, violetIsIpProbe, violetRepeatRefusal } from './lib/violetchat.js';
//   2) Splice these functions into app.js (they reuse the existing $() helper,
//      the global `summary`, and the lm-* log/chalkboard styles shared with Masha/Wendy).
//   3) Call initViolet() in boot(), after loadSummary() has run.

/* ---------------- Violet's lab panel ---------------- */
function renderVioletPanel(sum) {
  if (!$('viBoardRegime')) return;
  const s = sum || (typeof summary !== 'undefined' ? summary : null);
  const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  const vv = s && s.volatility;
  const sb = s && s.windows && s.windows.all && s.windows.all.volatility;
  // live stat cards
  if (vv) {
    const rg = vv.regime || 'unknown';
    setT('viRegime', rg);
    setT('viRegimeSub', vv.warmingUp ? 'baseline building' : rg === 'wild' ? 'dampener nominated' : rg === 'calm' ? 'dampener parked' : 'within baseline');
    setT('viVolNow', vv.volNow != null && isFinite(vv.volNow) ? vv.volNow.toFixed(4) : '—');
    setT('viVolNowSub', 'realized vol');
    setT('viVolMed', vv.volMedian != null && isFinite(vv.volMedian) ? vv.volMedian.toFixed(4) : '—');
    setT('viVolMedSub', 'rolling baseline');
    setT('viStatus', vv.degraded ? 'Blind' : vv.warmingUp ? 'Warming up' : 'Live');
    setT('viStatusSub', vv.degraded ? 'feed unreadable — abstaining' : vv.warmingUp ? 'needs days of history' : 'candles flowing');
    const armed = vv.dampenerOn ? true : false;
    setT('viDamp', armed ? 'Armed' : 'Scored only');
    setT('viDampNote', armed ? 'shrinking confidence in wild regimes' : 'scored only, not used');
  }
  if (sb && sb.n >= 30) {
    setT('viBrier', sb.brierMember.toFixed(5));
    setT('viBrierN', 'n=' + sb.n + ' scored' + (sb.brierMember < sb.brierBase ? ' · beats baseline ✓' : ''));
  }
  // board + notebook
  const L = s && s.violet;
  const rowsEl = $('viLog');
  const bubble = $('viBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'consulting the regimes…';
    setT('viBoardRegime', 'warming up…'); setT('viBoardVol', ''); setT('viBoardDamp', ''); setT('viVerdict', '');
    const sp = $('viSpark'); if (sp) sp.setAttribute('points', '');
    setT('viSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Violet is consulting the regimes — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    const rg = c.regime || 'unknown';
    setT('viBoardRegime', `regime: ${rg}`);
    setT('viBoardVol', `vol ${c.vol_now != null ? c.vol_now.toFixed(4) : '—'}  vs baseline ${c.vol_median != null ? c.vol_median.toFixed(4) : '—'}`);
    setT('viBoardDamp', rg === 'wild' ? 'dampener: nominated — confidence shrinks toward 0.5' : 'dampener: parked');
  } else {
    setT('viBoardRegime', c && c.degraded ? 'feed blind…' : 'warming up…');
    setT('viBoardVol', 'collecting history…'); setT('viBoardDamp', '');
  }
  const vEl = $('viVerdict');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}`;
    vEl.style.color = n.verdict === 'dampening' ? '#c4a5f5' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#a3a3a3';
  }
  const pts = (L.log || []).filter((e) => e.computed && e.computed.vol_now != null && !e.computed.degraded).slice(-24).map((e) => e.computed.vol_now);
  const sp = $('viSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('viSparkLabel', `realized vol · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('viSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('viBubble');
      if (b) { b.classList.remove('vi-talk'); void b.offsetWidth; b.classList.add('vi-talk'); }
    }
  }
  if (rowsEl) {
    const cnt = $('viLogCount'); if (cnt) cnt.textContent = '· ' + (L.log || []).length + ' notes saved';
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
      v.className = 'lm-v ' + (e.verdict === 'dampening' ? 'lm-v-useful' : e.verdict === 'insufficient data' ? 'lm-v-insuf' : 'lm-v-not');
      v.textContent = e.verdict;
      const f = document.createElement('span'); f.className = 'lm-f'; f.textContent = e.finding;
      head.append(t, v, f);
      const det = document.createElement('div');
      det.className = 'lm-detail'; det.hidden = true;
      const col = e.collected || {};
      det.innerHTML =
        '<div class="lm-sec"><span class="lm-k">COLLECTED</span><br>' +
        (col.source || 'the lab\u2019s own candles') + ' · ' + (col.window || '') + '<br>' +
        (col.history_note || '') + '</div>' +
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

/* ---------------- Violet's standing verdict ---------------- */
async function loadVioletVerdict() {
  const panel = $('viVPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'violet_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('viVBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'vi-vbadge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('viVPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('viVEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · wild regimes <b>' + pct(ev.decisive_frac) + '</b> · ' +
    'wild-regime cycles <b>' + (ev.wild_cycles || 0) + '</b> · ' +
    (ev.member_n >= 200
      ? 'out-of-sample dampener Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('viDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="vi-vline"><span class="vi-vd">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('viHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="vi-vhyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>' +
    'status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('viVMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' +
    esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + esc(p.id) + '" target="_blank" rel="noopener">' + esc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Violet DM chat ---------------- */
function initVioletChat() {
  const log = $('viChatLog'), input = $('viChatText'), send = $('viChatSend'), chips = $('viChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'vichat-row ' + who;
    if (who === 'violet') {
      const av = document.createElement('img');
      av.src = 'violet-headshot.webp'; av.alt = 'Violet';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'vichat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What is the volatility dampener?', "What's your verdict?", 'Is it in the forecast?', 'Why not predict direction?'];
  if (chips) {
    chips.innerHTML = '';
    for (const q of CHIP_QS) {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'vichat-chip'; c.textContent = q;
      c.addEventListener('click', () => { input.value = q; doSend(); });
      chips.appendChild(c);
    }
  }
  // repeat IP probers are counted (per browser) and get a firmer refusal
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('violetChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'vichat-row violet';
    typing.innerHTML = '<img src="violet-headshot.webp" alt="Violet"><div class="vichat-bubble"><span class="vichat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (violetIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('violetChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? violetRepeatRefusal() : violetAnswer(text);
    } else {
      reply = violetAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('violet', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('violet', "Hello, dear. 🟣 I'm Violet — ask me anything about volatility regimes, my dampener, or how I decide what enters the forecast!"), 800);
}

/* ---------------- Violet flipbook animation ---------------- */
function initVioletAnim() {
  const img = $('viHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'violet.webp', WRITE = 'violet-write.webp', BLINK = 'violet-blink.webp';
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

/* ---------------- Violet entry point ---------------- */
function initViolet() {
  initVioletAnim();
  renderVioletPanel(typeof summary !== 'undefined' ? summary : null);
  loadVioletVerdict();
  initVioletChat();
}

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

/* ---------------- Cherry: correlation-regime lab (fragment) ---------------- */
/* Assembly: index.html includes fragments/cherry-section.html; this script is
   concatenated after app.js. Relies on app.js helpers: $(), setT(),
   DATA_BASE, fmtXrpShort. Chat engine: lib/cherrychat.js (cherryAnswer,
   cherryIsIpProbe, cherryRepeatRefusal, CHERRY_CHAT_VERSION). */

/* Cherry flipbook animation: write arm moves, she blinks. */
function initCherryAnim() {
  const img = $('chHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'cherry.webp', WRITE = 'cherry-write.webp', BLINK = 'cherry-blink.webp';
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

/* ---------------- Cherry DM chat ---------------- */
function initCherryChat() {
  const log = $('chChatLog'), input = $('chChatText'), send = $('chChatSend'), chips = $('chChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'wchat-row ' + who;
    if (who === 'cherry') {
      const av = document.createElement('img');
      av.src = 'cherry-headshot.webp'; av.alt = 'Cherry';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'wchat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What is a coupling regime?', "What's your verdict?", 'Is it in the forecast?', 'Why only follow BTC when coupled?'];
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
  try { ipCount = parseInt(localStorage.getItem('cherryChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'wchat-row cherry';
    typing.innerHTML = '<img src="cherry-headshot.webp" alt="Cherry"><div class="wchat-bubble"><span class="wchat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (cherryIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('cherryChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? cherryRepeatRefusal() : cherryAnswer(text);
    } else {
      reply = cherryAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('cherry', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('cherry', "Hello! I'm Cherry 🍒 Ask me anything about coupling regimes — my verdicts, how I measure the correlation, or how I decide what enters the forecast!"), 800);
}

/* ---------------- Cherry's standing verdict ---------------- */
async function loadCherryVerdict() {
  const panel = $('chPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'cherry_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('chVerdict');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'wv-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('chPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('chEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · decisive coupling <b>' + pct(ev.decisive_frac) + '</b> · ' +
    'coupled <b>' + pct(ev.coupled_frac) + '</b>' +
    (ev.mean_corr24h != null ? ' · mean 24h corr <b>' + ev.mean_corr24h.toFixed(3) + '</b>' : '') + ' · ' +
    (ev.member_n >= 200
      ? 'out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('chDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="wv-line"><span class="wv-d">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('chHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="wv-hyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>' +
    'status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('chMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' +
    esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + esc(p.id) + '" target="_blank" rel="noopener">' + esc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Cherry live panel ---------------- */
function renderCherryPanel(summary) {
  // scoreboard
  if ($('chBrier')) {
    const sb = summary && summary.windows && summary.windows.all && summary.windows.all.corr;
    if (sb) {
      setT('chBrier', sb.brierCorr.toFixed(5));
      setT('chBrierN', 'n=' + sb.n + ' scored' + (sb.brierCorr < sb.brierBase ? ' · beats baseline ✓' : ''));
      if (sb.skill24h && sb.skill24h.n >= 30) {
        setT('chSkill', (sb.skill24h.hitRate * 100).toFixed(1) + '%');
        setT('chSkillSub', 'n=' + sb.skill24h.n + ' · 24h direction');
      }
    }
  }
  // signal cards from live summary.corr
  const C = summary && summary.corr;
  if (C) {
    setT('chCorr', C.corr24h != null ? C.corr24h.toFixed(3) : '—');
    setT('chCorrSub', C.degraded ? 'data blind' : C.warmingUp ? 'building history' : C.coupled ? '24h rolling' : '24h rolling');
    setT('chCoupled', C.degraded ? '—' : C.warmingUp ? '—' : C.coupled ? 'COUPLED' : 'decoupled');
    const cSub = $('chCoupledSub');
    if (cSub) cSub.textContent = C.degraded || C.warmingUp ? 'no read yet' : C.coupled ? "BTC drift licensed" : 'following nothing';
    setT('chTilt', (C.bias >= 0 ? '+' : '') + C.bias.toFixed(4));
    setT('chTiltSub', C.degraded || C.warmingUp ? 'no read' : C.coupled ? (Math.abs(C.bias) >= 0.004 ? 'expressive — decisive' : 'whisper — abstaining') : 'abstaining');
    setT('chStatus', C.degraded ? 'blind' : C.warmingUp ? 'warming up' : 'live');
    const cc = $('chCorr'); if (cc) cc.style.color = C.coupled ? '#ff7d99' : '';
    const ct = $('chCoupled'); if (ct) ct.style.color = C.coupled ? '#ff7d99' : '';
  }
  // spark canvas: recent correlation history
  const spark = $('chSpark');
  if (spark) {
    const g = spark.getContext('2d');
    g.clearRect(0, 0, spark.width, spark.height);
    const pts = (summary && summary.cherry && summary.cherry.log || [])
      .filter((e) => e.computed && e.computed.corr_24h != null && !e.computed.degraded)
      .slice(-40).map((e) => e.computed.corr_24h);
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      g.strokeStyle = '#dc2645'; g.lineWidth = 1.5; g.beginPath();
      pts.forEach((v, i) => {
        const x = 4 + (i / (pts.length - 1)) * (spark.width - 8);
        const y = spark.height - 4 - ((v - mn) / rg) * (spark.height - 8);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.stroke();
    }
  }
  // lab panel: board + notebook
  const L = summary && summary.cherry;
  const rowsEl = $('chLogRows');
  const bubble = $('chBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    setT('chCorrBoard', 'warming up…'); setT('chCoupledBoard', ''); setT('chTiltBoard', ''); setT('chVerdictBoard', '');
    const sp = $('chBoardSpark'); if (sp) sp.setAttribute('points', '');
    setT('chBoardSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Cherry is setting up her lab — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    setT('chCorrBoard', `24h corr  ${c.corr_24h != null ? c.corr_24h.toFixed(3) : '—'}  (${c.coupled ? 'coupled' : 'decoupled'})`);
    setT('chCoupledBoard', c.coupled ? 'BTC drift licensed this cycle' : 'decoupled — following nothing');
    setT('chTiltBoard', `conditional tilt  ${c.bias >= 0 ? '+' : ''}${c.bias.toFixed(4)}`);
  } else {
    setT('chCorrBoard', c && c.degraded ? 'data blind…' : 'warming up…');
    setT('chCoupledBoard', 'collecting history…'); setT('chTiltBoard', '');
  }
  const vEl = $('chVerdictBoard');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879';
  }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded && e.computed.corr_24h != null).slice(-24).map((e) => e.computed.corr_24h);
  const sp = $('chBoardSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('chBoardSparkLabel', `24h corr · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('chBoardSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('chBubble');
      if (b) { b.classList.remove('ww-talk'); void b.offsetWidth; b.classList.add('ww-talk'); }
    }
  }
  if (rowsEl) {
    $('chLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
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
        (col.source || 'XRP + BTC candles') + '<br>' + (col.window || '') + '</div>' +
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

/* Cherry fragment entry point: called by the boot code the coordinator adds. */
function initCherry() {
  initCherryAnim();
  initCherryChat();
  loadCherryVerdict();
}

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

// Sasha's page fragment — init / render / chat / flipbook animation.
//
// Assembled by the coordinator into the page bundle. Mirrors the Wendy
// functions in app.js. Uses only local helpers (falls back cleanly if the
// app.js $ / setT helpers are unavailable); DATA_BASE is read defensively.


const $s = (id) => document.getElementById(id);
const setTs = (id, txt) => { const el = $s(id); if (el) el.textContent = txt; };
const ssEsc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
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
    '<div class="ss-line"><span class="ss-d">' + ssEsc(d.discipline) + ':</span> ' + ssEsc(d.assessment) + '</div>').join('');
  $s('ssHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="ss-hyp"><b>' + ssEsc(h.id) + '</b> — ' + ssEsc(h.claim) + '<br>' +
    'status: <span class="st ' + ssEsc(h.status) + '">' + ssEsc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + ssEsc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $s('ssVerdictMeta').innerHTML = 'Charter v' + ssEsc(doc.charter_version) + ' · updated ' +
    ssEsc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + ssEsc(p.id) + '" target="_blank" rel="noopener">' + ssEsc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
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
        ssEsc(col.source || 'Reddit public JSON') + ' · ' + ssEsc(col.posts_scanned != null ? col.posts_scanned + ' titles' : '?') + ' · ' + ssEsc(col.window || '') + '<br>' +
        ssEsc(col.pipeline || '') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">CHECKS</span><br>' +
        (e.checks || []).map((k) => '<span class="' + (k.pass ? 'lm-check-pass' : 'lm-check-fail') + '">' +
          (k.pass ? '✓' : '✗') + '</span> ' + ssEsc(k.name) + ' — ' + ssEsc(k.detail)).join('<br>') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">WHY</span><br>' + ssEsc(e.verdict_why || '') + '</div>' +
        '<div class="lm-sec"><span class="lm-k">MATHEMATICAL EFFECT</span><br>' + ssEsc((e.math_effect || {}).detail || '') + '</div>';
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

// Nia's lab — frontend fragment.
//
// COORDINATOR: merge into app.js:
//   1. Add to the import block: //   2. Call initNia() in boot() next to initWendyAnim();
//   3. Call renderNiaPanel(summary) in loadSummary() next to renderWendy();
//
// Uses the module-level $, DATA_BASE, and summary from app.js.

/* ---------------- Nia's lab ---------------- */
function renderNiaPanel(summary) {
  if (!$('niTilt')) return;
  const setT = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  const nw = summary && summary.news;
  const sb = summary && summary.windows && summary.windows.all && summary.windows.all.news;
  // live stat cards
  if (nw) {
    const b = nw.bias || 0;
    const dirWord = b > 0.0005 ? 'upbeat' : b < -0.0005 ? 'worrying' : 'quiet';
    setT('niTilt', (b >= 0 ? '+' : '') + b.toFixed(4));
    setT('niTiltSub', dirWord + (b > 0.0005 ? ' · XRP-positive headlines' : b < -0.0005 ? ' · XRP-negative headlines' : ''));
    const act = Array.isArray(nw.activeCatalysts) ? nw.activeCatalysts : [];
    setT('niActive', String(act.length));
    const nPos = act.filter((a) => a.dir > 0).length, nNeg = act.filter((a) => a.dir < 0).length;
    setT('niActiveSub', act.length ? nPos + ' pushing up · ' + nNeg + ' pushing down' : 'wire quiet on the XRP front');
    const top = act[0];
    setT('niLast', top ? (top.headline.length > 72 ? top.headline.slice(0, 72) + '…' : top.headline) : '—');
    setT('niLastSub', top ? (top.dir > 0 ? '▲ upbeat' : '▼ worrying') : 'no catalysts live');
    setT('niStatus', nw.degraded ? 'Blind' : 'Live');
    setT('niStatusSub', nw.degraded ? 'both feeds unreachable — abstaining'
      : (nw.feeds || []).map((f) => f.name + ':' + (f.ok ? 'ok' : 'down')).join(' · ') || 'free public RSS');
    const w = nw.weight || 0;
    setT('niDisciplinesSub', w > 0 ? 'scored · active at weight ' + w.toFixed(2) : 'scored only, not used');
    setT('niCats24', String(nw.catalysts24h != null ? nw.catalysts24h : '—'));
    // tilt sparkline
    try {
      const cv = $('niSpark'), ctx = cv.getContext('2d');
      const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      const series = ((summary.nia && summary.nia.log) || [])
        .filter((e) => e.computed && !e.computed.degraded)
        .slice(-48).map((e) => e.computed.bias);
      if (series.length > 1) {
        const lo = -0.02, hi = 0.02;
        const yOf = (v) => H - 3 - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (H - 6);
        ctx.strokeStyle = 'rgba(140,160,190,.35)'; ctx.beginPath();
        ctx.moveTo(0, yOf(0)); ctx.lineTo(W, yOf(0)); ctx.stroke();
        ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 1.5; ctx.beginPath();
        series.forEach((v, i) => {
          const x = (i / (series.length - 1)) * W;
          i ? ctx.lineTo(x, yOf(v)) : ctx.moveTo(x, yOf(v));
        });
        ctx.stroke();
      }
    } catch { /* canvas optional */ }
  }
  if (sb && sb.n >= 30) {
    setT('niVerdict', sb.brierNews.toFixed(5));
    setT('niVerdictSub', 'n=' + sb.n + ' scored' + (sb.brierNews < sb.brierBase ? ' · beats baseline ✓' : ''));
    if (sb.skill24h && sb.skill24h.n >= 30) {
      setT('niSkill', (sb.skill24h.hitRate * 100).toFixed(1) + '%');
      setT('niSkillSub', 'n=' + sb.skill24h.n + ' · 24h direction');
    }
  }
  // lab panel: board + notebook
  const L = summary && summary.nia;
  const rowsEl = $('niLogRows');
  const bubble = $('niBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'tuning into the wire…';
    setT('niBoardTilt', 'warming up…'); setT('niBoardActive', ''); setT('niBoardTop', ''); setT('niBoardVerdict', '');
    const sp = $('niBoardSpark'); if (sp) sp.setAttribute('points', '');
    setT('niBoardSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Nia is tuning into the wire — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    const dirWord = c.bias > 0.0005 ? 'upbeat' : c.bias < -0.0005 ? 'worrying' : 'quiet';
    setT('niBoardTilt', `news tilt  ${c.bias >= 0 ? '+' : ''}${c.bias.toFixed(4)}  (${dirWord})`);
    setT('niBoardActive', `catalysts live: ${c.active_catalysts || 0}${c.catalysts_24h != null ? ` (${c.catalysts_24h} in 24h)` : ''}`);
    setT('niBoardTop', '');
  } else {
    setT('niBoardTilt', c && c.degraded ? 'wire blind…' : 'warming up…');
    setT('niBoardActive', 'scanning headlines…'); setT('niBoardTop', '');
  }
  const vEl = $('niBoardVerdict');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879';
  }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded).slice(-24).map((e) => e.computed.bias);
  const sp = $('niBoardSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('niBoardSparkLabel', `news tilt · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('niBoardSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('niBubble');
      if (b) { b.classList.remove('ni-talk'); void b.offsetWidth; b.classList.add('ni-talk'); }
    }
  }
  if (rowsEl) {
    $('niLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
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
        (col.source || 'public RSS feeds') + ' · ' + (col.window || '') + '<br>' +
        (col.catalysts_seen_24h != null ? col.catalysts_seen_24h + ' catalysts seen in 24h · ' : '') +
        (col.feeds || 'feeds') + '</div>' +
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

/* ---------------- Nia's standing verdict ---------------- */
async function loadNiaVerdict() {
  const panel = $('niVPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'nia_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('niVBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'nv-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('niVPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('niVEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · decisive catalyst reads <b>' + pct(ev.decisive_frac) + '</b> · ' +
    'live-catalyst cycles <b>' + (ev.catalyst_cycles || 0) + '</b> · ' +
    (ev.member_n >= 200
      ? 'out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('niVDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="nv-line"><span class="nv-d">' + esc(d.discipline) + ':</span> ' + esc(d.assessment) + '</div>').join('');
  $('niVHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="nv-hyp"><b>' + esc(h.id) + '</b> — ' + esc(h.claim) + '<br>' +
    'status: <span class="st ' + esc(h.status) + '">' + esc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + esc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('niVMeta').innerHTML = 'Charter v' + esc(doc.charter_version) + ' · updated ' +
    esc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + esc(p.id) + '" target="_blank" rel="noopener">' + esc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
  // standing verdict also lights the "Standing verdict" stat card
  const sv = $('niDisciplines');
  if (sv) sv.textContent = label;
  // hypotheses summary on the hypotheses card
  const hs = (doc.hypotheses || []);
  const hsv = $('niHypotheses');
  if (hsv) hsv.textContent = hs.filter((h) => h.status === 'supported').length + '/' + hs.length + ' supported';
  const hsSub = $('niHypothesesSub');
  if (hsSub) hsSub.textContent = 'NI1–NI4: ' + hs.map((h) => h.id + '=' + h.status).join(' · ');
}

/* ---------------- Nia DM chat ---------------- */
function initNiaChat() {
  const log = $('niChatLog'), input = $('niChatText'), send = $('niChatSend'), chips = $('niChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'nchat-row ' + who;
    if (who === 'nia') {
      const av = document.createElement('img');
      av.src = 'nia-headshot.webp'; av.alt = 'Nia';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'nchat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What is a news catalyst?', "What's your verdict?", 'Is it in the forecast?', 'What do you do?'];
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
  try { ipCount = parseInt(localStorage.getItem('niaChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'nchat-row nia';
    typing.innerHTML = '<img src="nia-headshot.webp" alt="Nia"><div class="nchat-bubble"><span class="nchat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (niaIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('niaChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? niaRepeatRefusal() : niaAnswer(text);
    } else {
      reply = niaAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('nia', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('nia', "Hello hello! 🧡 Nia here — wire's live, eyes on the headlines! Ask me about news catalysts, my verdicts, or how I decide what enters the forecast model!"), 800);
}

/* ---------------- Nia flipbook animation ---------------- */
function initNiaAnim() {
  const img = $('niHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'nia.webp', WRITE = 'nia-write.webp', BLINK = 'nia-blink.webp';
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

/* ---------------- boot hook ---------------- */
function initNia() {
  initNiaAnim();
  loadNiaVerdict();
  initNiaChat();
}


/* ---------------- Ophelia's lab ---------------- */
function ohDrawSpark(canvasId, vals) {
  const c = $(canvasId);
  if (!c) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  if (!vals || vals.length < 2) return;
  const mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rg = (mx - mn) || 1;
  ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 1.5; ctx.beginPath();
  vals.forEach((v, i) => {
    const x = (W * i) / (vals.length - 1);
    const y = H - 3 - ((v - mn) / rg) * (H - 6);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderOpheliaPanel(summary) {
  if (!$('ohBoardBias')) return;
  const fh = summary && summary.flowhealth;
  const sb = summary && summary.windows && summary.windows.all && summary.windows.all.flowhealth;
  if (fh) {
    const b = fh.bias || 0;
    const vel = fh.flowVelocity || 0, br = fh.breadth;
    const dirWord = b > 0.001 ? 'outflows (bullish)' : b < -0.001 ? 'inflows (bearish)' : 'balanced';
    setT('ohVel', (vel * 100).toFixed(2) + '%');
    setT('ohVelSub', vel > 0.02 ? 'capital moving fast' : 'quiet books');
    setT('ohBreadth', br != null ? (br * 100).toFixed(0) + '%' : '—');
    setT('ohBreadthSub', br != null && br > 0.7 ? 'wallets agree' : 'mixed directions');
    const nf = fh.totalNetFlow;
    setT('ohNet', nf != null ? (nf >= 0 ? '+' : '') + (Math.abs(nf) >= 1e6 ? (nf / 1e6).toFixed(1) + 'M' : Math.abs(nf) >= 1e3 ? (nf / 1e3).toFixed(0) + 'K' : nf.toFixed(0)) + ' XRP' : '—');
    setT('ohStatus', fh.degraded ? 'Ledger unseen' : fh.warmingUp ? 'Warming up' : 'Live');
    setT('ohStatusSub', fh.degraded ? 'snapshots missing — abstaining' : 'balance snapshots each cycle');
    const w = fh.weight || 0;
    setT('ohWeight', w > 0 ? 'Active' : 'Scored only');
    setT('ohWeightNote', w > 0 ? 'blended at weight ' + w.toFixed(2) : 'scored only, not used');
    void dirWord;
  }
  if (sb && sb.n >= 30) {
    setT('ohBrier', sb.brierFlowHealth != null ? sb.brierFlowHealth.toFixed(5) : '—');
    setT('ohBrierN', 'n=' + sb.n + ' scored' + (sb.brierFlowHealth < sb.brierBase ? ' · beats baseline ✓' : ''));
    if (sb.skill24h && sb.skill24h.n >= 30) {
      setT('ohSkill', (sb.skill24h.hitRate * 100).toFixed(1) + '%');
      setT('ohSkillSub', 'n=' + sb.skill24h.n + ' · 24h direction');
    }
  }
  // chalkboard + notebook
  const L = summary && summary.ophelia;
  const rowsEl = $('ohLogRows');
  const bubble = $('ohBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    setT('ohBoardBias', 'warming up…'); setT('ohBoardVel', ''); setT('ohBoardBreadth', ''); setT('ohBoardVerdict', '');
    const sp = $('ohBoardSpark'); if (sp) sp.setAttribute('points', '');
    setT('ohBoardSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Ophelia is setting up her lab — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded && !c.warming_up) {
    const dirWord = c.bias > 0.001 ? 'outflows — bullish' : c.bias < -0.001 ? 'inflows — bearish' : 'balanced';
    setT('ohBoardBias', `flow tilt  ${c.bias >= 0 ? '+' : ''}${c.bias.toFixed(4)}  (${dirWord})`);
    setT('ohBoardVel', `velocity  ${((c.flow_velocity || 0) * 100).toFixed(2)}%`);
    setT('ohBoardBreadth', `breadth  ${c.breadth != null ? (c.breadth * 100).toFixed(0) + '%' : '—'}`);
  } else {
    setT('ohBoardBias', c && c.degraded ? 'ledger unseen…' : 'warming up…');
    setT('ohBoardVel', 'collecting snapshots…'); setT('ohBoardBreadth', '');
  }
  const vEl = $('ohBoardVerdict');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879';
  }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded).slice(-24).map((e) => e.computed.bias);
  ohDrawSpark('ohSpark', pts);
  const sp = $('ohBoardSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('ohBoardSparkLabel', `flow tilt · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('ohBoardSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('ohBubble');
      if (b) { b.classList.remove('oh-talk'); void b.offsetWidth; b.classList.add('oh-talk'); }
    }
  }
  if (rowsEl) {
    $('ohLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
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
        opEsc(col.source || 'XRP Ledger snapshots') + ' · ' + opEsc(col.window || '') + '</div>' +
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

/* ---------------- Ophelia's standing verdict ---------------- */
async function loadOpheliaVerdict() {
  const panel = $('ohPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'ophelia_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('ohBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'oh-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('ohPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('ohEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · decisive flow reads <b>' + pct(ev.decisive_frac) + '</b> · ' +
    (ev.member_n >= 200
      ? 'out-of-sample member Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  $('ohDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="oh-line"><span class="oh-d">' + opEsc(d.discipline) + ':</span> ' + opEsc(d.assessment) + '</div>').join('');
  $('ohHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="oh-hyp"><b>' + opEsc(h.id) + '</b> — ' + opEsc(h.claim) + '<br>' +
    'status: <span class="st ' + opEsc(h.status) + '">' + opEsc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + opEsc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('ohMeta').innerHTML = 'Charter v' + opEsc(doc.charter_version) + ' · updated ' +
    opEsc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + opEsc(p.id) + '" target="_blank" rel="noopener">' + opEsc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Ophelia DM chat ---------------- */
function initOpheliaChat() {
  const log = $('ohChatLog'), input = $('ohChatText'), send = $('ohChatSend'), chips = $('ohChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'ohchat-row ' + who;
    if (who === 'ophelia') {
      const av = document.createElement('img');
      av.src = 'ophelia-headshot.webp'; av.alt = 'Ophelia';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'ohchat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['How are you different from Wendy?', 'What is flow velocity?', 'What is flow breadth?', "What's your verdict?"];
  if (chips) {
    chips.innerHTML = '';
    for (const q of CHIP_QS) {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'ohchat-chip'; c.textContent = q;
      c.addEventListener('click', () => { input.value = q; doSend(); });
      chips.appendChild(c);
    }
  }
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('opheliaChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'ohchat-row ophelia';
    typing.innerHTML = '<img src="ophelia-headshot.webp" alt="Ophelia"><div class="ohchat-bubble"><span class="ohchat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (opheliaIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('opheliaChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? opheliaRepeatRefusal() : opheliaAnswer(text);
    } else {
      reply = opheliaAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('ophelia', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('ophelia', "Hi! I'm Ophelia 🤎 I watch broad capital flows across exchange wallets — velocity, breadth, drift. Ask me how I differ from Wendy, what I'm measuring, or what my verdict is!"), 800);
}

/* ---------------- Ophelia flipbook animation ---------------- */
function initOpheliaAnim() {
  const img = $('ohHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'ophelia.webp', WRITE = 'ophelia-write.webp', BLINK = 'ophelia-blink.webp';
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
        writeTimer = setInterval(() => {
          show(WRITE);
          setTimeout(() => show(BASE), 1600);
        }, 9000);
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

function initOphelia() {
  initOpheliaAnim();
  initCamilleAnim();
  initMollyAnim();
  loadOpheliaVerdict();
  initOpheliaChat();
  loadCamilleVerdict();
  initCamilleChat();
  loadMollyVerdict();
  initMollyChat();
}


/* ---------------- Camille's lab ---------------- */
function cmDrawSpark(canvasId, vals) {
  const c = $(canvasId);
  if (!c) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  if (!vals || vals.length < 2) return;
  const mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rg = (mx - mn) || 1;
  ctx.strokeStyle = '#4a7ab5'; ctx.lineWidth = 1.5; ctx.beginPath();
  vals.forEach((v, i) => {
    const x = (W * i) / (vals.length - 1);
    const y = H - 3 - ((v - mn) / rg) * (H - 6);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderCamillePanel(summary) {
  if (!$('cmBoardTilt')) return;
  const cal = summary && summary.calendar;
  const sb = summary && summary.windows && summary.windows.all && summary.windows.all.escrow;
  // live tilt state from her signal
  if (cal) {
    const tilt = cal.tilt || 0, ds = cal.days_since_escrow;
    setT('cmBoardTilt', tilt > 0 ? `tilt  −${tilt.toFixed(4)}  (bearish)` : 'tilt  none  (outside 1st–7th window)');
    setT('cmBoardDay', ds != null ? `day ${ds} of the escrow month` : '');
    setT('cmBoardRelock', cal.relock != null ? `re-lock ${(cal.relock * 100).toFixed(0)}%` : '');
  }
  if (sb && sb.tiltWindow && sb.tiltWindow.n >= 10) {
    setT('cmBoardTilt', ($('cmBoardTilt') ? $('cmBoardTilt').textContent + ' ' : '') + '');
  }
  // chalkboard + notebook
  const L = summary && summary.camille;
  const rowsEl = $('cmLogRows');
  const bubble = $('cmBubbleText');
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    if (!cal) { setT('cmBoardTilt', 'warming up…'); }
    setT('cmBoardDay', ''); setT('cmBoardRelock', ''); setT('cmBoardVerdict', '');
    const sp = $('cmBoardSpark'); if (sp) sp.setAttribute('points', '');
    setT('cmBoardSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Camille is setting up her lab — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded) {
    const t = c.tilt || 0;
    setT('cmBoardTilt', t > 0 ? `tilt  −${t.toFixed(4)}  (bearish, day ${c.days_since})` : 'tilt  none  (outside 1st–7th window)');
    setT('cmBoardDay', c.days_since != null ? `day ${c.days_since} of the escrow month` : '');
    setT('cmBoardRelock', c.relock != null ? `re-lock ${(c.relock * 100).toFixed(0)}%` : '');
  }
  const vEl = $('cmBoardVerdict');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879';
  }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded).slice(-24).map((e) => e.computed.tilt || 0);
  // sparkline on a dedicated canvas is omitted for Camille; board polyline:
  const sp = $('cmBoardSpark');
  if (sp) {
    if (pts.length > 1) {
      const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' +
        (60 - ((v - mn) / rg) * 52).toFixed(1)).join(' '));
      setT('cmBoardSparkLabel', `tilt · last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('cmBoardSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('cmBubble');
      if (b) { b.classList.remove('cm-talk'); void b.offsetWidth; b.classList.add('cm-talk'); }
    }
  }
  if (rowsEl) {
    $('cmLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
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
        opEsc(col.source || 'escrow calendar') + ' · ' + opEsc(col.window || '') + '</div>' +
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

/* ---------------- Camille's standing verdict ---------------- */
async function loadCamilleVerdict() {
  const panel = $('cmPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'camille_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('cmBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'cm-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('cmPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('cmEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · tilt-window decisive <b>' + pct(ev.decisive_frac) + '</b> · ' +
    (ev.member_n >= 200
      ? 'out-of-sample tilt-window Brier <b>' + ev.member_brier.toFixed(5) + '</b> vs baseline <b>' + ev.base_brier.toFixed(5) + '</b> (n=' + ev.member_n + ')'
      : 'scoreboard warming up (n=' + (ev.member_n || 0) + '/200)');
  $('cmDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="cm-line"><span class="cm-d">' + opEsc(d.discipline) + ':</span> ' + opEsc(d.assessment) + '</div>').join('');
  $('cmHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="cm-hyp"><b>' + opEsc(h.id) + '</b> — ' + opEsc(h.claim) + '<br>' +
    'status: <span class="st ' + opEsc(h.status) + '">' + opEsc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + opEsc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('cmMeta').innerHTML = 'Charter v' + opEsc(doc.charter_version) + ' · updated ' +
    opEsc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + opEsc(p.id) + '" target="_blank" rel="noopener">' + opEsc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Camille DM chat ---------------- */
function initCamilleChat() {
  const log = $('cmChatLog'), input = $('cmChatText'), send = $('cmChatSend'), chips = $('cmChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'cmchat-row ' + who;
    if (who === 'camille') {
      const av = document.createElement('img');
      av.src = 'camille-headshot.webp'; av.alt = 'Camille';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'cmchat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What is the escrow tilt?', 'When does the tilt apply?', "What's your verdict?", 'Do you invent calendar effects?'];
  if (chips) {
    chips.innerHTML = '';
    for (const q of CHIP_QS) {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'cmchat-chip'; c.textContent = q;
      c.addEventListener('click', () => { input.value = q; doSend(); });
      chips.appendChild(c);
    }
  }
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('camilleChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'cmchat-row camille';
    typing.innerHTML = '<img src="camille-headshot.webp" alt="Camille"><div class="cmchat-bubble"><span class="cmchat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (camilleIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('camilleChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? camilleRepeatRefusal() : camilleAnswer(text);
    } else {
      reply = camilleAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('camille', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('camille', "Hi! I'm Camille 📅 I run the calendar-effect lab — the monthly escrow cycle, the 1st–7th tilt, and whether it earns its place in the forecast. Ask me anything!"), 800);
}

/* ---------------- Camille flipbook animation ---------------- */
function initCamilleAnim() {
  const img = $('cmHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'camille.webp', WRITE = 'camille-write.webp', BLINK = 'camille-blink.webp';
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
        writeTimer = setInterval(() => {
          show(WRITE);
          setTimeout(() => show(BASE), 1600);
        }, 9000);
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

function initCamille() {
  initCamilleAnim();
  initMollyAnim();
  loadCamilleVerdict();
  initCamilleChat();
  loadMollyVerdict();
  initMollyChat();
}


/* ---------------- Molly's lab ---------------- */
function renderMollyPanel(summary) {
  if (!$('moBoardWindow')) return;
  const mv = summary && summary.macroev;
  const sb = summary && summary.windows && summary.windows.all && summary.windows.all.macro;
  const L = summary && summary.molly;
  const rowsEl = $('moLogRows');
  const bubble = $('moBubbleText');
  const setWindow = () => {
    if (mv) {
      if (mv.active) {
        setT('moBoardWindow', `window ACTIVE — ${mv.event || 'macro release'} (tier ${mv.tier || '?'})`);
        setT('moBoardNext', mv.minutesToEvent != null ? `${Math.abs(mv.minutesToEvent).toFixed(0)} min ${mv.minutesToEvent >= 0 ? 'to release' : 'since release'}` : '');
      } else {
        setT('moBoardWindow', 'no window — calendar calm');
        const nx = mv.nextRelease;
        setT('moBoardNext', nx ? `next: ${nx.event || 'release'}` : '');
      }
      const w = mv.weight || 0;
      setT('moBoardDamp', w > 0 && mv.active ? 'dampener APPLIED — confidence shrunk' : w > 0 ? 'dampener armed (no window)' : 'dampener at weight 0 — scored only');
    }
  };
  setWindow();
  if (!L || !L.latest) {
    if (bubble) bubble.textContent = 'setting up my lab…';
    if (!mv) setT('moBoardWindow', 'warming up…');
    setT('moBoardNext', ''); setT('moBoardDamp', ''); setT('moBoardVerdict', '');
    const sp = $('moBoardSpark'); if (sp) sp.setAttribute('points', '');
    setT('moBoardSparkLabel', '');
    if (rowsEl) rowsEl.innerHTML = '<div class="lm-empty">Molly is setting up her lab — notebook entries appear after the next runner cycle.</div>';
    return;
  }
  const n = L.latest, c = n.computed;
  if (c && !c.degraded) {
    if (c.active) {
      setT('moBoardWindow', `window ACTIVE — ${c.event || 'macro release'} (tier ${c.tier || '?'})`);
      setT('moBoardNext', 'humility mode: shrinking toward 0.5');
    } else {
      setT('moBoardWindow', 'no window — calendar calm');
      setT('moBoardNext', c.next_release ? `next: ${c.next_release.event || 'release'}` : '');
    }
    const w = (mv && mv.weight) || 0;
    setT('moBoardDamp', w > 0 && c.active ? 'dampener APPLIED' : w > 0 ? 'dampener armed (no window)' : 'weight 0 — scored only');
  }
  const vEl = $('moBoardVerdict');
  if (vEl) {
    vEl.textContent = `verdict: ${n.verdict}${n.verdict === 'not useful' ? ' — yet' : ''}`;
    vEl.style.color = n.verdict === 'useful' ? '#b5e6a2' : n.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879';
  }
  const pts = (L.log || []).filter((e) => e.computed && !e.computed.degraded).map((e) => e.computed.active ? 1 : 0).slice(-24);
  const sp = $('moBoardSpark');
  if (sp) {
    if (pts.length > 1) {
      sp.setAttribute('points', pts.map((v, i) =>
        (300 * i / (pts.length - 1)).toFixed(1) + ',' + (v ? 8 : 60).toFixed(1)).join(' '));
      const wins = pts.reduce((a, b) => a + b, 0);
      setT('moBoardSparkLabel', `${wins} windows in last ${pts.length} notes`);
    } else { sp.setAttribute('points', ''); setT('moBoardSparkLabel', ''); }
  }
  if (bubble) {
    const short = n.finding.length > 150 ? n.finding.slice(0, 150) + '…' : n.finding;
    if (bubble.textContent !== short) {
      bubble.textContent = short;
      const b = $('moBubble');
      if (b) { b.classList.remove('mo-talk'); void b.offsetWidth; b.classList.add('mo-talk'); }
    }
  }
  if (rowsEl) {
    $('moLogCount').textContent = '· ' + (L.log || []).length + ' notes saved';
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
        opEsc(col.source || 'macro calendar') + ' · ' + opEsc(col.window || '') + '</div>' +
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
  void sb;
}

/* ---------------- Molly's standing verdict ---------------- */
async function loadMollyVerdict() {
  const panel = $('moPanel');
  if (!panel || typeof DATA_BASE === 'undefined') return;
  let doc;
  try {
    const r = await fetch(DATA_BASE + 'molly_supervisor.json?m=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return;
    doc = await r.json();
  } catch { return; }
  if (!doc || !doc.verdict) return;
  panel.hidden = false;
  const badge = $('moBadge');
  const label = doc.verdict === 'APPLY_CANDIDATE' ? 'APPLY — nominated for testing' : doc.verdict;
  badge.textContent = label;
  badge.className = 'mo-badge ' + (doc.verdict === 'APPLY_CANDIDATE' ? 'apply' : doc.verdict === 'WITHDRAW' ? 'withdraw' : 'hold');
  $('moPlain').textContent = doc.verdict_plain || '';
  const ev = doc.evidence || {};
  const pct = (x) => (x != null ? (x * 100).toFixed(1) + '%' : 'n/a');
  $('moEvidence').innerHTML =
    'Evidence she used: <b>' + (ev.n || 0) + '</b> lab notes · in-window share <b>' + pct(ev.window_frac) + '</b> · ' +
    (ev.event_n >= 30
      ? 'in-window Brier <b>' + ev.event_window.brierMacro.toFixed(5) + '</b> vs issued <b>' + ev.event_window.brierBase.toFixed(5) + '</b> (n=' + ev.event_n + ')'
      : 'in-window scoreboard warming up (n=' + (ev.event_n || 0) + '/30)');
  $('moDisciplines').innerHTML = (doc.disciplines_applied || []).map((d) =>
    '<div class="mo-line"><span class="mo-d">' + opEsc(d.discipline) + ':</span> ' + opEsc(d.assessment) + '</div>').join('');
  $('moHypotheses').innerHTML = (doc.hypotheses || []).map((h) =>
    '<div class="mo-hyp"><b>' + opEsc(h.id) + '</b> — ' + opEsc(h.claim) + '<br>' +
    'status: <span class="st ' + opEsc(h.status) + '">' + opEsc(h.status) + '</span>' +
    (h.status_why ? ' <span class="muted">(' + opEsc(h.status_why) + ')</span>' : '') + '</div>').join('') ||
    '<div class="muted">No hypotheses recorded yet.</div>';
  const lit = (doc.literature || []).slice(-3).reverse();
  $('moMeta').innerHTML = 'Charter v' + opEsc(doc.charter_version) + ' · updated ' +
    opEsc((doc.updated_at || '').slice(0, 10)) +
    (lit.length ? ' · recent reading: ' + lit.map((p) =>
      '<a href="' + opEsc(p.id) + '" target="_blank" rel="noopener">' + opEsc(p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title) + '</a>').join(' · ') : '');
}

/* ---------------- Molly DM chat ---------------- */
function initMollyChat() {
  const log = $('moChatLog'), input = $('moChatText'), send = $('moChatSend'), chips = $('moChatChips');
  if (!log || !input || !send) return;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, text) => {
    const row = document.createElement('div');
    row.className = 'mochat-row ' + who;
    if (who === 'molly') {
      const av = document.createElement('img');
      av.src = 'molly-headshot.webp'; av.alt = 'Molly';
      row.appendChild(av);
    }
    const b = document.createElement('div');
    b.className = 'mochat-bubble';
    b.textContent = text;
    row.appendChild(b);
    log.appendChild(row);
    scroll();
  };
  const CHIP_QS = ['What happens in an event window?', 'Do you predict the surprise?', "What's your verdict?", 'What is dampening?'];
  if (chips) {
    chips.innerHTML = '';
    for (const q of CHIP_QS) {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'mochat-chip'; c.textContent = q;
      c.addEventListener('click', () => { input.value = q; doSend(); });
      chips.appendChild(c);
    }
  }
  let ipCount = 0;
  try { ipCount = parseInt(localStorage.getItem('mollyChatIpCount') || '0', 10) || 0; } catch { /* private mode */ }
  const doSend = () => {
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    input.value = '';
    bubble('me', text);
    const typing = document.createElement('div');
    typing.className = 'mochat-row molly';
    typing.innerHTML = '<img src="molly-headshot.webp" alt="Molly"><div class="mochat-bubble"><span class="mochat-typing"><span></span><span></span><span></span></span></div>';
    log.appendChild(typing); scroll();
    let reply;
    if (mollyIsIpProbe(text)) {
      ipCount++;
      try { localStorage.setItem('mollyChatIpCount', String(ipCount)); } catch { /* private mode */ }
      reply = ipCount >= 3 ? mollyRepeatRefusal() : mollyAnswer(text);
    } else {
      reply = mollyAnswer(text);
    }
    setTimeout(() => { typing.remove(); bubble('molly', reply); }, 600 + Math.random() * 500);
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  setTimeout(() => bubble('molly', "Hi! I'm Molly 🌹 I run the macro-events lab — event windows, humility, and whether dampening earns its place. The calendar is my compass; humility is my strategy!"), 800);
}

/* ---------------- Molly flipbook animation ---------------- */
function initMollyAnim() {
  const img = $('moHeroImg');
  if (!img) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const BASE = 'molly.webp', WRITE = 'molly-write.webp', BLINK = 'molly-blink.webp';
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
        writeTimer = setInterval(() => {
          show(WRITE);
          setTimeout(() => show(BASE), 1600);
        }, 9000);
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

function initMolly() {
  initMollyAnim();
  loadMollyVerdict();
  initMollyChat();
}

/* Lab notebooks: collapsed by default; header row (with arrow) toggles
   the entry list down/up. Entries keep their own click-to-expand detail. */
function initNotebookToggles() {
  document.querySelectorAll('.lm-logbox').forEach((box) => {
    const head = box.querySelector('.lm-loghead');
    const body = box.querySelector('.lm-log-body');
    if (!head || !body || head.dataset.toggleWired) return;
    head.dataset.toggleWired = '1';
    const setOpen = (open) => {
      body.hidden = !open;
      box.classList.toggle('open', open);
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    setOpen(false); // collapsed by default
    head.addEventListener('click', () => setOpen(body.hidden));
    head.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(body.hidden); }
    });
  });
}

(async function boot() {
  await resolveBases();
  initNotebookToggles();
  initMashaAnim();
  initWendyAnim();
  initOpalAnim();
  initOpheliaAnim();
  initCamilleAnim();
  initMollyAnim();
  loadCandles(); connectWS();
  await loadSummary();
  runBacktest();
  loadAgents4();
  loadMashaVerdict();
  initMashaChat();
  loadWendyVerdict();
  initWendyChat();
  loadNiaVerdict();
  initNiaChat();
  loadSashaVerdict();
  initSashaChat();
  loadSageVerdict();
  initSageChat();
  loadCherryVerdict();
  initCherryChat();
  loadCoraVerdict();
  initCoraChat();
  loadSophieVerdict();
  initSophieChat();
  loadNoraVerdict();
  initNoraChat();
  loadDaisyVerdict();
  initDaisyChat();
  loadVioletVerdict();
  initVioletChat();
  loadOpalVerdict();
  initOpalChat();
  loadOpheliaVerdict();
  initOpheliaChat();
  loadCamilleVerdict();
  initCamilleChat();
  loadMollyVerdict();
  initMollyChat();
  loadCFRate();
  tickCountdown();
  setInterval(tickCountdown, 1000);
  setInterval(pollTicker, 5000);
  setInterval(loadCandles, 60000);
  setInterval(loadSummary, 60000);
  setInterval(loadAgents4, 300000);
  setInterval(loadCFRate, 60000);
  setInterval(tickCFLive, 10000);
  setInterval(schedDraw, 5000);
})();
