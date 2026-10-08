// On-chain exchange-flow monitor: a SLOW regime signal from XRP Ledger watchlist flows.
//
// Design (deliberately slow):
// - Net exchange flow = sum of balance deltas over the watchlist's exchange wallets.
//   Rising exchange balances = inflow = distribution/sell pressure building (bearish).
//   Falling balances = outflow = accumulation (bullish).
// - The signal does NOT vote on 15-min windows. It emits a persistent regime bias in
//   [-0.02, +0.02], EMA-smoothed so it "hangs in there" across many windows until the
//   flow regime actually changes.
// - Whale-alert style: a single Payment >= 10M XRP touching a watchlist wallet adds a
//   temporary pulse that decays linearly over 48h.
// - Balance history is our own: snapshots taken each runner cycle. Flows are "warming up"
//   until 24h of snapshots exist; the member abstains (bias 0) until then.

export const FLOW_REF_24H = 0.05;   // 5% of watchlist balance moving in 24h = full 24h component
export const FLOW_REF_7D = 0.10;    // 10% in 7d = full 7d component
export const W_24H = 0.012;         // max |bias| from the 24h flow component
export const W_7D = 0.008;          // max |bias| from the 7d flow component
export const BIAS_MAX = 0.02;       // slow bias range [-0.02, +0.02]
export const EMA_ALPHA = 0.15;       // smoothing: bias_ema = (1-a)*prev + a*raw (slow by intent)
export const WHALE_XRP = 10e6;      // whale-alert threshold: single payment >= 10M XRP
export const WHALE_DECAY_SEC = 48 * 3600;
export const WHALE_PULSE_MAX = 0.01;
export const WARMUP_SEC = 24 * 3600;

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

/** Nearest snapshot at or before (t - ageSec). Null when history is too short. */
function snapshotAt(snapshots, t, ageSec, tolSec = 6 * 3600) {
  const target = t - ageSec;
  let best = null;
  for (const s of snapshots) {
    if (s.t <= target && (!best || s.t > best.t)) best = s;
  }
  if (!best || target - best.t > tolSec) return null;
  return best;
}

const sumEx = (snap, exchangeAddrs) => exchangeAddrs.reduce((a, x) => a + (snap.balances[x] || 0), 0);

/**
 * Compute the slow on-chain bias. Pure.
 * snapshots: [{t, balances:{addr:xrp}}] ascending by t. exchangeAddrs: [addr].
 * prev: {ema} | null. pulses: [{t, tilt}] active whale pulses.
 */
export function computeOnchainSignal({ snapshots, exchangeAddrs, prev = null, pulses = [], nowSec }) {
  const cur = snapshots[snapshots.length - 1];
  if (!cur) return { bias: 0, ema: 0, warmingUp: true, reason: 'no snapshots' };
  const totalNow = sumEx(cur, exchangeAddrs);
  const s24 = snapshotAt(snapshots, nowSec, 24 * 3600);
  const s7 = snapshotAt(snapshots, nowSec, 7 * 86400);
  if (!s24 || totalNow <= 0) {
    return { bias: 0, ema: prev?.ema || 0, warmingUp: true, reason: 'warming up (<24h of flow history)' };
  }
  const net24 = totalNow - sumEx(s24, exchangeAddrs);
  const s7ok = s7 && sumEx(s7, exchangeAddrs) > 0;
  const net7 = s7ok ? totalNow - sumEx(s7, exchangeAddrs) : 0;
  const f24 = net24 / totalNow;
  const f7 = s7ok ? net7 / totalNow : 0;
  // inflow (positive f) => bearish => negative bias
  const raw = -(W_24H * clamp(f24 / FLOW_REF_24H, -1, 1) + W_7D * clamp(f7 / FLOW_REF_7D, -1, 1));
  const ema = clamp((1 - EMA_ALPHA) * (prev?.ema || 0) + EMA_ALPHA * raw, -BIAS_MAX, BIAS_MAX);
  let pulse = 0;
  const livePulses = [];
  for (const p of pulses) {
    const age = nowSec - p.t;
    if (age < 0 || age > WHALE_DECAY_SEC) continue;
    pulse += p.tilt * (1 - age / WHALE_DECAY_SEC);
    livePulses.push(p);
  }
  pulse = clamp(pulse, -WHALE_PULSE_MAX, WHALE_PULSE_MAX);
  const bias = clamp(ema + pulse, -0.03, 0.03);
  return {
    bias, ema, rawBias: raw, netFlow24h: net24, netFlow7d: net7, f24, f7,
    whalePulse: pulse, activePulses: livePulses.length, warmingUp: false, totalTracked: totalNow,
  };
}

/**
 * Whale-alert scan over recent payments. Pure.
 * payments: [{hash,t,from,to,xrp}]. watch: [{address,label,kind}].
 * seen: Set of already-reported hashes.
 * Returns new alerts [{hash,t,from,to,xrp,tilt,note}].
 */
export function detectWhaleTransfers(payments, watch, seen) {
  const byAddr = new Map(watch.map((w) => [w.address, w]));
  const exAddrs = new Set(watch.filter((w) => w.kind === 'exchange').map((w) => w.address));
  const out = [];
  for (const p of payments || []) {
    if (p.xrp < WHALE_XRP || seen.has(p.hash)) continue;
    const fW = byAddr.get(p.from), tW = byAddr.get(p.to);
    if (!fW && !tW) continue;
    seen.add(p.hash);
    let tilt = 0, note = '';
    const toEx = exAddrs.has(p.to), fromEx = exAddrs.has(p.from);
    if (toEx && !fromEx) { tilt = -WHALE_PULSE_MAX; note = 'large inflow to exchange (distribution-like)'; }
    else if (fromEx && !toEx) { tilt = WHALE_PULSE_MAX; note = 'large outflow from exchange (accumulation-like)'; }
    else if (fW?.kind === 'whale' && !tW) { tilt = -WHALE_PULSE_MAX / 2; note = 'tracked whale distributing'; }
    else if (tW?.kind === 'whale' && !fW) { tilt = WHALE_PULSE_MAX / 2; note = 'tracked whale accumulating'; }
    else { note = 'large internal reshuffle (no directional read)'; }
    out.push({
      hash: p.hash, t: p.t, from: p.from, to: p.to, xrp: p.xrp, tilt,
      fromLabel: fW?.label || null, toLabel: tW?.label || null, note,
    });
  }
  return out;
}
