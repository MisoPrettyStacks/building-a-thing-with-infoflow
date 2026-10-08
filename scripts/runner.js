// Continuous runner. Intended for GitHub Actions (free for public repos) but runs anywhere with Node >= 18.
//   node scripts/runner.js --data ./data-branch --minutes 305 --push
// Each closed 5-minute bar: resolve due forecasts -> issue the next forecast -> run the agent -> publish scoreboard.
import { execSync } from 'node:child_process';
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fetchBars, mergeBars, coinbaseCandles, referencePrices } from '../lib/data.js';
import { gridBars, forecastLatest, STEP, QLEVELS } from '../lib/engine.js';
import { computeInfoflow } from '../lib/infoflow.js';
import { escrowTilt, daysSinceEscrow, ESCROW_HISTORICAL_RELOCK } from '../lib/calendar.js';
import { parseCalendar, macroProximity, nextEvents } from '../lib/macro.js';
import { accountBalanceXrp, recentPayments, latestLedgerTxCount } from '../lib/xrpl.js';
import { computeOnchainSignal, detectWhaleTransfers } from '../lib/onchain.js';
import { computeTopologyWindow, diagramDistance, median, stdev, TAKENS_DIM, TAKENS_TAU, RIPS_N, TOPO_MIN_HISTORY, TOPO_HISTORY_CAP } from '../lib/topology.js';
import { appendRecord, readLedger, readJson, writeJson, verifyChain, canonical, sha256, ledgerFiles } from '../lib/io.js';
import { buildSummary, joinLedger } from '../lib/summary.js';
import { runAgent, INITIAL_CONFIG } from '../lib/agent.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1]?.startsWith('--') || i + 1 >= process.argv.length ? true : process.argv[i + 1]); };
const DIR = path.resolve(arg('data', './data-branch'));
const MINUTES = Number(arg('minutes', 0));
const PUSH = process.argv.includes('--push');
const ALLOW_LATE = process.argv.includes('--allow-late');
const HIST_BARS = Number(arg('history-bars', 6048)); // 21 days
const MAX_LATE_SEC = 150;
const startedAt = Date.now();
const now = () => Math.floor(Date.now() / 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), ...a);

