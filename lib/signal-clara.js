// Clara's signal: the quarter-hour boundary read.
//
// Pure from the lab's own XRP 5-minute candles — no external fetch. Forex and
// crypto markets show periodic algorithmic bursts on the clock grid
// (:00/:15/:30/:45); the hypothesis under test is that returns around those
// boundary bars carry predictable structure. Clara reads the most recent
// boundary bar (log return, volume burst vs the non-boundary norm, and sign
// persistence across the last four boundary bars) and converts it into a small
// conditional bias. Off-boundary evidence licenses nothing on its own: a weak
// burst or scattered signs scale the read down, never up.
//
// Best-effort: this function NEVER throws. Any bad input returns a
// degraded or warming-up state with bias 0.

const MIN_BARS = 48;          // 4h of 5-minute bars before any read is honest
const MIN_BOUNDARY_BARS = 12; // 12 boundary bars (~3h of clock grid) minimum
const NONBOUNDARY_MEDIAN = 12; // non-boundary bars for the volume baseline
const PERSIST_WINDOW = 4;      // boundary bars examined for sign persistence
const BURST_MIN = 1.2;         // volume-burst ratio that counts as a burst
const RET_GAIN = 5;            // bias scales with 5x the boundary-bar log return
const BIAS_CAP = 0.02;         // absolute cap on the emitted bias

/** Boundary bars start at minute-of-hour 0, 15, 30 or 45. */
function isBoundaryBar(t) {
  return ((t / 60) % 15) === 0;
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl }) {
  const warming = (phaseMin) => ({
    bias: 0, degraded: false, warmingUp: true, boundaryRetBps: null, burst: null, persistence: null, phaseMin,
  });
  try {
    const xs = Array.isArray(bars) ? bars : [];

    // 1) Clean + order the XRP bars; dedupe timestamps, keep last.
    const byT = new Map();
    for (const b of xs) {
      if (b == null || !Number.isFinite(b.t) || !Number.isFinite(b.c) || b.c <= 0) continue;
      byT.set(b.t, b);
    }
    const clean = [...byT.values()].sort((a, b) => a.t - b.t);
    const lastT = clean.length ? clean[clean.length - 1].t : (Number.isFinite(t) ? t : null);
    const phaseMin = lastT != null ? ((lastT / 60) % 15) : null;

    const boundaryIdx = [];
    for (let i = 0; i < clean.length; i++) if (isBoundaryBar(clean[i].t)) boundaryIdx.push(i);
    if (clean.length < MIN_BARS || boundaryIdx.length < MIN_BOUNDARY_BARS) {
      return { ...warming(phaseMin), barCount: clean.length, boundaryCount: boundaryIdx.length };
    }

    // 2) The most recent boundary bar and its log return vs the previous bar.
    const bi = boundaryIdx[boundaryIdx.length - 1];
    const bBar = clean[bi];
    const prev = clean[bi - 1];
    if (!prev || !(prev.c > 0)) return { ...warming(phaseMin), barCount: clean.length, boundaryCount: boundaryIdx.length };
    const bRet = Math.log(bBar.c / prev.c);
    if (!Number.isFinite(bRet)) return { ...warming(phaseMin), barCount: clean.length, boundaryCount: boundaryIdx.length };

    // 3) Volume burst: this boundary bar's volume vs the recent non-boundary norm.
    const nonBoundaryVols = clean.filter((b) => !isBoundaryBar(b.t)).slice(-NONBOUNDARY_MEDIAN)
      .map((b) => b.v).filter((v) => Number.isFinite(v) && v >= 0);
    const med = median(nonBoundaryVols);
    const burst = med != null && med > 0 && Number.isFinite(bBar.v) ? bBar.v / med : null;

    // 4) Sign persistence: how many of the last 4 boundary bars moved the same way.
    const signs = [];
    for (const idx of boundaryIdx.slice(-PERSIST_WINDOW)) {
      const p = clean[idx - 1];
      if (!p || !(p.c > 0)) continue;
      const r = Math.log(clean[idx].c / p.c);
      if (Number.isFinite(r)) signs.push(Math.sign(r));
    }
    const s0 = Math.sign(bRet);
    const persistence = signs.length
      ? signs.filter((s) => s !== 0 && s === s0).length / signs.length
      : null;

    // 5) The read: direction of the boundary bar, scaled by its size, the
    //    burst, and how consistently boundary bars have been agreeing.
    let mag = Math.min(BIAS_CAP, Math.abs(bRet) * RET_GAIN);
    let bias = s0 * mag * (burst != null && burst >= BURST_MIN ? 1 : 0.5);
    if (persistence != null && persistence < 0.5) bias *= 0.5;
    bias = Math.max(-BIAS_CAP, Math.min(BIAS_CAP, bias));
    if (!Number.isFinite(bias)) bias = 0;

    return {
      bias,
      degraded: false,
      warmingUp: false,
      boundaryRetBps: bRet * 10000,
      burst,
      persistence,
      phaseMin: ((bBar.t / 60) % 15),
      barCount: clean.length,
      boundaryCount: boundaryIdx.length,
    };
  } catch {
    // Best-effort contract: never throw.
    return { bias: 0, degraded: true, warmingUp: false, boundaryRetBps: null, burst: null, persistence: null, phaseMin: null };
  }
}
