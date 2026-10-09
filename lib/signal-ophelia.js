// Ophelia's flow-health signal — the broad on-chain read from XRPL
// exchange-wallet balance snapshots.
//
// The runner passes ctx.xrpl.ocSnapshots = the last ~200 balance snapshots,
// [{t, balances:{addr:xrp}}] ascending by t. Ophelia measures aggregate
// capital movement across ALL tracked exchange wallets — not individual
// whales (that is Wendy's beat) and not crowd payment activity (that is
// Nora's beat):
//   per-wallet 24h net flow  = latest balance - snapshot nearest (t - 24h)
//   totalNetFlow             = sum of per-wallet 24h net flows
//   totalBalance             = sum of latest balances
//   flowVelocity             = |totalNetFlow| / totalBalance (how fast the
//                             tracked set is turning over)
//   breadth                  = fraction of wallets whose 24h flow has the
//                             same sign as the aggregate (how many agree)
//   bias                     = scaled tilt from the aggregate drift:
//                             exchange INFLOW (balances building) is
//                             distribution pressure -> bearish (negative
//                             bias); exchange OUTFLOW (balances draining)
//                             is accumulation -> bullish (positive bias).
//
// Flow health is a SLOW regime signal — it speaks in days, not candles.
// Ophelia keeps her own history of per-cycle reads in
// <dir>/ophelia-state.json (capped at 30 days) and honestly abstains until
// 72 hours of snapshot history are available.
//
// Never throws: every failure degrades gracefully.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BIAS_SCALE = 0.02;       // bias = driftDirection * velocity * SCALE, clipped
const BIAS_CAP = 0.015;        // |bias| never exceeds this
const STATE_DAYS = 30;         // history of per-cycle reads kept
const WARMUP_MS = 72 * 3600000; // < 3 days of snapshot history -> warmingUp (abstain)
const REF_TOL_MS = 6 * 3600000; // 24h reference snapshot must be within 6h of target
const DAY_MS = 24 * 3600000;

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const toMs = (t) => (t < 1e12 ? t * 1000 : t); // tolerate seconds or ms
const isMs = (t) => Number.isFinite(t);

/** Nearest snapshot to the reference time (t - 24h), within tolerance. */
function referenceSnapshot(snapshots, targetMs) {
  let best = null, bestDist = Infinity;
  for (const s of snapshots) {
    const st = isMs(s && s.t) ? toMs(s.t) : null;
    if (st == null) continue;
    const d = Math.abs(st - targetMs);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return bestDist <= REF_TOL_MS ? best : null;
}

function loadReads(statePath) {
  try {
    const raw = JSON.parse(readFileSync(statePath, 'utf8'));
    const r = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.reads) ? raw.reads : []);
    return r.filter((x) => x && isMs(x.t));
  } catch {
    return []; // missing file = start fresh
  }
}

function saveReads(statePath, reads) {
  try {
    writeFileSync(statePath, JSON.stringify({ reads }) + '\n');
  } catch { /* best-effort: a failed save must never break the cycle */ }
}