const sh = (c) => execSync(c, { cwd: DIR, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
let lastPush = 0;

// --- macro calendar (static schedule, parsed once) ---
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const macroCal = parseCalendar(JSON.parse(readFileSync(path.join(REPO_ROOT, 'data', 'macro-calendar.json'), 'utf8')));

// --- on-chain watchlist (verified XRPL addresses) ---
const watchlist = JSON.parse(readFileSync(path.join(REPO_ROOT, 'data', 'onchain-watchlist.json'), 'utf8')).wallets;
const EX_ADDRS = watchlist.filter((w) => w.kind === 'exchange').map((w) => w.address);

// --- on-chain monitor state (persisted on the data branch) ---
const OC_STATE_PATH = path.join(DIR, 'onchain-state.json');
let ocState = readJson(OC_STATE_PATH, null) || { snapshots: [], ema: 0, pulses: [], seen: [], failures: 0, netSeries: [], recentTx: [] };
if (!Array.isArray(ocState.snapshots)) ocState = { snapshots: [], ema: 0, pulses: [], seen: [], failures: 0, netSeries: [], recentTx: [] };
const ocSeen = new Set(ocState.seen || []);
const saveOcState = () => {
  ocState.seen = [...ocSeen].slice(-800);
  writeJson(OC_STATE_PATH, ocState);
};

// --- topology monitor state (persisted on the data branch) ---
// prevLifetimes: H1 lifetimes of the previous window's diagram (for change detection).
// distances: rolling history of diagram distances (for the median + 2sd threshold).
const TOPO_STATE_PATH = path.join(DIR, 'topo-state.json');
let topoState = readJson(TOPO_STATE_PATH, null) || { prevLifetimes: null, distances: [] };
if (!Array.isArray(topoState.distances)) topoState.distances = [];
function publish(force = false) {
  if (!PUSH) return;
  if (!force && Date.now() - lastPush < 4.5 * 60 * 1000) return;
  try {
    sh('git add -A');
    if (!sh('git status --porcelain').trim()) return;
    let has = true;
    try { sh('git rev-parse HEAD'); } catch { has = false; }
    if (has) sh(`git commit --amend -q -m "data ${new Date().toISOString()}"`);
    else sh(`git commit -q -m "data ${new Date().toISOString()}"`);
    sh('git push --force -q origin HEAD:data');
    lastPush = Date.now();
  } catch (e) { log('publish failed:', String(e.stderr || e).slice(0, 300)); }
}

let config = readJson(path.join(DIR, 'config.json'), null) || INITIAL_CONFIG();
let records = readLedger(DIR);
const cfgHash = () => sha256(canonical(config.champion)).slice(0, 16);
const saveConfig = () => writeJson(path.join(DIR, 'config.json'), config);
const chain = verifyChain(DIR);
if (!chain.ok) { log('LEDGER CHAIN BROKEN at seq', chain.brokenAt, '- refusing to continue'); process.exit(2); }

let raw = [];
let bars = [];
let btcRaw = [];
let btcBars = [];
const stats = { cycles: 0, errors: 0, lastRef: null, lastError: null, lastInfoflow: null, regimeWasNoisy: false, lastMacro: null, lastOnchain: null, macroWasActive: false, ocDegraded: false, lastTopology: null };

/**
 * On-chain monitor update: fetch watchlist balances + recent payments from the XRPL,
 * update balance snapshots, detect whale transfers, and compute the slow regime bias.
 * Best-effort: on repeated failure the member abstains (bias 0); never throws.
 */
async function updateOnchain(t) {
  const balances = {};
  const balResults = await Promise.all(watchlist.map((w) => accountBalanceXrp(w.address)));
  let okCount = 0;
  watchlist.forEach((w, i) => { if (balResults[i] != null) { balances[w.address] = +balResults[i].toFixed(2); okCount++; } });
  if (okCount === 0) {
    ocState.failures = (ocState.failures || 0) + 1;
    saveOcState();
    const degraded = ocState.failures >= 3;
    if (degraded && !stats.ocDegraded) {
      append({ type: 'agent', agent: 'onchain', decision: 'feed degraded', detail: `XRPL unreachable ${ocState.failures}x in a row; bias forced to 0 (abstain)` });
      log('agent: onchain feed degraded, bias=0');
    }
    stats.ocDegraded = degraded;
    return { bias: 0, degraded, diag: { degraded, failures: ocState.failures } };
  }
  ocState.failures = 0; stats.ocDegraded = false;
  // snapshot (one per cycle; cap ~8 days at 5-min cadence)
  ocState.snapshots.push({ t, balances });
  if (ocState.snapshots.length > 2500) ocState.snapshots.splice(0, ocState.snapshots.length - 2500);
  // whale-alert scan: recent payments per watchlist wallet
  const payLists = await Promise.all(watchlist.map((w) => recentPayments(w.address, 15)));
  const alerts = detectWhaleTransfers(payLists.flat().filter(Boolean), watchlist, ocSeen);
  for (const a of alerts) {
    if (a.tilt !== 0) ocState.pulses.push({ t: a.t || t, tilt: a.tilt });
    append({
      type: 'agent', agent: 'onchain', decision: 'whale alert',
      detail: `${(a.xrp / 1e6).toFixed(1)}M XRP ${a.fromLabel || a.from.slice(0, 8)} -> ${a.toLabel || a.to.slice(0, 8)}: ${a.note}; pulse ${a.tilt >= 0 ? '+' : ''}${a.tilt.toFixed(3)} decaying over 48h`,
    });
    log(`agent: onchain whale alert ${(a.xrp / 1e6).toFixed(1)}M XRP (${a.note})`);
  }
  // network activity proxies from our own scans (labeled honestly on the page)
  for (const p of payLists.flat().filter(Boolean)) {
    if (p.t && t - p.t < 86400) ocState.recentTx.push({ t: p.t, from: p.from, to: p.to, xrp: +p.xrp.toFixed(2) });
  }
  ocState.recentTx = ocState.recentTx.filter((p) => t - p.t < 86400).slice(-3000);
  const ledgerTx = await latestLedgerTxCount();
  if (ledgerTx != null) {
    ocState.netSeries.push({ t, ledgerTx });
    ocState.netSeries = ocState.netSeries.slice(-2500);
  }
  const sig = computeOnchainSignal({ snapshots: ocState.snapshots, exchangeAddrs: EX_ADDRS, prev: { ema: ocState.ema }, pulses: ocState.pulses, nowSec: t });
  ocState.ema = sig.ema;
  ocState.pulses = ocState.pulses.filter((p) => t - p.t < 48 * 3600);
  ocState.biasHist = (ocState.biasHist || []).concat([{ t, bias: +sig.bias.toFixed(5) }]).slice(-1500);
  saveOcState();
  const cps = new Set();
  let vol24 = 0;
  for (const p of ocState.recentTx) {
    vol24 += p.xrp;
    for (const a of [p.from, p.to]) if (!EX_ADDRS.includes(a) && !watchlist.some((w) => w.address === a)) cps.add(a);
  }
  const diag = {
    bias: +sig.bias.toFixed(5), ema: +sig.ema.toFixed(5), rawBias: sig.rawBias != null ? +sig.rawBias.toFixed(5) : null,
    netFlow24h: sig.netFlow24h != null ? +sig.netFlow24h.toFixed(1) : null,
    netFlow7d: sig.netFlow7d != null ? +sig.netFlow7d.toFixed(1) : null,
    whalePulse: +sig.whalePulse.toFixed(5), activePulses: sig.activePulses || 0,
    warmingUp: sig.warmingUp, degraded: false, failures: 0,
    totalTracked: sig.totalTracked != null ? +sig.totalTracked.toFixed(1) : null,
    network: { tx24h: ocState.recentTx.length, vol24hXrp: +vol24.toFixed(1), counterparties24h: cps.size, ledgerTxSample: ledgerTx },
    biasSeries: (ocState.biasHist || []).slice(-288).map((p) => [p.t, p.bias]),
    computed_at: new Date().toISOString(),
  };
  return { bias: sig.bias, degraded: false, diag };
}

function append(payload) {
  const rec = appendRecord(DIR, payload);
  records.push(rec);
  return rec;
}

async function cycle() {
  const t = now();
  const lastClosedStart = Math.floor(t / STEP) * STEP - STEP;
  const fresh = await coinbaseCandles(t - 30 * STEP, t);
  raw = mergeBars(raw, fresh, t).slice(-(HIST_BARS + 600));
  bars = gridBars(raw, STEP, lastClosedStart);
  const last = bars[bars.length - 1];
  if (!last || last.t !== lastClosedStart) throw new Error('latest closed bar missing');
  // BTC feed for the infoflow experiment (best-effort; the forecast works without it)
  try {
    const btcFresh = await coinbaseCandles(t - 30 * STEP, t, STEP, 'BTC-USD');
    btcRaw = mergeBars(btcRaw, btcFresh, t).slice(-(HIST_BARS + 600));
    btcBars = gridBars(btcRaw, STEP, lastClosedStart);
  } catch (e) { log('btc feed hiccup:', String(e.message || e).slice(0, 120)); }

  const J = joinLedger(records);
  const h = config.champion.h;

  // 1) resolve forecasts whose target bar has closed
  for (const f of J.pending) {
    const targetBarStart = f.target_t - STEP;
    if (targetBarStart > lastClosedStart) continue;
    const b = bars.find((x) => x.t === targetBarStart) || null;
    if (!b) {
      if (t > f.target_t + 3600) append({ type: 'void', id: f.id, reason: 'target bar unavailable after 1h' });
      continue;
    }
    const y = b.c > f.c0 ? 1 : b.c < f.c0 ? 0 : null;
    append({ type: 'resolution', id: f.id, c1: b.c, y, r: Math.log(b.c / f.c0), filled: !!b.filled, source: 'coinbase:XRP-USD' });
    log(`resolved ${f.id}: p=${f.p} c0=${f.c0} c1=${b.c} y=${y}`);
  }

  // 2) issue the forecast for the bar that just closed
  const exists = records.some((r) => r.type === 'forecast' && r.id === lastClosedStart) ||
    records.some((r) => r.type === 'gap' && r.bar_t === lastClosedStart);
  if (!exists) {
    const lag = t - (lastClosedStart + STEP);
    if (lag > MAX_LATE_SEC && !ALLOW_LATE) {
      append({ type: 'gap', bar_t: lastClosedStart, reason: `runner late by ${lag}s (> ${MAX_LATE_SEC}s)` });
      log('skipped bar', lastClosedStart, 'late by', lag);
    } else {
      // infoflow experiment: precompute the member vote + diagnostics for the bar being forecast
      let infoOpts = null;
      try {
        if (btcBars.length > 300) {
          const { votes, noisy, diag } = computeInfoflow(bars, btcBars, { fromIdx: bars.length - 1, shuffles: 50 });
          infoOpts = { votes, noisy };
          stats.lastInfoflow = diag[bars.length - 1];
        }
      } catch (e) { log('infoflow hiccup:', String(e.message || e).slice(0, 120)); }
      // on-chain monitor: slow regime bias from XRPL watchlist flows (best-effort; never breaks the run)
      let oc = { bias: 0, degraded: false, diag: null };
      try {
        oc = await updateOnchain(t);
        stats.lastOnchain = oc.diag;
      } catch (e) { log('onchain hiccup:', String(e.message || e).slice(0, 120)); }
      // topology experiment: Takens embedding + Rips persistent homology (best-effort;
      // never breaks the run). One Rips computation per cycle (~3s); the previous
      // window's diagram comes from the persisted state file.
      let topoOpts = null;
      try {
        const need = RIPS_N + (TAKENS_DIM - 1) * TAKENS_TAU; // 148 returns
        if (bars.length > need + 12) {
          const rets = [];
          for (let k = bars.length - need; k < bars.length; k++) rets.push(Math.log(bars[k].c / bars[k - 1].c));
          const tw = computeTopologyWindow(rets);
          if (tw) {
            let dist = null, threshold = null, dampen = false;
            if (Array.isArray(topoState.prevLifetimes) && topoState.prevLifetimes.length) {
              dist = diagramDistance(tw.lifetimes, topoState.prevLifetimes);
              const hist = topoState.distances.filter((x) => Number.isFinite(x));
              if (hist.length >= TOPO_MIN_HISTORY) {
                threshold = median(hist) + 2 * stdev(hist);
                dampen = dist > threshold;
              }
            }
            const distances = topoState.distances.filter((x) => Number.isFinite(x)).slice(-(TOPO_HISTORY_CAP - 1));
            if (dist != null && Number.isFinite(dist)) distances.push(dist);
            topoState = { prevLifetimes: tw.lifetimes, distances };
            try { writeJson(TOPO_STATE_PATH, topoState); } catch {}
            topoOpts = { dampen, available: true };
            stats.lastTopology = {
              pe: +tw.pe.toFixed(4), max_lifetime: +tw.maxL.toFixed(6), n_bars: tw.nBars,
              diagram_distance: dist == null ? null : +dist.toFixed(6),
              threshold: threshold == null ? null : +threshold.toFixed(6),
              dampen, history_n: distances.length,
              computed_at: new Date().toISOString(),
            };
            if (dampen) log(`agent: topology regime-change detected (dist=${dist.toFixed(4)} > thr=${threshold.toFixed(4)}); dampening`);
          }
        }
      } catch (e) { log('topology hiccup:', String(e.message || e).slice(0, 120)); }
      // macro proximity for the bar being forecast (drives the page indicator + what-if series)
      const proxNow = macroProximity(lastClosedStart + STEP, macroCal);
      stats.lastMacro = { ...proxNow, computed_at: new Date().toISOString() };
      const { step, state } = forecastLatest(bars, config.champion, {
        ...(infoOpts ? { infoflow: infoOpts } : {}),
        macroCal,
        onchain: { bias: oc.bias },
        ...(topoOpts ? { topology: topoOpts } : {}),
      });
      const rec = append({
        type: 'forecast', id: lastClosedStart, bar_t: lastClosedStart, t_issue: lastClosedStart + STEP,
        target_t: lastClosedStart + STEP + h * STEP, issue_lag_sec: lag,
        p: +step.p.toFixed(6), p_raw: +step.praw.toFixed(6), m: step.m.map((x) => +x.toFixed(6)),
        m_infoflow: +step.mInfo.toFixed(6),
        p_escrow: step.pEscrow == null ? null : +step.pEscrow.toFixed(6),
        escrow_tilt: +step.escrowTilt.toFixed(6),
        p_macro: step.pMacro == null ? null : +step.pMacro.toFixed(6),
        macro_active: step.macroActive ? 1 : 0, macro_tier: step.macroTier,
        p_onchain: step.pOnchain == null ? null : +step.pOnchain.toFixed(6),
        onchain_bias: +step.onchainBias.toFixed(6),
        onchain_net24h: oc.diag && oc.diag.netFlow24h != null ? oc.diag.netFlow24h : null,
        p_topology: step.pTopology == null ? null : +step.pTopology.toFixed(6),
        topo_active: step.topoActive ? 1 : 0,
        topo_pe: stats.lastTopology && stats.lastTopology.pe != null ? stats.lastTopology.pe : null,
        topo_dist: stats.lastTopology && stats.lastTopology.diagram_distance != null ? stats.lastTopology.diagram_distance : null,
        q: step.q.map((x) => +x.toFixed(7)), ladder: step.ladder.map((x) => +x.toFixed(5)), q_levels: QLEVELS, nu: step.nu, c0: step.c0,
        cfg_version: config.champion.version, cfg_hash: cfgHash(),
        input_digest: sha256(canonical(bars.slice(-48).map((b) => [b.t, b.c, b.v]))).slice(0, 16),
        source: 'coinbase:XRP-USD', weights: state.weights.map((x) => +x.toFixed(4)),
      });
      log(`forecast ${rec.id}: P(up)=${rec.p} c0=${rec.c0} v${rec.cfg_version}` + (stats.lastInfoflow ? ` infoflow_vote=${rec.m_infoflow}` : ''));
      stats.lastState = state;
      // regime-filter transparency: log when the noise-regime guard engages or disengages
      const noisyNow = !!(stats.lastInfoflow && stats.lastInfoflow.noisy && (config.champion.infoflowWeight || 0) > 0);
      if (noisyNow && !stats.regimeWasNoisy) {
        append({ type: 'agent', agent: 'infoflow', decision: 'regime filter engaged',
          detail: `permutation entropy ${stats.lastInfoflow.perm_entropy} > 0.85 (noise regime); member outputs shrunk toward 0.5` });
        log('agent: infoflow regime filter engaged');
      } else if (!noisyNow && stats.regimeWasNoisy) {
        append({ type: 'agent', agent: 'infoflow', decision: 'regime filter released',
          detail: `permutation entropy back below 0.85; full model confidence restored` });
        log('agent: infoflow regime filter released');
      }
      stats.regimeWasNoisy = noisyNow;
      // macro-event transparency: log when an event window engages/disengages while dampening is armed
      const macroArmed = (config.champion.macroDamp || 0) > 0;
      const macroNow = !!(stats.lastMacro && stats.lastMacro.active && macroArmed);
      if (macroNow && !stats.macroWasActive) {
        append({ type: 'agent', agent: 'macro', decision: 'event window engaged',
          detail: `${stats.lastMacro.event} (${stats.lastMacro.date} ${stats.lastMacro.time_et} ET, tier ${stats.lastMacro.tier}); P(up) deviation x${stats.lastMacro.shrink}, cone widened` });
        log('agent: macro event window engaged:', stats.lastMacro.event);
      } else if (!macroNow && stats.macroWasActive) {
        append({ type: 'agent', agent: 'macro', decision: 'event window released', detail: 'full model confidence restored' });
        log('agent: macro event window released');
      }
      stats.macroWasActive = macroNow;
    }
  }

  // 3) agent review
  const resolved = joinLedger(records).resolved;
  const before = canonical(config);
  const out = runAgent({ nowSec: t, resolved, bars, btcBars, config, macroCal });
  config = out.config;
  for (const ev of out.events) { append({ type: 'agent', ...ev }); log('agent:', ev.type, ev.decision || ev.action || ''); }
  if (canonical(config) !== before) saveConfig();

  // 4) cross-venue sanity check
  try {
    const ref = await referencePrices();
    const vals = Object.values(ref).filter(Number.isFinite);
    if (vals.length) {
      const med = vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)];
      stats.lastRef = { ...ref, coinbase: last.c, divergencePct: (Math.abs(last.c / med - 1) * 100) };
    }
  } catch { /* optional */ }
  stats.cycles++;
  stats.lastError = null;
}

