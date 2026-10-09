// Nora's crowd-activity signal — the network-health read from XRPL payment scans.
//
// The runner passes ctx.xrpl = {
//   recentTx: [{hash, t, from, to, xrp}]  (xrp in XRP, rolling 24h window),
//   netSeries: [{t, ledgerTx}]            (per-cycle validated-ledger tx counts)
// } collected from the existing XRPL scans. Nora keeps her own hourly history
// in <dir>/nora-state.json (v2 schema: buckets + seen-hash set, capped at
// 30 days).
//
// Four crowd metrics, each z-scored against its own 7-day baseline:
//   1. tracked-wallet 24h payment count   (deduped by tx hash — each payment
//      counted exactly once, no matter how many cycles it appears in)
//   2. tracked-wallet 24h unique counterparties
//   3. tracked-wallet 24h payment volume (XRP)
//   4. network-wide validated-ledger tx count (real whole-ledger data from
//      the runner's per-cycle ledger reads, bucketed by day)
// The mean z feeds a slow, bounded activity tilt: blooming crowd -> mild
// bullish tilt, wilting crowd -> mild bearish tilt. She is Wendy's
// complement: Wendy watches the whales, Nora watches everyone else.
//
// Hardening (2026-10-09): v1 buckets double-counted every payment (the
// rolling 24h recentTx window was re-folded each cycle) and mixed drops/XRP
// units, producing absurd values (activity_z ~1e13). v2 dedupes by hash,
// versions the state (old poisoned state is discarded, honestly warming up
// again), and clamps every z-score to +/-8 with a floored denominator so an
// absurd value can never be emitted again.
//
// Never throws: every failure degrades gracefully.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const STATE_VERSION = 2;
const TILT_SCALE = 0.012;       // tilt = TILT_SCALE * tanh(activityZ), clipped to ±TILT_CAP
const TILT_CAP = 0.015;
const STATE_DAYS = 30;          // hourly buckets kept
const MEDIAN_DAYS = 7;          // baseline window for the crowd medians
const WARMUP_HOURS = 72;        // < 3 days of history -> warmingUp (abstain)
const MAX_ADDRS_PER_BUCKET = 50000;
const Z_CLAMP = 8;              // no z-score may ever exceed this in magnitude
const SEEN_TTL_MS = 24 * 3600000; // tx hashes remembered for 24h (dedupe window)

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const toMs = (t) => (t < 1e12 ? t * 1000 : t); // tolerate seconds or ms
const hourOf = (ms) => Math.floor(ms / 3600000) * 3600000;
const dayOf = (ms) => Math.floor(ms / 86400000) * 86400000;

function loadState(statePath) {
  try {
    const raw = JSON.parse(readFileSync(statePath, 'utf8'));
    if (!raw || raw.v !== STATE_VERSION) return null; // stale schema -> start fresh, honestly
    const buckets = Array.isArray(raw.buckets) ? raw.buckets.filter((x) => x && Number.isFinite(x.hour)) : [];
    const seen = raw.seen && typeof raw.seen === 'object' ? raw.seen : {};
    return { buckets, seen };
  } catch {
    return null; // missing file = start fresh
  }
}

function saveState(statePath, buckets, seen) {
  try {
    writeFileSync(statePath, JSON.stringify({ v: STATE_VERSION, buckets, seen }) + '\n');
  } catch { /* best-effort: a failed save must never break the cycle */ }
}

function median(xs) {
  const s = xs.slice().sort((a, b) => a - b);
  const n = s.length;
  if (!n) return null;
  const mid = n >> 1;
  return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function std(xs) {
  const n = xs.length;
  if (n < 2) return 0;
  const m = xs.reduce((a, x) => a + x, 0) / n;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / n);
}

/**
 * Robust z-score. Never explodes: the denominator is floored and the result
 * is clamped to +/-Z_CLAMP, so a zero/near-zero baseline can never produce
 * 1e13-style absurdities again.
 */
function zOf(cur, days) {
  if (!Array.isArray(days) || days.length < 3) return 0; // no honest baseline yet
  const m = median(days);
  if (m == null || !Number.isFinite(cur)) return 0;
  const s = std(days);
  const denom = Math.max(s, Math.abs(m) * 0.25, 1);
  const z = (cur - m) / denom;
  if (!Number.isFinite(z)) return 0;
  return clamp(z, -Z_CLAMP, Z_CLAMP);
}

function degradedResult() {
  return {
    bias: 0, degraded: true, warmingUp: true,
    txCount24h: null, txCountMed7d: null, uniqueAddrs24h: null, volumeXrp24h: null,
    networkTxZ: 0, activityZ: 0,
  };
}

