// Volatility regime signal: a confidence DAMPENER, never a directional vote.
//
// Pure: realized volatility is measured from the lab's own closed candles,
// compared against its own rolling history, and classified into a regime:
//   calm   — current vol well below its recent baseline
//   normal — vol near its baseline
//   wild   — current vol well above its recent baseline
// When the regime is wild the signal goes ACTIVE and nominates the volDamp
// dampener: the forecast shrinks toward 0.5 (less confidence), never a tilt
// toward up or down. bias is always 0 by design.
//
// Never throws: any bad input yields a degraded/warming-up abstention.

export const VOL_LOOKBACK = 288;    // bars in the current vol window (~24h of 5-min bars)
export const VOL_MIN_HISTORY = 864; // bars needed for an honest baseline (~3 days)
export const WILD_MULT = 1.8;       // current vol above this x baseline => wild
export const CALM_MULT = 0.6;       // current vol below this x baseline => calm

function stdev(xs) {
  const n = xs.length;
  if (n < 2) return null;
  let m = 0;
  for (const x of xs) m += x;
  m /= n;
  let v = 0;
  for (const x of xs) { const d = x - m; v += d * d; }
  return Math.sqrt(v / (n - 1));
}

function median(xs) {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Pure: realized vol + regime from closed candle closes. */
export function computeVolatility({ bars }) {
  try {
    const closes = (Array.isArray(bars) ? bars : [])
      .map((b) => b && b.c)
      .filter((x) => Number.isFinite(x) && x > 0);
    const n = closes.length;
    const blind = { volNow: null, volMedian: null, regime: 'unknown', warmingUp: true };
    if (n < 2) return blind;

    // log returns over the current window (up to VOL_LOOKBACK bars of returns)
    const curN = Math.min(n, VOL_LOOKBACK);
    const curRets = [];
    for (let i = n - curN; i < n - 1; i++) {
      curRets.push(Math.log(closes[i + 1] / closes[i]));
    }
    const curSd = stdev(curRets);
    if (curSd == null) return blind;
    const volNow = curSd * Math.sqrt(288); // annualized-ish scale; reported as-is

    // baseline: median of rolling VOL_LOOKBACK-bar vol over available history
    const hist = n >= VOL_MIN_HISTORY;
    let volMedian = null;
    if (hist) {
      const vols = [];
      for (let end = VOL_LOOKBACK + 1; end <= n; end += 1) {
        const rets = [];
        for (let i = end - VOL_LOOKBACK; i < end; i++) {
          rets.push(Math.log(closes[i] / closes[i - 1]));
        }
        const sd = stdev(rets);
        if (sd != null) vols.push(sd * Math.sqrt(288));
      }
      volMedian = median(vols);
    }
    if (!hist || volMedian == null || volMedian <= 0) {
      return { ...blind, volNow, warmingUp: true };
    }
    const ratio = volNow / volMedian;
    const regime = ratio > WILD_MULT ? 'wild' : ratio < CALM_MULT ? 'calm' : 'normal';
    return {
      volNow,
      volMedian,
      regime,
      warmingUp: false,
      active: regime === 'wild',
    };
  } catch {
    return { volNow: null, volMedian: null, regime: 'unknown', warmingUp: true, active: false };
  }
}

export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl }) {
  try {
    const r = computeVolatility({ bars });
    return {
      active: !!r.active,
      bias: 0, // by design: the dampener never tilts direction
      degraded: false,
      warmingUp: !!r.warmingUp,
      regime: r.regime,
      volNow: r.volNow,
      volMedian: r.volMedian,
    };
  } catch {
    return {
      active: false,
      bias: 0,
      degraded: false,
      warmingUp: true,
      regime: 'unknown',
      volNow: null,
      volMedian: null,
    };
  }
}
