// Information-flow (transfer entropy) estimators for the infoflow experiment.
// Pure math, no I/O: safe to import in browsers and Node >= 18.
//
// Transfer entropy TE(X->Y) measures directed information flow from X to Y:
//   TE = Σ p(y+, y, x) · log[ p(y+ | y, x) / p(y+ | y) ]
// where y+ is the next target symbol and (y, x) are one-step histories (k = l = 1).
// Returns are discretized into 3 quantile bins (down / flat / up) within each window.
// A shuffle-surrogate significance test (null: no coupling) reports a z-score so we
// know whether the measured flow is real or finite-sample noise.

import { mulberry32 } from './stats.js';

function quantileSorted(sorted, q) {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** Discretize values into nBins symbols via quantiles. Returns Uint8Array. */
export function discretize(values, nBins = 3) {
  const s = Array.from(values).sort((a, b) => a - b);
  const cuts = [];
  for (let b = 1; b < nBins; b++) cuts.push(quantileSorted(s, b / nBins));
  const out = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) {
    let sym = 0;
    while (sym < cuts.length && values[i] > cuts[sym]) sym++;
    out[i] = sym;
  }
  return out;
}

/** Core TE from aligned symbol arrays (xs = source, ys = target). */
export function teFromSymbols(xs, ys, nBins = 3) {
  const n = ys.length;
  if (n < 10) return { te: 0, n: 0 };
  const joint = new Float64Array(nBins * nBins * nBins); // [y_next][y][x]
  const yxMarg = new Float64Array(nBins * nBins);        // [y][x]
  const yyMarg = new Float64Array(nBins * nBins);        // [y_next][y]
  const yMarg = new Float64Array(nBins);                 // [y]
  let N = 0;
  for (let t = 0; t < n - 1; t++) {
    const yn = ys[t + 1], y = ys[t], x = xs[t];
    joint[(yn * nBins + y) * nBins + x]++;
    yxMarg[y * nBins + x]++;
    yyMarg[yn * nBins + y]++;
    yMarg[y]++;
    N++;
  }
  let te = 0;
  for (let yn = 0; yn < nBins; yn++)
    for (let y = 0; y < nBins; y++) {
      if (!yMarg[y]) continue;
      for (let x = 0; x < nBins; x++) {
        const c = joint[(yn * nBins + y) * nBins + x];
        if (!c) continue;
        const pJoint = c / N;
        const pFull = c / yxMarg[y * nBins + x];
        const pRed = yyMarg[yn * nBins + y] / yMarg[y];
        te += pJoint * Math.log(pFull / pRed);
      }
    }
  return { te: Math.max(0, te), n: N };
}

/**
 * Transfer entropy from sourceVals to targetVals (nats), with shuffle-surrogate z-score.
 * Under the null (no coupling), shuffling the source destroys the directed flow while
 * preserving marginals; z = (te - mean_null) / sd_null.
 */
export function transferEntropy(sourceVals, targetVals, { nBins = 3, shuffles = 50, seed = 12345 } = {}) {
  const n = Math.min(sourceVals.length, targetVals.length);
  if (n < 10) return { te: 0, z: 0, meanShuffled: 0, sdShuffled: 0, n: 0 };
  const xs = discretize(sourceVals.slice(0, n), nBins);
  const ys = discretize(targetVals.slice(0, n), nBins);
  const { te } = teFromSymbols(xs, ys, nBins);
  const rng = mulberry32(seed);
  const xshuf = Uint8Array.from(xs);
  let sum = 0, sum2 = 0;
  for (let s = 0; s < shuffles; s++) {
    for (let i = xshuf.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = xshuf[i]; xshuf[i] = xshuf[j]; xshuf[j] = tmp;
    }
    const r = teFromSymbols(xshuf, ys, nBins).te;
    sum += r; sum2 += r * r;
  }
  const mean = sum / shuffles;
  const sd = Math.sqrt(Math.max(0, sum2 / shuffles - mean * mean));
  const z = sd > 1e-12 ? (te - mean) / sd : 0;
  return { te, z, meanShuffled: mean, sdShuffled: sd, n };
}