/** Pure core: compute the crowd metrics from hourly buckets + ledger series at nowMs. */
export function computeNoraSignal(buckets, netSeries, nowMs) {
  const byHour = new Map();
  for (const b of buckets) byHour.set(b.hour, b);

  // current 24h window totals (tracked wallets)
  let tx24 = 0, vol24 = 0;
  const addrs24 = new Set();
  // 7 prior complete 24h windows (ending at the current hour, not overlapping)
  const dayTx = [], dayAddrs = [], dayVol = [];
  const curHour = hourOf(nowMs);
  for (let d = 0; d < MEDIAN_DAYS; d++) {
    const end = curHour - d * 86400000;
    const start = end - 86400000;
    let tx = 0, vol = 0;
    const addrs = new Set();
    for (const [h, b] of byHour) {
      if (h <= start || h > end) continue;
      tx += b.txCount || 0;
      vol += b.volumeXrp || 0;
      for (const a of b.addrs || []) addrs.add(a);
    }
    if (d === 0) { tx24 = tx; vol24 = vol; for (const a of addrs) addrs24.add(a); }
    else { dayTx.push(tx); dayAddrs.push(addrs.size); dayVol.push(vol); }
  }

  // network-wide: validated-ledger tx counts bucketed by day; today's median
  // vs the medians of the prior 7 days.
  let networkTxZ = 0;
  const dayLedger = new Map(); // dayMs -> [ledgerTx samples]
  for (const p of netSeries || []) {
    const ms = Number.isFinite(p && p.t) ? toMs(p.t) : null;
    const v = p && Number.isFinite(p.ledgerTx) ? p.ledgerTx : null;
    if (ms == null || v == null || v < 0) continue;
    const d = dayOf(ms);
    if (!dayLedger.has(d)) dayLedger.set(d, []);
    dayLedger.get(d).push(v);
  }
  const curDay = dayOf(nowMs);
  const dayMeds = [];
  for (let d = 1; d <= MEDIAN_DAYS; d++) {
    const arr = dayLedger.get(curDay - d * 86400000);
    if (arr && arr.length) dayMeds.push(median(arr));
  }
  const curArr = dayLedger.get(curDay);
  if (curArr && curArr.length && dayMeds.length >= 3) {
    networkTxZ = zOf(median(curArr), dayMeds);
  }

  const medTx = median(dayTx);
  const zTx = zOf(tx24, dayTx);
  const zAddrs = zOf(addrs24.size, dayAddrs);
  const zVol = zOf(vol24, dayVol);
  const zs = [zTx, zAddrs, zVol, networkTxZ].filter(Number.isFinite);
  const activityZ = zs.length ? clamp(zs.reduce((a, x) => a + x, 0) / zs.length, -Z_CLAMP, Z_CLAMP) : 0;

  const distinctHours = byHour.size;
  const warmingUp = distinctHours < WARMUP_HOURS;
  return {
    txCount24h: tx24, txCountMed7d: medTx,
    uniqueAddrs24h: addrs24.size, volumeXrp24h: vol24,
    networkTxZ, activityZ, warmingUp,
  };
}

export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl }) {
  try {
    const nowMs = Number.isFinite(t) ? toMs(t) : Date.now();
    const statePath = path.join(dir || '.', 'nora-state.json');

    let st = loadState(statePath);
    let buckets = st ? st.buckets : [];
    let seen = st ? st.seen : {};
    const cutoff = hourOf(nowMs) - STATE_DAYS * 86400000;
    buckets = buckets.filter((b) => b.hour > cutoff);
    // expire old hashes
    for (const h of Object.keys(seen)) {
      if (!Number.isFinite(seen[h]) || nowMs - seen[h] > SEEN_TTL_MS) delete seen[h];
    }

    // fold the fresh scan into hourly buckets — each payment counted ONCE
    // (deduped by tx hash against everything seen in the last 24h)
    const txs = xrpl && Array.isArray(xrpl.recentTx) ? xrpl.recentTx : null;
    const hasFresh = !!txs && txs.length > 0;
    let folded = 0;
    if (hasFresh) {
      const byHour = new Map(buckets.map((b) => [b.hour, b]));
      for (const tx of txs) {
        if (!tx) continue;
        const key = tx.hash || `${tx.from}|${tx.to}|${tx.t}|${tx.xrp}`;
        if (seen[key]) continue; // already counted — the rolling window repeats payments
        const ms = Number.isFinite(tx.t) ? toMs(tx.t) : nowMs;
        if (nowMs - ms > SEEN_TTL_MS) continue; // too old to matter
        seen[key] = nowMs;
        const h = hourOf(ms);
        let b = byHour.get(h);
        if (!b) { b = { hour: h, txCount: 0, addrs: [], volumeXrp: 0 }; byHour.set(h, b); buckets.push(b); }
        b.txCount += 1;
        const v = Number(tx.xrp); // contract: XRP units (lib/xrpl.js divides drops by 1e6)
        if (Number.isFinite(v) && v >= 0 && v < 1e11) b.volumeXrp += v; // sanity: no single payment exceeds 100B XRP
        if (b.addrs.length < MAX_ADDRS_PER_BUCKET) {
          if (tx.from) b.addrs.push(tx.from);
          if (tx.to) b.addrs.push(tx.to);
        }
        folded++;
      }
      // dedupe addresses per bucket
      for (const b of buckets) {
        if (b.addrs.length) b.addrs = [...new Set(b.addrs.filter(Boolean))];
      }
      buckets = buckets.filter((b) => b.hour > cutoff).sort((a, b) => a.hour - b.hour);
      saveState(statePath, buckets, seen);
    }

    if (!hasFresh && buckets.length === 0) return degradedResult();

    const core = computeNoraSignal(buckets, xrpl && xrpl.netSeries, nowMs);
    const degraded = !hasFresh;
    const warmingUp = core.warmingUp;
    // During warmup there is no honest read — report a neutral z, never an
    // absurd one. The counts are still shown for transparency.
    const activityZ = warmingUp ? 0 : core.activityZ;
    const bias = (degraded || warmingUp)
      ? 0 // abstain honestly: no read, no tilt, no effect
      : clamp(TILT_SCALE * Math.tanh(activityZ), -TILT_CAP, TILT_CAP);

    return {
      bias,
      degraded,
      warmingUp,
      txCount24h: core.txCount24h,
      txCountMed7d: core.txCountMed7d,
      uniqueAddrs24h: core.uniqueAddrs24h,
      volumeXrp24h: core.volumeXrp24h,
      networkTxZ: core.networkTxZ,
      activityZ,
      foldedThisCycle: folded,
    };
  } catch {
    return degradedResult();
  }
}
