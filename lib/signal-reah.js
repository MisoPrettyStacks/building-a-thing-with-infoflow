// Reah's signal: the mean-reversion fade.
//
// Pure from the lab's own XRP candles — no external fetch. Looks at the
// most recent closed 5-minute bars and fades the move: after XRP runs up,
// she leans down; after it drops, she leans up. The fade strengthens after
// high-volume (aggressive) bars, because compensated liquidity provision
// is what makes short-horizon reversal real.
//
// Best-effort: this function NEVER throws. Any bad input returns a
// degraded or warming-up state with bias 0.

const MIN_BARS = 12;        // minimum closed bars before she will speak
const VOL_WINDOW = 24;      // bars for the median-volume baseline
const GAIN_R1 = 6;          // fade weight on the last bar's log return
const GAIN_R3 = 2;          // fade weight on the mean of the last 3 returns
const AGGRESSIVE_MULT = 1.25; // extra fade after a high-volume bar
const BIAS_CAP = 0.02;      // absolute cap on the emitted bias

function logReturn(a, b) {
  if (!(a > 0) || !(b > 0) || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.log(a / b);
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function clip(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl }) {
  const warming = () => ({
    bias: 0, degraded: false, warmingUp: true, lastRetBps: null, volRatio: null, fading: false,
  });
  try {
    const xs = Array.isArray(bars) ? bars : [];

    // Clean bars: finite positive closes, deduped by timestamp, sorted.
    const byT = new Map();
    for (const b of xs) {
      if (b == null || !Number.isFinite(b.t) || !Number.isFinite(b.c) || b.c <= 0) continue;
      byT.set(b.t, b);
    }
    const clean = [...byT.values()].sort((a, b) => a.t - b.t);

    if (clean.length < MIN_BARS) {
      return warming();
    }

    const closes = clean.map((b) => b.c);
    const n = closes.length;

    // r1: log return of the last closed bar. r3: mean of the last 3.
    const r1 = logReturn(closes[n - 1], closes[n - 2]);
    const rets = [];
    for (let i = n - 3; i < n; i++) {
      const r = logReturn(closes[i], closes[i - 1]);
      if (r == null) return { bias: 0, degraded: true, warmingUp: false, lastRetBps: null, volRatio: null, fading: false };
      rets.push(r);
    }
    if (r1 == null || rets.length < 3) {
      return { bias: 0, degraded: true, warmingUp: false, lastRetBps: null, volRatio: null, fading: false };
    }
    const r3 = rets.reduce((a, b) => a + b, 0) / rets.length;

    // Flow-intensity proxy: last bar volume vs median of the last 24 bars.
    const volWin = clean.slice(-VOL_WINDOW).map((b) => b.v);
    const lastVol = clean[n - 1].v;
    let volRatio = null;
    if (Number.isFinite(lastVol) && volWin.every((v) => Number.isFinite(v))) {
      const med = median(volWin);
      if (med != null && med > 0) volRatio = lastVol / med;
    }

    const aggressive = volRatio != null && volRatio >= 1;
    const mult = aggressive ? AGGRESSIVE_MULT : 1;
    let bias = clip(-(r1 * GAIN_R1 + r3 * GAIN_R3) * mult, -BIAS_CAP, BIAS_CAP);
    if (!Number.isFinite(bias)) bias = 0;

    return {
      bias,
      degraded: false,
      warmingUp: false,
      lastRetBps: r1 * 1e4,
      volRatio,
      fading: Math.abs(bias) >= 0.004,
    };
  } catch {
    // Best-effort contract: never throw.
    return { bias: 0, degraded: true, warmingUp: false, lastRetBps: null, volRatio: null, fading: false };
  }
}
