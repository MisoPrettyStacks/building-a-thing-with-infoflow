// Cherry's signal: the BTC-coupling conditional bias.
//
// Pure from the lab's own candles — no external fetch. Aligns XRP and BTC
// 5-minute bars by timestamp, takes the rolling 24h (288 bars) Pearson
// correlation of log returns, and follows BTC's recent drift only when the
// pair is coupled (corr >= 0.6). Otherwise she abstains honestly (bias 0).
//
// Best-effort: this function NEVER throws. Any bad input returns a
// degraded or warming-up state with bias 0.

const OVERLAP_MIN = 288;   // 24h of 5-min bars of shared history required
const COUPLE_MIN = 0.6;    // correlation threshold for the coupled regime
const MOM_WINDOW = 12;     // BTC momentum: mean log-return over last 12 bars
const MOM_GAIN = 0.5;      // bias scales with half of BTC's recent drift
const BIAS_CAP = 0.02;     // absolute cap on the emitted bias

function logReturn(a, b) {
  if (!(a > 0) || !(b > 0) || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.log(a / b);
}

export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl }) {
  const degraded0 = () => ({
    bias: 0, degraded: false, warmingUp: true, corr24h: null, coupled: false, btcMom1h: null,
  });
  try {
    const xs = Array.isArray(bars) ? bars : [];
    const bs = Array.isArray(btcBars) ? btcBars : [];

    // 1) Align by timestamp: build a map of BTC closes keyed on bar time.
    const btcByT = new Map();
    for (const b of bs) {
      if (b == null || !Number.isFinite(b.t) || !Number.isFinite(b.c) || b.c <= 0) continue;
      btcByT.set(b.t, b.c);
    }

    // 2) Paired closes in XRP bar order; dedupe timestamps, keep last.
    const pairs = [];
    const seen = new Set();
    for (const b of xs) {
      if (b == null || !Number.isFinite(b.t) || !Number.isFinite(b.c) || b.c <= 0) continue;
      if (seen.has(b.t)) continue;
      seen.add(b.t);
      const bc = btcByT.get(b.t);
      if (bc != null) pairs.push({ t: b.t, xrp: b.c, btc: bc });
    }

    if (pairs.length < OVERLAP_MIN) {
      return degraded0();
    }

    // 3) Rolling 24h window: last 288 overlapping bars.
    const win = pairs.slice(-OVERLAP_MIN);

    // 4) Log returns for both series (287 returns from 288 bars).
    const xr = [], br = [];
    for (let i = 1; i < win.length; i++) {
      const r1 = logReturn(win[i].xrp, win[i - 1].xrp);
      const r2 = logReturn(win[i].btc, win[i - 1].btc);
      if (r1 == null || r2 == null || !Number.isFinite(r1) || !Number.isFinite(r2)) continue;
      xr.push(r1); br.push(r2);
    }
    if (xr.length < 200) {
      return degraded0();
    }

    // 5) Pearson correlation of log returns.
    let sx = 0, sy = 0;
    for (let i = 0; i < xr.length; i++) { sx += xr[i]; sy += br[i]; }
    const mx = sx / xr.length, my = sy / xr.length;
    let cov = 0, vx = 0, vy = 0;
    for (let i = 0; i < xr.length; i++) {
      const dx = xr[i] - mx, dy = br[i] - my;
      cov += dx * dy; vx += dx * dx; vy += dy * dy;
    }
    const denom = Math.sqrt(vx * vy);
    const corr24h = denom > 0 ? cov / denom : null;
    if (corr24h == null || !Number.isFinite(corr24h)) {
      return degraded0();
    }

    const coupled = corr24h >= COUPLE_MIN;
    if (!coupled) {
      return { bias: 0, degraded: false, warmingUp: false, corr24h, coupled: false, btcMom1h: null };
    }

    // 6) Coupled regime: BTC's recent hourly drift becomes a conditional tilt.
    const tail = br.slice(-MOM_WINDOW);
    let m = 0;
    for (const r of tail) m += r;
    const btcMom1h = m / tail.length;
    if (!Number.isFinite(btcMom1h)) {
      return { bias: 0, degraded: false, warmingUp: false, corr24h, coupled: true, btcMom1h: null };
    }
    let bias = btcMom1h * MOM_GAIN * corr24h;
    bias = Math.max(-BIAS_CAP, Math.min(BIAS_CAP, bias));
    if (!Number.isFinite(bias)) bias = 0;

    return { bias, degraded: false, warmingUp: false, corr24h, coupled: true, btcMom1h };
  } catch {
    // Best-effort contract: never throw.
    return { bias: 0, degraded: true, warmingUp: false, corr24h: null, coupled: false, btcMom1h: null };
  }
}
