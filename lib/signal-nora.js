// Nora's crowd-activity signal — the network-health read from XRPL payment scans.
//
// The runner passes ctx.xrpl = { recentTx: [{t, from, to, xrp}], txCount }
// collected from the existing XRPL scans. Nora keeps her own hourly history
// in <dir>/nora-state.json (buckets: {hour, txCount, addrs[], volumeXrp},
// capped at 30 days). Three crowd metrics — 24h payment count, unique
// counterparties, payment volume — are z-scored against their 7-day medians;
// the mean z feeds a slow, bounded activity tilt: blooming crowd -> mild
// bullish tilt, wilting crowd -> mild bearish tilt. She is Wendy's
// complement: Wendy watches the whales, Nora watches everyone else.
//
// Never throws: every failure degrades gracefully.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TILT_SCALE = 0.012;       // tilt = TILT_SCALE * tanh(activityZ), clipped to ±TILT_CAP
const TILT_CAP = 0.015;
const STATE_DAYS = 30;          // hourly buckets kept
const MEDIAN_DAYS = 7;          // baseline window for the crowd medians
const WARMUP_HOURS = 72;        // < 3 days of history -> warmingUp (abstain)
const MAX_ADDRS_PER_BUCKET = 50000;

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const toMs = (t) => (t < 1e12 ? t * 1000 : t); // tolerate seconds or ms
const hourOf = (ms) => Math.floor(ms / 3600000) * 3600000;

function loadBuckets(statePath) {
  try {
    const raw = JSON.parse(readFileSync(statePath, 'utf8'));
    const b = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.buckets) ? raw.buckets : []);
    return b.filter((x) => x && Number.isFinite(x.hour));
  } catch {
    return []; // missing file = start fresh
  }
}

function saveBuckets(statePath, buckets) {
  try {
    writeFileSync(statePath, JSON.stringify({ buckets }) + '\n');
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

function degradedResult() {
  return {
    bias: 0, degraded: true, warmingUp: true,
    txCount24h: null, txCountMed7d: null, uniqueAddrs24h: null, volumeXrp24h: null,
    activityZ: 0,
  };
}

/** Pure core: compute the crowd metrics from hourly buckets at time nowMs. */
export function computeNoraSignal(buckets, nowMs) {
  const byHour = new Map();
  for (const b of buckets) byHour.set(b.hour, b);

  // current 24h window totals
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

  const medTx = median(dayTx), medAddrs = median(dayAddrs), medVol = median(dayVol);
  const zOf = (cur, days) => {
    if (days.length < 3) return 0; // no honest baseline yet
    const m = median(days), s = std(days);
    if (m == null) return 0;
    if (s > 0) return (cur - m) / s;
    // flat baseline: fall back to relative deviation so a genuine move still registers
    const base = Math.abs(m) > 0 ? Math.abs(m) : 1;
    return (cur - m) / base;
  };
  const zTx = zOf(tx24, dayTx);
  const zAddrs = zOf(addrs24.size, dayAddrs);
  const zVol = zOf(vol24, dayVol);
  const activityZ = (zTx + zAddrs + zVol) / 3;

  const distinctHours = byHour.size;
  const warmingUp = distinctHours < WARMUP_HOURS;
  return {
    txCount24h: tx24, txCountMed7d: medTx,
    uniqueAddrs24h: addrs24.size, volumeXrp24h: vol24,
    activityZ, warmingUp,
  };
}

export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl }) {
  try {
    const nowMs = Number.isFinite(t) ? toMs(t) : Date.now();
    const statePath = path.join(dir || '.', 'nora-state.json');

    let buckets = loadBuckets(statePath);
    const cutoff = hourOf(nowMs) - STATE_DAYS * 86400000;
    buckets = buckets.filter((b) => b.hour > cutoff);

    // fold the fresh scan into hourly buckets
    const txs = xrpl && Array.isArray(xrpl.recentTx) ? xrpl.recentTx : null;
    const hasFresh = !!txs && txs.length > 0;
    if (hasFresh) {
      const byHour = new Map(buckets.map((b) => [b.hour, b]));
      for (const tx of txs) {
        if (!tx) continue;
        const ms = Number.isFinite(tx.t) ? toMs(tx.t) : nowMs;
        const h = hourOf(ms);
        let b = byHour.get(h);
        if (!b) { b = { hour: h, txCount: 0, addrs: [], volumeXrp: 0 }; byHour.set(h, b); buckets.push(b); }
        b.txCount += 1;
        const v = Number(tx.xrp);
        if (Number.isFinite(v) && v >= 0) b.volumeXrp += v;
        if (b.addrs.length < MAX_ADDRS_PER_BUCKET) {
          b.addrs.push(tx.from, tx.to);
        }
      }
      // dedupe addresses per bucket
      for (const b of buckets) {
        if (b.addrs.length) b.addrs = [...new Set(b.addrs.filter(Boolean))];
      }
      buckets = buckets.filter((b) => b.hour > cutoff).sort((a, b) => a.hour - b.hour);
      saveBuckets(statePath, buckets);
    }

    if (!hasFresh && buckets.length === 0) return degradedResult();

    const core = computeNoraSignal(buckets, nowMs);
    const degraded = !hasFresh;
    const warmingUp = core.warmingUp;
    const bias = (degraded || warmingUp)
      ? 0 // abstain honestly: no read, no tilt, no effect
      : clamp(TILT_SCALE * Math.tanh(core.activityZ), -TILT_CAP, TILT_CAP);

    return {
      bias,
      degraded,
      warmingUp,
      txCount24h: core.txCount24h,
      txCountMed7d: core.txCountMed7d,
      uniqueAddrs24h: core.uniqueAddrs24h,
      volumeXrp24h: core.volumeXrp24h,
      activityZ: core.activityZ,
    };
  } catch {
    return degradedResult();
  }
}
