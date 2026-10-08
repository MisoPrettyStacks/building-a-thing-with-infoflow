// Cora's cross-asset momentum member — real public candles, never throws.
//
// Every cycle: recent 5-minute ETH-USD + SOL-USD candles from the public
// Coinbase exchange API (no keys). Per asset: momentum is the mean log-return
// over the trailing hour, z-scored against the asset's own trailing-day
// volatility, so ETH and SOL speak in comparable units. The two z-scores are
// blended into a small bounded cross-asset tilt: positive = broad crypto
// momentum is up (spillover tailwind), negative = broad momentum is down.
//
// Masha measures information flow; Cora measures price flow.
//
// Best-effort by design: any failure (network, bad payload, thin history)
// returns a degraded state — this function NEVER throws, so the runner can
// always continue.

import { getJson } from '../lib/data.js';

const PRODUCTS = ['ETH-USD', 'SOL-USD'];
const CANDLE_URL = (p) => `https://api.exchange.coinbase.com/products/${p}/candles?granularity=300`;

const clip = (x, m) => (x > m ? m : x < -m ? -m : x);

/** Coinbase candles: [time, low, high, open, close, volume]; time in seconds. */
function closesOf(payload) {
  if (!Array.isArray(payload)) return [];
  const rows = payload
    .filter((r) => Array.isArray(r) && Number.isFinite(r[0]) && Number.isFinite(r[4]))
    .map((r) => ({ t: r[0] * 1000, c: r[4] }));
  rows.sort((a, b) => a.t - b.t);
  return rows.map((r) => r.c);
}

function logReturns(closes) {
  const out = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) out.push(Math.log(closes[i] / closes[i - 1]));
  }
  return out;
}

function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN; }
function stdev(xs) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  const v = xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1);
  return v > 0 ? Math.sqrt(v) : 0;
}

export async function fetchSignal({ t, bars, btcBars, dir, getJson: fetchJson, xrpl }) {
  const degraded = { bias: 0, degraded: true, warmingUp: false };
  try {
    const get = fetchJson || getJson;
    if (typeof get !== 'function') return degraded;
    const [ethRaw, solRaw] = await Promise.all([
      get(CANDLE_URL(PRODUCTS[0]), { timeout: 20000, retries: 2 }),
      get(CANDLE_URL(PRODUCTS[1]), { timeout: 20000, retries: 2 }),
    ]);
    const eth = closesOf(ethRaw);
    const sol = closesOf(solRaw);
    // No honest momentum read without at least the trailing hour of bars.
    if (eth.length < 13 || sol.length < 13) return degraded;
    const read = (closes) => {
      const rets = logReturns(closes);
      const mom = mean(rets.slice(-12));          // trailing-hour drift
      const sd = stdev(rets.slice(-288));         // own trailing-day volatility
      const z = sd > 0 && Number.isFinite(mom) ? mom / sd : 0;
      return { mom, z, bars: closes.length };
    };
    const e = read(eth), s = read(sol);
    if (!Number.isFinite(e.mom) || !Number.isFinite(s.mom)) return degraded;
    const bias = clip(0.5 * (e.z + s.z) * 0.012, 0.02);
    if (!Number.isFinite(bias)) return degraded;
    // Warming up: momentum is computable, but the volatility scale needs a
    // full day of history before the read means anything — abstain honestly.
    const warmingUp = eth.length < 289 || sol.length < 289;
    return {
      bias: warmingUp ? 0 : bias,
      degraded: false,
      warmingUp,
      momETH: e.mom,
      momSOL: s.mom,
      zETH: e.z,
      zSOL: s.z,
    };
  } catch {
    return degraded;
  }
}