/** Pure core: compute the flow-health read from balance snapshots. */
export function computeOpheliaSignal(snapshots, nowMs) {
  const snaps = (Array.isArray(snapshots) ? snapshots : [])
    .filter((s) => s && isMs(s.t) && s.balances && typeof s.balances === 'object')
    .sort((a, b) => toMs(a.t) - toMs(b.t));
  if (snaps.length < 2) {
    return { ok: false, warmingUp: false, reason: 'no usable balance snapshots' };
  }
  const latest = snaps[snaps.length - 1];
  const now = isMs(nowMs) ? toMs(nowMs) : toMs(latest.t);
  const historySpan = toMs(latest.t) - toMs(snaps[0].t);
  const ref = referenceSnapshot(snaps, now - DAY_MS);
  // Partial-window mode (2026-10-09): if the 24h reference is missing but we
  // have at least 2 snapshots spanning >= 1h, measure over the AVAILABLE
  // window and say so honestly. Real numbers, clearly labeled partial —
  // still warmingUp, still no tilt, but the page shows data actually flowing
  // instead of "I saw nothing".
  const partial = !ref && historySpan >= 3600000;
  const refSnap = ref || (partial ? snaps[0] : null);
  if (!refSnap) {
    return { ok: false, warmingUp: false, reason: 'no snapshot near t-24h — cannot form a 24h flow window' };
  }
  const windowH = (toMs(latest.t) - toMs(refSnap.t)) / 3600000;

  // per-wallet net flows over the tracked set (union of addresses seen)
  const addrs = new Set([...Object.keys(latest.balances || {}), ...Object.keys(refSnap.balances || {})]);
  const flows = [];
  let totalBalance = 0, totalNetFlow = 0;
  for (const addr of addrs) {
    const bNow = Number(latest.balances[addr]);
    const bRef = Number(refSnap.balances[addr]);
    if (!Number.isFinite(bNow)) continue; // address vanished from tracking: exclude, don't guess
    totalBalance += Math.max(0, bNow);
    const net = bNow - (Number.isFinite(bRef) ? bRef : bNow);
    flows.push({ addr, net });
    totalNetFlow += net;
  }
  if (totalBalance <= 0 || flows.length === 0) {
    return { ok: false, warmingUp: false, reason: 'tracked set empty — no balances to measure' };
  }

  const aggSign = Math.sign(totalNetFlow);
  const withAgg = aggSign === 0 ? 0 : flows.filter((f) => Math.sign(f.net) === aggSign).length;
  const breadth = aggSign === 0 ? 0 : withAgg / flows.length; // no dominant direction -> no breadth read
  const flowVelocity = Math.abs(totalNetFlow) / totalBalance;

  // inflow (positive aggregate net flow) = coins moving toward venues where
  // they can be sold -> bearish -> negative bias. outflow -> bullish.
  // In partial mode the window is too short for a tilt: report the read, abstain.
  const driftDirection = totalNetFlow > 0 ? -1 : totalNetFlow < 0 ? 1 : 0;
  const bias = partial ? 0 : clamp(driftDirection * flowVelocity * BIAS_SCALE, -BIAS_CAP, BIAS_CAP);

  return {
    ok: true,
    warmingUp: partial || historySpan < WARMUP_MS,
    partial,
    windowH,
    totalNetFlow,
    totalBalance,
    flowVelocity,
    breadth,
    bias,
    wallets: flows.length,
    snapshotSpanH: historySpan / 3600000,
  };
}

export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl }) {
  try {
    const statePath = path.join(dir || '.', 'ophelia-state.json');
    let reads = loadReads(statePath);
    const nowMs = Date.now();

    const snaps = xrpl && Array.isArray(xrpl.ocSnapshots) ? xrpl.ocSnapshots : null;
    if (!snaps || snaps.length === 0) {
      return { bias: 0, degraded: true, warmingUp: false };
    }

    const core = computeOpheliaSignal(snaps, isMs(t) ? toMs(t) : nowMs);
    if (!core.ok) {
      return { bias: 0, degraded: true, warmingUp: false, reason: core.reason };
    }
    if (core.warmingUp) {
      return {
        bias: 0, degraded: false, warmingUp: true,
        flowVelocity: core.flowVelocity, breadth: core.breadth,
        totalNetFlow: core.totalNetFlow, wallets: core.wallets,
        partial: !!core.partial, windowH: core.windowH || null,
        snapshotSpanH: core.snapshotSpanH,
        reason: core.partial
          ? `partial ${core.windowH.toFixed(1)}h flow window — real numbers, still building toward the 72h standard`
          : `only ${core.snapshotSpanH.toFixed(1)}h of snapshot history — abstaining until 72h`,
      };
    }

    // record this cycle's read (hourly granularity is plenty for a slow regime signal)
    const cutoff = nowMs - STATE_DAYS * DAY_MS;
    reads = reads.filter((r) => r.t > cutoff);
    const last = reads[reads.length - 1];
    if (!last || nowMs - last.t >= 3600000) {
      reads.push({
        t: nowMs,
        totalNetFlow: core.totalNetFlow,
        totalBalance: core.totalBalance,
        flowVelocity: core.flowVelocity,
        breadth: core.breadth,
        bias: core.bias,
        wallets: core.wallets,
      });
      saveReads(statePath, reads);
    }

    return {
      bias: core.bias,
      degraded: false,
      warmingUp: false,
      partial: false,
      windowH: 24,
      flowVelocity: core.flowVelocity,
      breadth: core.breadth,
      totalNetFlow: core.totalNetFlow,
      wallets: core.wallets,
      readings30d: reads.length,
    };
  } catch {
    return { bias: 0, degraded: true, warmingUp: false };
  }
}
