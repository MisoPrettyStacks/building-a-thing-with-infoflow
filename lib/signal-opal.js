// Opal's order-book depth signal — one per-cycle read of the live
// Coinbase XRP-USD level-2 order book. Best-effort: NEVER throws; on any
// failure it returns a degraded placeholder so the runner keeps going.
//
// Reads:
//   mid          midpoint of best bid/ask
//   spreadBps    (bestAsk - bestBid) / mid * 1e4
//   imbalance    (bidNotional - askNotional) / (bidNotional + askNotional)
//                over the top levels of the book, measured in notional
//   depthBid/Ask notional resting within 1% of mid (usable liquidity)
//   bias         a small scaled tilt from the imbalance, clipped
//
// A "decisive" read is a strong one-sided imbalance; everything else is a
// quiet book, and Opal abstains on quiet books.

import { getJson as importedGetJson } from '../lib/data.js';

const BOOK_URL = 'https://api.exchange.coinbase.com/products/XRP-USD/book?level=2';
const LEVELS = 50;         // top-N levels considered on each side
const DEPTH_BAND = 0.01;   // within 1% of mid counts as usable depth
const BIAS_SCALE = 0.03;   // imbalance -> bias scale
const BIAS_CAP = 0.03;     // |bias| never exceeds this
const DECISIVE_IMB = 0.15; // |imbalance| at/above this = decisive
const MAX_SANE_SPREAD_BPS = 200; // a wider "spread" is a broken book, not a read

function degraded() {
  return { bias: 0, degraded: true, warmingUp: false };
}

export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl }) {
  const gj = getJson || importedGetJson;
  try {
    if (typeof gj !== 'function') return degraded();
    const book = await gj(BOOK_URL, { timeout: 15000, retries: 2 });
    const bids = Array.isArray(book && book.bids) ? book.bids.slice(0, LEVELS) : [];
    const asks = Array.isArray(book && book.asks) ? book.asks.slice(0, LEVELS) : [];
    if (!bids.length || !asks.length) return degraded();
    const bestBid = parseFloat(bids[0][0]);
    const bestAsk = parseFloat(asks[0][0]);
    if (!(bestBid > 0) || !(bestAsk > bestBid)) return degraded(); // crossed book = broken feed
    const mid = (bestBid + bestAsk) / 2;
    const spreadBps = ((bestAsk - bestBid) / mid) * 1e4;
    if (!(spreadBps >= 0) || spreadBps > MAX_SANE_SPREAD_BPS) return degraded();

    let bidN = 0, askN = 0, depthBid = 0, depthAsk = 0;
    for (const row of bids) {
      const price = parseFloat(row[0]), size = parseFloat(row[1]);
      if (!(price > 0) || !(size >= 0)) continue;
      const n = price * size;
      bidN += n;
      if ((mid - price) / mid <= DEPTH_BAND) depthBid += n;
    }
    for (const row of asks) {
      const price = parseFloat(row[0]), size = parseFloat(row[1]);
      if (!(price > 0) || !(size >= 0)) continue;
      const n = price * size;
      askN += n;
      if ((price - mid) / mid <= DEPTH_BAND) depthAsk += n;
    }
    const denom = bidN + askN;
    const imbalance = denom > 0 ? (bidN - askN) / denom : 0;
    const bias = Math.max(-BIAS_CAP, Math.min(BIAS_CAP, imbalance * BIAS_SCALE));
    return {
      bias,
      degraded: false,
      warmingUp: false,
      spreadBps,
      imbalance,
      depthBid,
      depthAsk,
      decisive: Math.abs(imbalance) >= DECISIVE_IMB,
      levels: { bids: bids.length, asks: asks.length },
    };
  } catch {
    return degraded();
  }
}
