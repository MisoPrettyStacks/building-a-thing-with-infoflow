// Topological features for the XRP model: Takens delay embedding +
// Vietoris-Rips persistent homology (H0 and H1). Pure math, no I/O:
// safe to import in browsers and Node >= 18.
//
// Idea: a 5-minute log-return series is embedded as a point cloud in R^3
// (Takens delay embedding). The shape of that cloud has topological features:
// connected components (H0) and loops (H1). A persistent H1 loop means the
// market is tracing a stable cyclic structure; when the loop structure
// suddenly reorganizes (persistence diagram jumps), the regime is changing
// and the model should dampen its confidence.
//
// The member is a REGIME-CHANGE DETECTOR, not a directional predictor.
// Default behavior is dampening-only: when the H1 diagram distance spikes
// above its rolling 7-day median + 2 sigma, P(up) shrinks 10% toward 0.5.

// ---- tuning constants (documented in the Methodology section) ----
export const TAKENS_DIM = 3;        // embedding dimension d
export const TAKENS_TAU = 2;        // delay tau, in bars (10 minutes at 5-min bars)
export const RIPS_N = 144;          // points per window (12h of 5-min bars)
export const TOPO_SHRINK = 0.9;     // P(up) deviation multiplier when regime change fires
export const TOPO_MIN_HISTORY = 50; // min diagram-distance samples before dampening can trigger
export const TOPO_HISTORY_CAP = 2016; // 7 days of 5-min samples
export const TOPO_NUDGE_CAP = 0.02; // max directional nudge (disabled by default)
export const TOPO_PE_ORDERED = 0.4; // PE below this = ordered regime (nudge gating only)

/**
 * Takens delay embedding: returns r[0..W-1] (oldest first) -> point cloud in R^d.
 * Point i corresponds to time t = i + (d-1)*tau and has coordinates
 *   p_i = [ r_t, r_{t-tau}, ..., r_{t-(d-1)*tau} ]   (most recent return first).
 * Returns [] if there are not enough returns.
 */
export function takensEmbed(returns, dim = TAKENS_DIM, tau = TAKENS_TAU) {
  const n = returns.length - (dim - 1) * tau;
  if (!Number.isFinite(n) || n <= 0) return [];
  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i + (dim - 1) * tau;
    const p = new Float64Array(dim);
    for (let k = 0; k < dim; k++) p[k] = returns[t - k * tau];
    pts[i] = p;
  }
  return pts;
}

/** Union-find with path compression and union by rank (for H0). */
class UnionFind {
  constructor(n) {
    this.p = new Int32Array(n);
    this.r = new Uint8Array(n);
    for (let i = 0; i < n; i++) this.p[i] = i;
  }
  find(x) {
    const p = this.p;
    while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; }
    return x;
  }
  /** @returns true when x,y were in different components (a merge happened). */
  union(x, y) {
    let rx = this.find(x), ry = this.find(y);
    if (rx === ry) return false;
    if (this.r[rx] < this.r[ry]) { const t = rx; rx = ry; ry = t; }
    this.p[ry] = rx;
    if (this.r[rx] === this.r[ry]) this.r[rx]++;
    return true;
  }
}

/** Symmetric difference of two descending-sorted integer arrays (XOR over Z/2). */
function xorDesc(a, b) {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; }
    else if (a[i] > b[j]) { out.push(a[i]); i++; }
    else { out.push(b[j]); j++; }
  }
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}

/**
 * Vietoris-Rips persistent homology of a point cloud (H0 and H1).
 *
 * Filtration: simplices enter in order of their diameter
 * (for an edge: its length; for a triangle: its longest edge).
 * - H0 via union-find: an edge merging two components kills one (death = length).
 * - H1 via boundary-matrix reduction over Z/2: edges are processed in filtration
 *   order; an edge whose endpoints are already connected BIRTHS an H1 class.
 *   Triangles are then processed in filtration order; each triangle's boundary
 *   (its 3 edges) is reduced by XOR-ing with previously stored triangle columns
 *   sharing the same pivot (largest edge index). A non-empty reduced boundary
 *   kills the H1 class born at its pivot edge: pair (birth, death=triangle filt).
 *
 * Returns { h0: [death diameters], h1: [[birth, death], ...] }.
 * Every H1 class of a finite Rips filtration eventually dies (the full simplex
 * is contractible), so all births pair up; any leftover is dropped defensively.
 */
