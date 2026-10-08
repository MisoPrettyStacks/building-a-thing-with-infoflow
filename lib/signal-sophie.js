// Sophie's session-seasonality signal — pure from bars, no fetch.
//
// Design: group closed 5-minute bars by UTC hour-of-day over trailing
// history; for each hour compute the mean log-return. The forecast target
// is the next 3 UTC hours from the cycle time, so the bias is the average
// of those hours' historical means. Seasonal effects in 5-min returns are
// tiny — the code is honest about that, and so is Sophie.
//
// Session geography (UTC): Asia 0-8, Europe 7-16, US 13-21. Overlaps resolve
// by US > Europe > Asia priority; everything else is quiet hours.
//
// Tuning constants live here in code, never in page text or chat replies.

export const SESSION_HISTORY_BARS = 2016;  // 7 days of 5-min bars before she trusts the read
export const SESSION_GAIN = 20;           // scale: hourly mean -> bias units
export const SESSION_BIAS_MAX = 0.01;     // seasonal tilts are tiny — clipped hard
export const SESSION_DECISIVE = 0.003;    // |bias| above this counts as expressive
export const SESSION_TARGET_HOURS = 3;     // forecast target window in UTC hours

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

/** Current UTC hour (0-23). */
function utcHour(tSec) { return new Date(tSec * 1000).getUTCHours(); }

/** Deterministic session name for a UTC hour. */
export function sessionName(hour) {
  if (hour >= 13 && hour < 21) return 'US';
  if (hour >= 7 && hour < 16) return 'Europe';
  if (hour >= 0 && hour < 8) return 'Asia';
  return 'quiet hours';
}

const blankMeans = () => new Array(24).fill(null);

/**
 * Pure: mean log-return per UTC hour-of-day from closed 5-min bars.
 * bars: ascending [{t,o,h,l,c,v}] with t = bucket start (unix s).
 * Uses only bars closed at or before tCycle.
 */
export function computeHourlyMeans(bars, tCycle, stepSec = 300) {
  const sums = new Array(24).fill(0);
  const counts = new Array(24).fill(0);
  for (const b of bars || []) {
    if (!b || typeof b.t !== 'number') continue;
    if (b.t + stepSec > tCycle) continue;             // not closed yet at cycle time
    const o = b.o, c = b.c;
    if (!o || !c || o <= 0 || c <= 0) continue;
    const h = new Date(b.t * 1000).getUTCHours();
    sums[h] += Math.log(c / o);
    counts[h] += 1;
  }
  const means = blankMeans();
  for (let h = 0; h < 24; h++) means[h] = counts[h] > 0 ? sums[h] / counts[h] : null;
  return { means, counts };
}

/**
 * Sophie's per-cycle signal read. Pure except it never throws:
 * every fetch is best-effort and returns a degraded/abstain state on error.
 *
 * fetchSignal({ t, bars, btcBars, dir, getJson, xrpl })
 *   t: cycle time (unix s). bars: ascending closed 5-min bars [{t,o,h,l,c,v}].
 *   The rest are accepted for a common member signature and unused —
 *   this signal is pure from bars.
 *
 * Returns { bias, degraded:false, warmingUp, session, hourlyMeans,
 *           targetHours, hourCounts, bestHour, computedAt }.
 */
export async function fetchSignal({ t, bars }) {
  try {
    const tCycle = Number(t) || Math.floor(Date.now() / 1000);
    const list = Array.isArray(bars) ? bars : [];
    const closed = list.filter((b) => b && typeof b.t === 'number' && b.t + 300 <= tCycle);
    if (closed.length < SESSION_HISTORY_BARS) {
      return {
        bias: 0, degraded: false, warmingUp: true,
        session: sessionName(utcHour(tCycle)),
        hourlyMeans: blankMeans(), hourCounts: new Array(24).fill(0),
        targetHours: [], bestHour: null, barsSeen: closed.length,
      };
    }
    const { means, counts } = computeHourlyMeans(closed, tCycle, 300);
    const curH = utcHour(tCycle);
    const targetHours = [1, 2, 3].map((k) => (curH + k) % 24);
    const targetMeans = targetHours.map((h) => means[h]).filter((m) => m != null);
    const avg = targetMeans.length ? targetMeans.reduce((a, x) => a + x, 0) / targetMeans.length : 0;
    const bias = clamp(avg * SESSION_GAIN, -SESSION_BIAS_MAX, SESSION_BIAS_MAX);
    const hourlyMeans = means.map((m) => (m == null ? null : +m.toFixed(8)));
    let bestHour = null;
    let bestAbs = -1;
    for (let h = 0; h < 24; h++) {
      const m = means[h];
      if (m == null) continue;
      const a = Math.abs(m);
      if (a > bestAbs) { bestAbs = a; bestHour = h; }
    }
    return {
      bias, degraded: false, warmingUp: false,
      session: sessionName(curH),
      hourlyMeans, hourCounts: counts, targetHours, bestHour,
      barsSeen: closed.length,
    };
  } catch {
    // Best-effort: never throw. Abstain loudly, not with a fake number.
    return {
      bias: 0, degraded: false, warmingUp: true,
      session: '—', hourlyMeans: blankMeans(), hourCounts: new Array(24).fill(0),
      targetHours: [], bestHour: null, barsSeen: 0,
    };
  }
}