/** Lehmer-code rank of the ordinal pattern in values[i..i+order). */
function ordinalRank(values, i, order) {
  const idx = [];
  for (let k = 0; k < order; k++) idx.push(k);
  idx.sort((a, b) => (values[i + a] - values[i + b]) || (a - b));
  const used = new Array(order).fill(false);
  let rank = 0;
  for (let k = 0; k < order; k++) {
    let smaller = 0;
    for (let j = 0; j < idx[k]; j++) if (!used[j]) smaller++;
    rank = rank * (order - k) + smaller;
    used[idx[k]] = true;
  }
  return rank;
}

/**
 * Normalized permutation entropy in [0, 1] (order 3 -> 6 ordinal patterns).
 * Low values = ordered / trending regime; high values = noise-dominated regime.
 */
export function permutationEntropy(values, order = 3) {
  const n = values.length;
  const nPat = [1, 1, 2, 6, 24, 120][order] || 6;
  if (n < order + 1) return 1;
  const counts = new Float64Array(nPat);
  let N = 0;
  for (let i = 0; i + order <= n; i++) { counts[ordinalRank(values, i, order)]++; N++; }
  let h = 0;
  for (let c = 0; c < nPat; c++) {
    if (!counts[c]) continue;
    const p = counts[c] / N;
    h -= p * Math.log(p);
  }
  return h / Math.log(nPat);
}

/**
 * Rolling information-flow diagnostics between XRP and BTC 5-minute bars.
 * Bars are {t, c}; BTC bars are matched to XRP timestamps (same Coinbase grid).
 * For each bar i >= fromIdx: TE(BTC->XRP), TE(XRP->BTC) over the trailing `window`
 * returns, shuffle z-scores, permutation entropy of XRP returns, and the member vote.
 * Vote: 0.5 (abstain) unless net flow BTC->XRP is positive AND significant (z > 2),
 * in which case P(up) = 0.5 + clamp(net*5, 0, 0.15) * sign(recent 15-min BTC move).
 */
export function computeInfoflow(xrpBars, btcBars, { window = 288, fromIdx = 0, nBins = 3, shuffles = 50, seed = 7 } = {}) {
  const n = xrpBars.length;
  const btcByT = new Map();
  for (const b of btcBars || []) btcByT.set(b.t, b.c);
  const xr = new Float64Array(n).fill(NaN);
  const br = new Float64Array(n).fill(NaN);
  for (let i = 1; i < n; i++) {
    xr[i] = Math.log(xrpBars[i].c / xrpBars[i - 1].c);
    const bc = btcByT.get(xrpBars[i].t), bp = btcByT.get(xrpBars[i - 1].t);
    if (bc && bp) br[i] = Math.log(bc / bp);
  }
  const votes = new Array(n).fill(0.5);
  const noisy = new Array(n).fill(false);
  const diag = new Array(n).fill(null);
  const start = Math.max(fromIdx, window, 1);
  for (let i = start; i < n; i++) {
    const xs = [], ys = [];
    for (let k = i - window + 1; k <= i; k++) {
      if (Number.isFinite(xr[k]) && Number.isFinite(br[k])) { ys.push(xr[k]); xs.push(br[k]); }
    }
    if (xs.length < 100) continue;
    const bx = transferEntropy(xs, ys, { nBins, shuffles, seed: seed + i });
    const xb = transferEntropy(ys, xs, { nBins, shuffles, seed: seed + 1000003 + i });
    const net = bx.te - xb.te;
    const pe = permutationEntropy(ys, 3);
    const isNoisy = pe > 0.85;
    let vote = 0.5;
    if (net > 0 && bx.z > 2) {
      const btcRecent = (br[i] || 0) + (br[i - 1] || 0) + (br[i - 2] || 0);
      const dev = Math.min(0.15, Math.max(0, net * 5)) * Math.sign(btcRecent);
      vote = 0.5 + dev;
    }
    votes[i] = vote;
    noisy[i] = isNoisy;
    diag[i] = {
      te_btc_xrp: +bx.te.toFixed(6), te_xrp_btc: +xb.te.toFixed(6), net: +net.toFixed(6),
      z_btc_xrp: +bx.z.toFixed(3), z_xrp_btc: +xb.z.toFixed(3),
      perm_entropy: +pe.toFixed(4), noisy: isNoisy, vote: +vote.toFixed(6), window_bars: xs.length,
    };
  }
  return { votes, noisy, diag };
}