export function ripsH1(pts) {
  const n = pts.length;
  if (n < 4) return { h0: [], h1: [] };
  const dim = pts[0].length;
  // --- edges, sorted by length (filtration order) ---
  const m = (n * (n - 1)) / 2;
  const D = new Float64Array(m);
  const EI = new Uint16Array(m), EJ = new Uint16Array(m);
  let k = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++, k++) {
      let s = 0;
      const a = pts[i], b = pts[j];
      for (let c = 0; c < dim; c++) { const d = a[c] - b[c]; s += d * d; }
      D[k] = Math.sqrt(s);
      EI[k] = i; EJ[k] = j;
    }
  }
  const order = Array.from({ length: m }, (_, i) => i);
  order.sort((a, b) => D[a] - D[b]);
  // --- H0 + H1 births ---
  const uf = new UnionFind(n);
  const epos = new Int32Array(n * n).fill(-1); // (i,j) -> filtration position
  const h1Birth = new Map(); // filtration position -> birth diameter
  const h0 = [];
  for (let p = 0; p < m; p++) {
    const e = order[p];
    const i = EI[e], j = EJ[e];
    epos[i * n + j] = p;
    epos[j * n + i] = p;
    if (uf.union(i, j)) h0.push(D[e]);
    else h1Birth.set(p, D[e]);
  }
  // --- triangles, sorted by filtration (longest edge) ---
  // full distance matrix for O(1) triple filtration lookup
  const DM = new Float64Array(n * n);
  for (let e = 0; e < m; e++) { DM[EI[e] * n + EJ[e]] = D[e]; DM[EJ[e] * n + EI[e]] = D[e]; }
  const T = (n * (n - 1) * (n - 2)) / 6;
  const TI = new Uint16Array(T), TJ = new Uint16Array(T), TK = new Uint16Array(T);
  const TF = new Float64Array(T);
  let t = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dij = DM[i * n + j];
      for (let kk = j + 1; kk < n; kk++, t++) {
        TI[t] = i; TJ[t] = j; TK[t] = kk;
        TF[t] = Math.max(dij, DM[j * n + kk], DM[i * n + kk]);
      }
    }
  }
  const tOrder = Array.from({ length: T }, (_, i) => i);
  tOrder.sort((a, b) => TF[a] - TF[b]);
  // --- boundary-matrix reduction (columns = triangles, rows = edges) ---
  // pivot[edgePos] = triangle order-index whose reduced boundary has that pivot;
  // colOf[ti] = reduced boundary (descending edge positions) for pivot triangles.
  const piv = new Int32Array(m).fill(-1);
  const colOf = new Array(T);
  const h1 = [];
  for (let ti = 0; ti < T; ti++) {
    const tt = tOrder[ti];
    const i = TI[tt], j = TJ[tt], kk = TK[tt];
    const a = epos[i * n + j], b = epos[j * n + kk], c = epos[i * n + kk];
    // 3-element descending sort by hand (hot loop)
    let col;
    if (a >= b && b >= c) col = [a, b, c];
    else if (a >= c && c >= b) col = [a, c, b];
    else if (b >= a && a >= c) col = [b, a, c];
    else if (b >= c && c >= a) col = [b, c, a];
    else if (c >= a && a >= b) col = [c, a, b];
    else col = [c, b, a];
    for (;;) {
      if (col.length === 0) break;
      const prev = piv[col[0]];
      if (prev < 0) break;
      col = xorDesc(col, colOf[prev]); // pivot strictly decreases: terminates
    }
    if (col.length === 0) continue; // positive simplex (creates H2): not tracked
    const p = col[0];
    piv[p] = ti;
    colOf[ti] = col;
    const birth = h1Birth.get(p);
    if (birth !== undefined) {
      h1.push([birth, TF[tt]]);
      h1Birth.delete(p);
    }
  }
  return { h0, h1 };
}

/** Finite H1 lifetimes (death - birth), guarding against dust. */
export function h1Lifetimes(h1pairs) {
  const out = [];
  for (const [b, d] of h1pairs) {
    const l = d - b;
    if (l > 1e-12 && Number.isFinite(l)) out.push(l);
  }
  return out;
}

