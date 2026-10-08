// Daisy's derivatives-positioning signal — funding rate + open interest.
//
// Reads the public Bybit derivatives API (no keys) for XRPUSDT perpetuals:
//   - funding history  -> average 8h funding rate (the crowd meter)
//   - open interest    -> trend across recent readings (the amplifier)
//
// Logic (conceptual): persistently positive funding means longs are crowded
// (fragile — bearish tilt); persistently negative funding means shorts are
// crowded (fragile — bullish tilt). Rising open interest strengthens the read
// (fresh money piling into the crowded side); flat/falling OI weakens it.
//
// Best effort only: every fetch is wrapped so the signal NEVER throws —
// on any failure it returns a degraded zero-bias state and the runner
// abstains honestly instead of guessing.

const FUNDING_URL = 'https://api.bybit.com/v5/market/funding/history?category=linear&symbol=XRPUSDT&limit=30';
const OI_URL = 'https://api.bybit.com/v5/market/open-interest?category=linear&symbol=XRPUSDT&intervalTime=240&limit=8';

const clip = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function num(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl }) {
  const degraded = { bias: 0, degraded: true, warmingUp: false };
  try {
    const fetch = typeof getJson === 'function' ? getJson : globalThis.fetch?.bind(globalThis);
    if (!fetch) return { ...degraded, reason: 'no fetcher available' };

    const parseJson = async (url) => {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res || typeof res.json !== 'function') {
        // getJson-style helpers already return parsed JSON
        return res && typeof res === 'object' && !Array.isArray(res) && !res.ok ? res : null;
      }
      if (!res.ok) return null;
      return await res.json();
    };

    const [fj, oj] = await Promise.all([parseJson(FUNDING_URL), parseJson(OI_URL)]);
    if (!fj || fj.retCode !== 0 || !Array.isArray(fj.result?.list) || !fj.result.list.length) {
      return { ...degraded, reason: 'funding feed unavailable' };
    }
    if (!oj || oj.retCode !== 0 || !Array.isArray(oj.result?.list) || oj.result.list.length < 2) {
      return { ...degraded, reason: 'open-interest feed unavailable' };
    }

    // --- average 8h funding rate (list may be newest-first; average is order-free)
    const rates = fj.result.list.map((e) => num(e && e.fundingRate)).filter((v) => v !== null);
    if (!rates.length) return { ...degraded, reason: 'no funding readings' };
    const avgFunding = rates.reduce((a, b) => a + b, 0) / rates.length;

    // --- open-interest trend: last vs first across the window (sorted oldest -> newest)
    const oiRows = oj.result.list
      .map((e) => ({ t: num(e && e.timestamp) ?? 0, oi: num(e && e.openInterest) }))
      .filter((r) => r.oi !== null && r.oi > 0)
      .sort((a, b) => a.t - b.t);
    if (oiRows.length < 2) return { ...degraded, reason: 'insufficient open-interest history' };
    const first = oiRows[0].oi;
    const last = oiRows[oiRows.length - 1].oi;
    const oiTrend = first > 0 ? (last - first) / first : 0;
    const oiRising = oiTrend > 0;

    // --- crowded-positioning tilt: positive funding + rising OI = crowded
    // longs -> bearish tilt; negative funding + rising OI = crowded shorts
    // -> bullish tilt. Rising OI amplifies; flat/falling OI dampens.
    let bias = -avgFunding * 300 * (oiRising ? 1.5 : 1);
    bias = clip(bias, -0.02, 0.02);

    return {
      bias,
      degraded: false,
      warmingUp: false,
      funding8h: avgFunding,
      oiTrend,
      oiRising,
    };
  } catch (e) {
    return { ...degraded, reason: String((e && e.message) || e || 'fetch error').slice(0, 160) };
  }
}