function writeSummary() {
  const agentEvents = records.filter((r) => r.type === 'agent').slice(-40).reverse().map((r) => {
    const { prev, hash, ...rest } = r; return rest;
  });
  const chk = verifyChain(DIR);
  const J = joinLedger(records);
  const summary = buildSummary({
    records, config, agent: { events: agentEvents, state: config.agent, history: config.history.slice(-30).reverse(), previousVersion: config.previous?.version ?? null },
    extras: {
      health: {
        runner_started: new Date(startedAt).toISOString(), heartbeat: new Date().toISOString(), cycles: stats.cycles,
        last_error: stats.lastError, ledger: chk, bars_loaded: bars.length, bars_filled: bars.filter((b) => b.filled).length,
        cross_check: stats.lastRef, source: 'Coinbase Exchange XRP-USD 5-minute candles',
        commit: process.env.GITHUB_SHA || null, tie_count: J.ties,
      },
      ledger_files: ledgerFiles(DIR),
      model_state: stats.lastState || null,
      infoflow: stats.lastInfoflow ? {
        ...stats.lastInfoflow,
        weight: config.champion.infoflowWeight || 0,
        enabled: (config.champion.infoflowWeight || 0) > 0,
        computed_at: new Date().toISOString(),
      } : null,
      calendar: {
        days_since_escrow: daysSinceEscrow(lastClosedStart),
        tilt: +escrowTilt(lastClosedStart, config.champion.escrowRelock ?? ESCROW_HISTORICAL_RELOCK).toFixed(6),
        relock: config.champion.escrowRelock ?? ESCROW_HISTORICAL_RELOCK,
        weight: config.champion.escrowWeight || 0,
        enabled: (config.champion.escrowWeight || 0) > 0,
      },
      macro: stats.lastMacro ? {
        active: stats.lastMacro.active,
        tier: stats.lastMacro.tier,
        event: stats.lastMacro.event,
        date: stats.lastMacro.date,
        time_et: stats.lastMacro.time_et,
        minutes_to_event: stats.lastMacro.minutesToEvent == null || !isFinite(stats.lastMacro.minutesToEvent) ? null : +stats.lastMacro.minutesToEvent.toFixed(1),
        shrink: stats.lastMacro.shrink,
        weight: config.champion.macroDamp || 0,
        enabled: (config.champion.macroDamp || 0) > 0,
        dampening_applied: stats.lastMacro.active && (config.champion.macroDamp || 0) > 0,
        next: nextEvents(now(), macroCal, 3),
        computed_at: stats.lastMacro.computed_at,
      } : null,
      onchain: stats.lastOnchain ? {
        ...stats.lastOnchain,
        weight: config.champion.onchainWeight || 0,
        enabled: (config.champion.onchainWeight || 0) > 0,
      } : null,
      topology: stats.lastTopology ? {
        ...stats.lastTopology,
        weight: config.champion.topologyWeight || 0,
        enabled: (config.champion.topologyWeight || 0) > 0,
      } : null,
    },
  });
  writeJson(path.join(DIR, 'summary.json'), summary);
}

