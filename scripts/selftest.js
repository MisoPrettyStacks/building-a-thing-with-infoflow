// Unit tests for the math and the no-leakage guarantee.
// The deterministic series built here exist ONLY to test code properties. They are never displayed,
// scored, shipped as data, or used by the live system, which only ever sees real exchange candles.
import assert from 'node:assert/strict';
import { normCdf, tCdf, tQuantile, betaInc, lgamma, brier, logloss, dmTest, wilson, overlapDeff,
  binaryScores, calibrationFit, mulberry32, sigmoid, logit } from '../lib/stats.js';
import { walkForward, forecastLatest, DEFAULT_CONFIG, gridBars } from '../lib/engine.js';
import { appendRecord, verifyChain } from '../lib/io.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let passed = 0;
const near = (a, b, tol, msg) => { assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`); passed++; };
const ok = (c, msg) => { assert.ok(c, msg); passed++; };

// --- special functions against published values
near(normCdf(1.959964), 0.975, 1e-6, 'normCdf(1.96)');
near(normCdf(0), 0.5, 1e-15, 'normCdf(0)');
near(lgamma(5), Math.log(24), 1e-12, 'lgamma(5)');
near(betaInc(0.5, 2, 3), 0.6875, 1e-12, 'I_0.5(2,3)');
near(tCdf(2.0, 5), 0.9490303, 1e-6, 'tCdf(2,5)');
near(tQuantile(0.975, 10), 2.228139, 1e-5, 't_0.975,10');
near(tQuantile(0.95, 3), 2.353363, 1e-5, 't_0.95,3');
near(tQuantile(0.025, 10), -2.228139, 1e-5, 't symmetry');
near(tQuantile(0.9, 30), 1.310415, 1e-5, 't_0.9,30');
near(tCdf(1.5, 1e6), normCdf(1.5), 1e-5, 't -> normal');

// --- scores
near(brier(0.7, 1), 0.09, 1e-12, 'brier');
near(logloss(0.5, 1), Math.LN2, 1e-12, 'logloss');
near(overlapDeff(3), 1 + 2 * ((2 / Math.PI) * Math.asin(2 / 3) + (2 / Math.PI) * Math.asin(1 / 3)), 1e-12, 'Deff');
{
  const [lo, hi] = wilson(50, 100);
  near(lo, 0.4038, 1e-3, 'wilson lo'); near(hi, 0.5962, 1e-3, 'wilson hi');
}
{ // DM: identical losses -> stat 0
  const a = Array.from({ length: 100 }, (_, i) => (i % 7) / 7);
  const r = dmTest(a, a);
  near(r.dbar, 0, 1e-15, 'dm zero'); ok(!(r.pALess < 0.01), 'dm no signal');
  // A uniformly lower loss -> A better
  const b = a.map((x) => x + 0.05 + 0.01 * Math.sin(x * 100));
  ok(dmTest(a, b).pALess < 0.001, 'dm detects better forecaster');
}
{ // calibration recovers a known relationship
  const rng = mulberry32(7);
  const ps = [], ys = [];
  for (let i = 0; i < 20000; i++) { const p = 0.2 + 0.6 * rng(); ps.push(p); ys.push(rng() < p ? 1 : 0); }
  const c = calibrationFit(ps, ys);
  near(c.beta, 1, 0.15, 'calibration slope of calibrated forecasts');
  near(c.alpha, 0, 0.08, 'calibration intercept');
  const s = binaryScores(ps, ys);
  ok(s.ece < 0.02, 'ECE small for calibrated forecasts');
}

// --- deterministic test series (LCG, Box-Muller): NOT data, only a fixture
function fixture(n, { phi = 0, seed = 11, sigma = 0.0012 } = {}) {
  const rng = mulberry32(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  let lp = Math.log(0.5), prev = 0;
  const bars = [];
  for (let i = 0; i < n; i++) {
    const r = phi * prev + sigma * gauss();
    prev = r;
    const o = Math.exp(lp); lp += r; const c = Math.exp(lp);
    bars.push({ t: 1.7e9 + i * 300, o, h: Math.max(o, c), l: Math.min(o, c), c, v: 1000 + 200 * rng() });
  }
  return bars;
}

// --- no look-ahead: changing the future must not change any earlier forecast
{
  const a = fixture(1500);
  const b = a.map((x) => ({ ...x }));
  const cut = 1000;
  const rng = mulberry32(99);
  for (let i = cut + 1; i < b.length; i++) { const c = b[i].c * (1 + 0.05 * (rng() - 0.5)); b[i] = { ...b[i], c, o: c, h: c, l: c, v: 5 + 5000 * rng() }; }
  const ra = walkForward(a, DEFAULT_CONFIG, { quantFrom: 0 }).steps;
  const rb = walkForward(b, DEFAULT_CONFIG, { quantFrom: 0 }).steps;
  let compared = 0;
  for (let k = 0; k < ra.length; k++) {
    if (ra[k].i > cut) break;
    assert.equal(ra[k].p, rb[k].p, `forecast ${ra[k].i} changed when the future changed`);
    assert.deepEqual(ra[k].q, rb[k].q, `quantiles ${ra[k].i} changed`);
    compared++;
  }
  ok(compared > 600, 'leakage test compared many forecasts');
}

// --- determinism, and live path == backtest path
{
  const a = fixture(1400);
  const r1 = walkForward(a, DEFAULT_CONFIG, { quantFrom: 1399 });
  const r2 = walkForward(a, DEFAULT_CONFIG, { quantFrom: 1399 });
  assert.deepEqual(r1.steps.at(-1), r2.steps.at(-1)); passed++;
  const f = forecastLatest(a, DEFAULT_CONFIG);
  assert.equal(f.step.p, r1.steps.at(-1).p); passed++;
  // forecast at index i computed on a truncated series equals the one computed inside the full replay
  const full = walkForward(a, DEFAULT_CONFIG).steps;
  const trunc = walkForward(a.slice(0, 1200), DEFAULT_CONFIG).steps;
  assert.equal(trunc.at(-1).p, full.find((s) => s.i === 1199).p); passed++;
}

// --- does no harm on a driftless random walk (should score ~0.25, not worse)
{
  const a = fixture(6000, { seed: 3 });
  const s = walkForward(a, DEFAULT_CONFIG).steps.filter((x) => x.y !== null && x.i > 1500);
  const bs = s.reduce((t, x) => t + brier(x.p, x.y), 0) / s.length;
  ok(bs < 0.2515 && bs > 0.245, `random-walk Brier near 0.25 (got ${bs.toFixed(5)})`);
  const mx = Math.max(...s.map((x) => Math.abs(x.p - 0.5)));
  ok(mx < 0.2, `no wild overconfidence on noise (max |p-0.5| = ${mx.toFixed(3)})`);
}

// --- can learn a real signal when one exists (persistent returns)
{
  const phi = 0.35, sigma = 0.0012;
  const a = fixture(6000, { phi, seed: 5, sigma });
  const s = walkForward(a, DEFAULT_CONFIG).steps.filter((x) => x.y !== null && x.i > 1500);
  const bs = s.reduce((t, x) => t + brier(x.p, x.y), 0) / s.length;
  // exact oracle for AR(1) returns: P(sum of next 3 returns > 0 | r_t)
  const sd = sigma * Math.sqrt((1 + phi + phi * phi) ** 2 + (1 + phi) ** 2 + 1);
  let ob = 0;
  for (const x of s) {
    const rt = Math.log(a[x.i].c / a[x.i - 1].c);
    const po = normCdf((rt * (phi + phi * phi + phi ** 3)) / sd);
    ob += brier(po, x.y);
  }
  ob /= s.length;
  ok(ob < 0.2475, `oracle sanity (${ob.toFixed(4)})`);
  ok(bs < 0.2475 && bs - ob < 0.004, `learns planted autocorrelation: engine ${bs.toFixed(4)} vs oracle ${ob.toFixed(4)}`);
}

// --- gap filling
{
  const raw = [{ t: 0, o: 1, h: 1, l: 1, c: 1, v: 5 }, { t: 900, o: 2, h: 2, l: 2, c: 2, v: 5 }];
  const g = gridBars(raw);
  assert.equal(g.length, 4); assert.equal(g[1].c, 1); assert.equal(g[3].c, 2); passed += 3;
}

// --- tamper-evident ledger
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
  for (let i = 0; i < 5; i++) appendRecord(dir, { type: 'forecast', id: i, p: 0.5 + i / 100 }, '2026-10-05T00:00:00Z');
  ok(verifyChain(dir).ok, 'chain verifies');
  const f = path.join(dir, 'ledger', '2026-10.jsonl');
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n');
  lines[2] = lines[2].replace('"p":0.52', '"p":0.99');
  fs.writeFileSync(f, lines.join('\n') + '\n');
  ok(!verifyChain(dir).ok, 'tampering is detected');
}

// --- macro calendar: ET conversion, windows, engine behavior
import { parseCalendar, macroProximity, nextEvents, etOffsetMinutes, eventUtcSec } from '../lib/macro.js';
import { computeOnchainSignal, detectWhaleTransfers } from '../lib/onchain.js';
import { buildSummary } from '../lib/summary.js';
const macroCal = parseCalendar(JSON.parse(fs.readFileSync(new URL('../data/macro-calendar.json', import.meta.url), 'utf8')));
{
  near(etOffsetMinutes('2026-01-28'), -300, 1e-9, 'EST offset');
  near(etOffsetMinutes('2026-07-29'), -240, 1e-9, 'EDT offset');
  near(eventUtcSec({ date: '2026-01-28', time_et: '14:00' }), Date.UTC(2026, 0, 28, 19, 0) / 1000, 1e-9, 'FOMC Jan28 -> 19:00Z');
  near(eventUtcSec({ date: '2026-10-14', time_et: '08:30' }), Date.UTC(2026, 9, 14, 12, 30) / 1000, 1e-9, 'CPI Oct14 -> 12:30Z');
  const t1 = macroCal.filter((e) => e.tier === 1);
  const t1_2026 = t1.filter((e) => e.date.startsWith('2026'));
  ok(t1_2026.length === 32, `32 tier-1 events in 2026 (8 FOMC + 12 CPI + 12 NFP), got ${t1_2026.length}`);
  ok(t1.length === 33, `33 tier-1 total incl. the 2027 FOMC stub, got ${t1.length}`);
  const fomc = Date.UTC(2026, 0, 28, 19, 0) / 1000;
  const at = macroProximity(fomc, macroCal);
  ok(at.active && at.tier === 1 && Math.abs(at.shrink - 0.85) < 1e-12, 'tier-1 window active at release');
  const before = macroProximity(fomc - 2 * 3600, macroCal);
  ok(!before.active, 'no window 2h before release');
  const nx = nextEvents(Date.UTC(2026, 9, 7, 12, 0) / 1000, macroCal, 3);
  ok(nx[0].event === 'CPI' && nx[0].date === '2026-10-14', `next event after Oct 7 is Oct-14 CPI, got ${nx[0].event} ${nx[0].date}`);
}
// engine: macro is a no-op at weight 0, shrinks + widens at weight 1
{
  const a = fixture(1500);
  const r0 = walkForward(a, DEFAULT_CONFIG).steps;
  const r1 = walkForward(a, DEFAULT_CONFIG, { macroCal }).steps;
  ok(r0.every((s, k) => s.p === r1[k].p), 'macroCal at weight 0 is byte-identical');
  ok(r1.every((s) => s.pMacro !== null), 'pMacro what-if recorded when idle');
  // bars straddling the Oct-14 CPI release (12:30 UTC): first forecast 9h before, last bar inside the window
  const tEv = Date.UTC(2026, 9, 14, 12, 30) / 1000;
  const bars = [];
  let lp = Math.log(1.4);
  const rng = mulberry32(21);
  for (let i = 0; i < 420; i++) {
    const r = 0.001 * Math.sin(i / 9) + 0.0008 * (rng() - 0.5);
    lp += r; const c = Math.exp(lp);
    bars.push({ t: tEv - 123900 + i * 300, o: c, h: c, l: c, c, v: 1000 });
  }
  const sOff = walkForward(bars, DEFAULT_CONFIG, { macroCal }).steps;
  const sOn = walkForward(bars, { ...DEFAULT_CONFIG, macroDamp: 1 }, { macroCal }).steps;
  const inWin = sOff.map((s, k) => ({ s, k })).filter(({ s }) => s.macroActive);
  ok(inWin.length > 10, `many bars inside the CPI window (${inWin.length})`);
  ok(inWin.every(({ s }) => s.macroTier === 1), 'window tier is 1');
  ok(inWin.every(({ s, k }) => Math.abs(sOn[k].praw - 0.5) <= Math.abs(s.praw - 0.5) + 1e-15), 'dampening shrinks |praw-0.5|');
  ok(inWin.every(({ k }) => sOn[k].pMacro === null), 'pMacro null when dampening applied');
  const fOff = forecastLatest(bars, DEFAULT_CONFIG, { macroCal });
  const fOn = forecastLatest(bars, { ...DEFAULT_CONFIG, macroDamp: 1 }, { macroCal });
  ok(fOn.step.macroActive, 'latest bar inside window');
  const spread = (q) => q[6] - q[0];
  ok(spread(fOn.step.q) > spread(fOff.step.q) * 1.1, 'cone widened in event window');
}

// --- on-chain slow signal: math properties
{
  const EX = ['rEx1', 'rEx2'];
  const T = 1.75e9;
  const snaps = [];
  for (let h = 0; h <= 30; h++) snaps.push({ t: T + h * 3600, balances: { rEx1: 600000, rEx2: 400000 } });
  const flat = computeOnchainSignal({ snapshots: snaps, exchangeAddrs: EX, nowSec: T + 30 * 3600 });
  ok(!flat.warmingUp && Math.abs(flat.bias) < 1e-12, 'flat balances -> zero bias');
  // 6% inflow over 24h -> bearish (negative) bias, bounded
  const inflow = snaps.map((s, i) => (i >= 18 ? { t: s.t, balances: { rEx1: 636000, rEx2: 424000 } } : s));
  const neg = computeOnchainSignal({ snapshots: inflow, exchangeAddrs: EX, nowSec: T + 30 * 3600 });
  ok(neg.bias < -1e-4 && neg.bias >= -0.02, `inflow -> bearish bias ${neg.bias.toFixed(5)}`);
  ok(neg.netFlow24h > 59000 && neg.netFlow24h < 61000, 'netFlow24h measured');
  const outflow = snaps.map((s, i) => (i >= 18 ? { t: s.t, balances: { rEx1: 564000, rEx2: 376000 } } : s));
  const pos = computeOnchainSignal({ snapshots: outflow, exchangeAddrs: EX, nowSec: T + 30 * 3600 });
  ok(pos.bias > 1e-4, 'outflow -> bullish bias');
  // warming up with <24h history
  const short = computeOnchainSignal({ snapshots: snaps.slice(0, 5), exchangeAddrs: EX, nowSec: T + 5 * 3600 });
  ok(short.warmingUp && short.bias === 0, 'abstains while warming up');
  // EMA smoothing: a spike does not instantly saturate
  const spike = computeOnchainSignal({ snapshots: inflow, exchangeAddrs: EX, prev: { ema: 0 }, nowSec: T + 30 * 3600 });
  ok(Math.abs(spike.ema) < Math.abs(spike.rawBias) * 0.5, 'EMA smooths the raw signal');
  // whale alerts
  const seen = new Set();
  const pays = [
    { hash: 'h1', t: T, from: 'rSomeone', to: 'rEx1', xrp: 15e6 },
    { hash: 'h2', t: T, from: 'rEx2', to: 'rElse', xrp: 25e6 },
    { hash: 'h3', t: T, from: 'rA', to: 'rB', xrp: 50e6 }, // not watchlist -> ignored
    { hash: 'h4', t: T, from: 'rEx1', to: 'rEx2', xrp: 12e6 }, // internal reshuffle
  ];
  const watch = [{ address: 'rEx1', label: 'Ex1', kind: 'exchange' }, { address: 'rEx2', label: 'Ex2', kind: 'exchange' }];
  const alerts = detectWhaleTransfers(pays, watch, seen);
  ok(alerts.length === 3, `3 watchlist whale payments detected, got ${alerts.length}`);
  ok(alerts[0].tilt === -0.01 && alerts[1].tilt === 0.01 && alerts[2].tilt === 0, 'whale pulse directions');
  ok(detectWhaleTransfers(pays, watch, seen).length === 0, 'seen hashes deduped');
}
// engine: on-chain bias is a no-op at weight 0, shifts p at weight 1
{
  const a = fixture(1500);
  const r0 = walkForward(a, DEFAULT_CONFIG).steps;
  const r1 = walkForward(a, DEFAULT_CONFIG, { onchain: { bias: 0.01 } }).steps;
  ok(r0.every((s, k) => s.p === r1[k].p), 'onchain at weight 0 is byte-identical');
  ok(r1.every((s) => s.pOnchain !== null && Math.abs(s.onchainBias - 0.01) < 1e-12), 'pOnchain what-if recorded');
  const r2 = walkForward(a, { ...DEFAULT_CONFIG, onchainWeight: 1 }, { onchain: { bias: 0.01 } }).steps;
  ok(r2.every((s, k) => s.pOnchain === null), 'pOnchain null when bias applied');
  const k = r2.length - 1;
  near(r2[k].p - r0[k].p, 0.01, 1e-9, 'onchain bias shifts p additively');
}
// scorer: on-chain dual scoring (15-min Brier + 24h directional skill)
{
  const T = 1.76e9, N = 700;
  const records = [];
  for (let i = 0; i < N; i++) {
    const id = 'f' + i, ti = T + i * 300;
    records.push({ type: 'forecast', id, t_issue: ti, p: 0.5, m: [0.5, 0.5, 0.5, 0.5], c0: 1 + i * 0.0002, p_onchain: 0.52, onchain_bias: 0.01 });
    records.push({ type: 'resolution', id, y: 1 });
  }
  const sum = buildSummary({ records, config: { champion: { ...DEFAULT_CONFIG }, agent: {}, history: [], previous: null } });
  const oc = sum.windows.all.onchain;
  ok(oc && oc.n === N, 'onchain scored');
  ok(oc.brierOnchain < oc.brierBase, 'helpful bias improves 15-min Brier');
  ok(oc.skill24h.n === 415 && Math.abs(oc.skill24h.hitRate - 1) < 1e-12, `24h skill read perfect on uptrend (n=${oc.skill24h.n})`);
}
// --- Masha supervisor: deterministic verdicts from evidence (fixtures only, never displayed)
import { computeEvidence, decideVerdict, updateHypotheses, buildDisciplines, CHARTER_VERSION } from '../scripts/masha-supervisor.js';
import { runAgent, freshAgentState, proposeCandidates } from '../lib/agent.js';
const supNote = (z, net, noisy) => ({ computed: { z_btc_xrp: z, net, noisy } });
const supBoard = (memB, ensB, n) => ({ brier: ensB, members: { infoflow: memB, infoflow_n: n } });
{ // HOLD on thin history, no matter what
  const notes = Array.from({ length: 30 }, () => supNote(5, 0.02, false));
  const ev = computeEvidence(notes, supBoard(0.2, 0.25, 300));
  ok(decideVerdict(ev).verdict === 'HOLD', 'supervisor HOLD when n<50');
  // determinism: same inputs -> same verdict
  ok(decideVerdict(computeEvidence(notes, supBoard(0.2, 0.25, 300))).verdict === 'HOLD', 'supervisor deterministic');
}
{ // APPLY_CANDIDATE: persistent significance + real OOS edge + ordered regime
  const notes = Array.from({ length: 120 }, (_, i) => supNote(i < 80 ? 3.1 : 1.2, 0.01, false));
  const ev = computeEvidence(notes, supBoard(0.24, 0.25, 250));
  ok(ev.sig_frac > 0.6 && ev.oos_edge, 'evidence summary correct');
  ok(decideVerdict(ev).verdict === 'APPLY_CANDIDATE', 'supervisor APPLY_CANDIDATE on strong evidence');
}
{ // WITHDRAW: sustained absence of evidence
  const notes = Array.from({ length: 120 }, (_, i) => supNote(i < 10 ? 3.1 : 1.1, -0.005, false));
  const ev = computeEvidence(notes, supBoard(0.26, 0.25, 250));
  ok(decideVerdict(ev).verdict === 'WITHDRAW', 'supervisor WITHDRAW on dead evidence');
}
{ // HOLD in the middle: significance without OOS edge
  const notes = Array.from({ length: 120 }, (_, i) => supNote(i < 80 ? 3.1 : 1.2, 0.01, false));
  const ev = computeEvidence(notes, supBoard(0.26, 0.25, 250));
  ok(decideVerdict(ev).verdict === 'HOLD', 'supervisor HOLD without OOS edge');
}
{ // hypothesis ledger: statuses change only on evidence
  const thin = computeEvidence(Array.from({ length: 30 }, () => supNote(5, 0.02, false)), supBoard(0.2, 0.25, 50));
  const h1 = updateHypotheses(null, thin, '2026-10-08T00:00:00Z');
  ok(h1.length === 4 && h1.every((h) => h.status === 'open'), 'hypotheses seeded open on thin evidence');
  ok(h1.every((h) => h.claim && h.prediction && h.test), 'every hypothesis cites claim, prediction, test');
  const strong = computeEvidence(Array.from({ length: 120 }, () => supNote(3.1, 0.01, false)), supBoard(0.24, 0.25, 250));
  const h2 = updateHypotheses(h1, strong, '2026-10-08T00:00:00Z');
  ok(h2.find((h) => h.id === 'H1').status === 'supported', 'H1 supported on persistent significance');
  ok(h2.find((h) => h.id === 'H2').status === 'supported', 'H2 supported on OOS edge');
  const dead = computeEvidence(Array.from({ length: 120 }, () => supNote(1.1, -0.005, false)), supBoard(0.26, 0.25, 250));
  const h3 = updateHypotheses(h1, dead, '2026-10-08T00:00:00Z');
  ok(h3.find((h) => h.id === 'H1').status === 'refuted', 'H1 refuted on dead evidence');
  ok(h3.find((h) => h.id === 'H2').status === 'refuted', 'H2 refuted when member loses OOS');
}
{ // every discipline renders one honest line from the numbers
  const ev = computeEvidence(Array.from({ length: 120 }, (_, i) => supNote(i < 80 ? 3.1 : 1.2, 0.01, false)), supBoard(0.24, 0.25, 250));
  const d = buildDisciplines(ev, 'APPLY_CANDIDATE');
  ok(d.length === 11, 'eleven disciplines report');
  ok(d.every((x) => x.discipline && x.assessment && x.assessment.length > 20), 'each discipline has a substantive assessment');
  ok(new Set(d.map((x) => x.discipline)).size === 11, 'disciplines unique');
  ok(CHARTER_VERSION === '1.0.0', 'charter version stamped');
}
{ // agent gate: infoflowWeight is never *proposed* without APPLY_CANDIDATE
  const champ = { ...DEFAULT_CONFIG, infoflowWeight: 0, features: DEFAULT_CONFIG.features.slice() };
  const held = proposeCandidates(champ, mulberry32(42), 500);
  ok(held.every((c) => !c.desc.includes('infoflowWeight')), 'no infoflow proposals under HOLD');
  const wd = proposeCandidates(champ, mulberry32(42), 500, { mashaVerdict: 'WITHDRAW' });
  ok(wd.every((c) => !c.desc.includes('infoflowWeight')), 'no infoflow proposals under WITHDRAW');
  const ap = proposeCandidates(champ, mulberry32(42), 500, { mashaVerdict: 'APPLY_CANDIDATE' });
  ok(ap.some((c) => c.desc.includes('infoflowWeight')), 'infoflow proposals allowed under APPLY_CANDIDATE');
}
{ // agent: WITHDRAW steps an adopted weight back to 0 through the logged adoption path
  const mk = (w, verdict) => runAgent({ nowSec: 1790000000, resolved: [], bars: [],
    config: { champion: { ...DEFAULT_CONFIG, infoflowWeight: w }, previous: null, history: [], agent: freshAgentState() },
    mashaVerdict: verdict });
  const r1 = mk(0.1, 'WITHDRAW');
  ok(r1.config.champion.infoflowWeight === 0, 'WITHDRAW returns weight to 0');
  ok(r1.events.some((e) => e.type === 'masha-withdraw'), 'withdraw is logged as an event');
  const r2 = mk(0.1, 'HOLD');
  ok(r2.config.champion.infoflowWeight === 0.1, 'HOLD leaves an adopted weight alone');
  ok(!r2.events.some((e) => e.type === 'masha-withdraw'), 'no withdraw event under HOLD');
}

console.log(`selftest: ${passed} checks passed`);
