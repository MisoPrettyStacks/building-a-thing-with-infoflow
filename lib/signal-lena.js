// Lena's signal: the cross-venue lead-lag bias.
//
// Watches Binance XRP against the lab's own Coinbase XRP 5-minute bars.
// Binance is usually the fastest XRP venue; when Binance trades ahead of
// Coinbase, the gap between the two closes and Binance's most recent drift
// (relative to Coinbase's) may still be propagating to Coinbase over the
// next bars. Lena measures exactly that: a level gap plus a short-window
// lead return, combined into one small, capped bias. When Binance is
// unreachable, or the two series cannot be aligned honestly, she abstains
// (bias 0) rather than guessing.
//
// Best-effort: this function NEVER throws. Any failure returns a degraded
// or warming-up state with bias 0.

// data-api.binance.vision is Binance's public market-data host (no account,
// no geo block — api.binance.com returns 451 from US IPs, incl. CI runners).
const BINANCE_KLINES = 'https://data-api.binance.vision/api/v3/klines?symbol=XRPUSDT&interval=5m&limit=60';
const BINANCE_KLINES_FALLBACK = 'https://api.binance.com/api/v3/klines?symbol=XRPUSDT&interval=5m&limit=60';
const ALIGNED_MIN = 24;    // >= 24 aligned 5-min pairs (2h) before the read means anything
const LEAD_WINDOW = 3;     // lead return over the last 3 aligned bars (15 min)
const GAP_GAIN = 0.4;      // level-gap contribution: gapBps/1e4 * GAP_GAIN
const LEAD_GAIN = 2.5;     // lead-return contribution: leadRet * LEAD_GAIN
const BIAS_CAP = 0.02;     // absolute cap on the emitted bias

const clip = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function num(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

function logReturn(a, b) {
  if (!(a > 0) || !(b > 0) || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.log(a / b);
}

export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl }) {
  const degraded = (extra = {}) => ({
    bias: 0, degraded: true, warmingUp: false, gapBps: null, leadRetBps: null, aligned: 0, ...extra,
  });
  try {
    const xs = Array.isArray(bars) ? bars : [];
    if (!xs.length) return degraded();

    // 1) Coinbase closes keyed on bar timestamp (seconds, bucket start).
    const cbByT = new Map();
    for (const b of xs) {
      if (b == null || !Number.isFinite(b.t) || !Number.isFinite(b.c) || b.c <= 0) continue;
      cbByT.set(b.t, b.c);
    }
    if (!cbByT.size) return degraded();

    // 2) Fetch Binance 5-min klines. getJson throws on failure — degrade.
    const fetchJson = typeof getJson === 'function' ? getJson : null;
    if (!fetchJson) return degraded();
    let klines = null;
    try { klines = await fetchJson(BINANCE_KLINES); } catch { klines = null; }
    if (!Array.isArray(klines) || !klines.length) {
      try { klines = await fetchJson(BINANCE_KLINES_FALLBACK); } catch { klines = null; }
    }
    if (!Array.isArray(klines) || !klines.length) return degraded();

    // 3) Parse Binance klines: [openTimeMs, open, high, low, close, ...].
    //    The kline whose open time is bar t closes at t + 5 min, so its close
    //    is Binance's price at the end of the bar starting at t.
    const bnByT = new Map();
    for (const k of klines) {
      if (!Array.isArray(k) || k.length < 5) continue;
      const openMs = num(k[0]);
      const close = num(k[4]);
      if (openMs == null || close == null || close <= 0) continue;
      bnByT.set(Math.floor(openMs / 1000), close);
    }
    if (!bnByT.size) return degraded();

    // 4) Align: pairs in Coinbase bar order, deduped, matched by timestamp.
    const pairs = [];
    const seen = new Set();
    for (const b of xs) {
      if (b == null || !Number.isFinite(b.t) || !Number.isFinite(b.c) || b.c <= 0) continue;
      if (seen.has(b.t)) continue;
      seen.add(b.t);
      const bn = bnByT.get(b.t);
      if (bn != null) pairs.push({ t: b.t, cb: b.c, bn });
    }

    if (pairs.length < ALIGNED_MIN) {
      return { bias: 0, degraded: false, warmingUp: true, gapBps: null, leadRetBps: null, aligned: pairs.length };
    }

    // 5) Level gap: is Binance trading ahead of (above) Coinbase right now?
    const last = pairs[pairs.length - 1];
    const gapBps = (last.bn / last.cb - 1) * 1e4;

    // 6) Lead return: Binance's drift minus Coinbase's drift over the last
    //    few aligned bars — the part of Binance's move Coinbase hasn't shown.
    const tail = pairs.slice(-(LEAD_WINDOW + 1));
    const bnRet = logReturn(tail[tail.length - 1].bn, tail[0].bn);
    const cbRet = logReturn(tail[tail.length - 1].cb, tail[0].cb);
    if (bnRet == null || cbRet == null || !Number.isFinite(gapBps)) {
      return { bias: 0, degraded: false, warmingUp: true, gapBps: null, leadRetBps: null, aligned: pairs.length };
    }
    const leadRet = bnRet - cbRet;

    let bias = gapBps / 10000 * GAP_GAIN + leadRet * LEAD_GAIN;
    bias = clip(bias, -BIAS_CAP, BIAS_CAP);
    if (!Number.isFinite(bias)) bias = 0;

    return {
      bias,
      degraded: false,
      warmingUp: false,
      gapBps,
      leadRetBps: leadRet * 1e4,
      aligned: pairs.length,
    };
  } catch {
    // Best-effort contract: never throw.
    return degraded();
  }
}