async function main() {
  log(`runner start: dir=${DIR} minutes=${MINUTES} push=${PUSH} ledger_seq=${chain.seq || 0}`);
  raw = await fetchBars(HIST_BARS);
  log(`history loaded: ${raw.length} closed 5-min bars`);
  try {
    btcRaw = await fetchBars(HIST_BARS, { product: 'BTC-USD' });
    log(`btc history loaded: ${btcRaw.length} closed 5-min bars (infoflow experiment)`);
  } catch (e) { log('btc history failed (infoflow degraded):', String(e.message || e).slice(0, 150)); }
  const deadline = MINUTES > 0 ? startedAt + MINUTES * 60000 : 0;
  for (;;) {
    try {
      await cycle();
      writeSummary();
      publish();
    } catch (e) {
      stats.errors++; stats.lastError = String(e.message || e).slice(0, 200);
      log('cycle error:', stats.lastError);
      try { writeSummary(); } catch { /* ignore */ }
    }
    if (!deadline) break;
    // sleep until 6s after the next 5-minute boundary; retry quickly after an error
    const t = Date.now() / 1000;
    let waitS = stats.lastError ? 15 : (STEP - (t % STEP)) + 6;
    if (Date.now() + waitS * 1000 > deadline) break;
    await sleep(waitS * 1000);
  }
  writeSummary();
  publish(true);
  log('runner finished');
}
main().catch((e) => { console.error(e); process.exit(1); });