/**
 * Persistence entropy of the H1 diagram, normalized to [0,1].
 *   PE = - sum_i (l_i / L) log(l_i / L) / log(n),
 * with l_i the finite H1 lifetimes, L their sum, n their count.
 * 0 = one dominant loop (ordered); 1 = lifetimes spread evenly (noise).
 */
export function persistenceEntropy(lifetimes) {
  const ls = lifetimes.filter((l) => l > 1e-12);
  const nb = ls.length;
  if (nb <= 1) return 0;
  let L = 0;
  for (const l of ls) L += l;
  if (L <= 1e-12) return 0;
  let h = 0;
  for (const l of ls) { const p = l / L; h -= p * Math.log(p); }
  return h / Math.log(nb);
}

/**
 * 2-Wasserstein distance between two H1 diagrams, via their lifetime
 * distributions: sort both lifetime multisets descending, pad the shorter
 * with zeros (bars matched to the diagonal), take the L2 distance.
 * Matching sorted 1-D vectors is the optimal coupling (rearrangement
 * inequality), so this is exact for the lifetime marginals; birth-time
 * information is intentionally dropped for speed and robustness.
 */
export function diagramDistance(a, b) {
  const A = a.filter((l) => l > 1e-12).sort((x, y) => y - x);
  const B = b.filter((l) => l > 1e-12).sort((x, y) => y - x);
  const n = Math.max(A.length, B.length);
  if (n === 0) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    s += d * d;
  }
  return Math.sqrt(s);
}

/** Median of a numeric array (copy-safe). */
export function median(a) {
  if (!a.length) return NaN;
  const s = Array.from(a).sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Population standard deviation. */
export function stdev(a) {
  if (a.length < 2) return 0;
  let m = 0;
  for (const x of a) m += x;
  m /= a.length;
  let v = 0;
  for (const x of a) v += (x - m) * (x - m);
  return Math.sqrt(v / a.length);
}

/**
 * Full topology computation for one window of log returns (oldest first).
 * Uses the LAST (RIPS_N + (TAKENS_DIM-1)*TAKENS_TAU) returns.
 * Returns null when there is not enough valid data.
 */
export function computeTopologyWindow(returns, { dim = TAKENS_DIM, tau = TAKENS_TAU, nPoints = RIPS_N } = {}) {
  const need = nPoints + (dim - 1) * tau;
  if (!returns || returns.length < need) return null;
  const r = returns.slice(-need);
  for (const x of r) if (!Number.isFinite(x)) return null;
  const pts = takensEmbed(r, dim, tau);
  if (pts.length < 4) return null;
  const { h1 } = ripsH1(pts);
  const lifetimes = h1Lifetimes(h1);
  const pe = persistenceEntropy(lifetimes);
  let maxL = 0;
  for (const l of lifetimes) if (l > maxL) maxL = l;
  return { pe, maxL, lifetimes, n: pts.length, nBars: lifetimes.length };
}

/**
 * Highly experimental directional nudge (DISABLED by default; computed for
 * transparency only). When the diagram is ordered (PE < 0.4) and one loop
 * dominates (max lifetime > 3x the median), nudge with the local phase
 * velocity — the sign of the recent 15-minute return — scaled by loop
 * dominance, capped at TOPO_NUDGE_CAP. Rationale: in a stable cyclic regime
 * the short-term momentum is the local direction of travel around the loop.
 * This is a heuristic, not a theorem; it never affects the forecast unless
 * explicitly enabled, which the runner does not do.
 */
export function topologyNudge(diag, recentReturn, { allowNudge = false } = {}) {
  if (!allowNudge || !diag || !Number.isFinite(recentReturn)) return 0;
  if (diag.pe >= TOPO_PE_ORDERED || diag.nBars < 3) return 0;
  const sorted = diag.lifetimes.slice().sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1] || 0;
  if (!(diag.maxL > 3 * med) || med <= 0) return 0;
  const strength = Math.min(1, diag.maxL / (6 * med));
  return TOPO_NUDGE_CAP * Math.sign(recentReturn) * strength;
}
