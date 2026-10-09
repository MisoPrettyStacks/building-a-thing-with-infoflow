// Daisy's derivatives-positioning signal — funding rate + open interest.
//
// Bybit's public API geo-blocks/WAF-blocks server IPs (HTTP 403 everywhere,
// including GitHub Actions), so Daisy now reads a cascade of free public
// derivatives sources (no keys), first working source wins per leg:
//
//   FUNDING leg:
//     1. Gate.io funding-rate history  GET /api/v4/futures/usdt/funding_rate
//        ?contract=XRP_USDT&limit=30  -> 8h funding readings [{r, t}]
//     2. Gate.io contract snapshot     -> current funding_rate
//     3. Kraken Futures PF_XRPUSD      -> fundingRate
//   OPEN-INTEREST leg:
//     1. Kraken Futures PF_XRPUSD openInterest, one reading per cycle,
//        persisted to <dir>/daisy-state.json -> trend across the window
//   CROWD cross-check (real data, no extra fetch):
//     Gate.io contract long_users / short_users -> long-short ratio
//
// Logic (conceptual): persistently positive funding means longs are crowded
// (fragile — bearish tilt); persistently negative funding means shorts are
// crowded (fragile — bullish tilt). Rising open interest strengthens the read
// (fresh money piling into the crowded side); flat/falling OI weakens it.
// An extreme long-short user ratio leans the same way (crowded longs fragile).
//
// Best effort only: every fetch is wrapped so the signal NEVER throws —
// on any failure it returns a degraded zero-bias state and the runner
// abstains honestly instead of guessing. REAL DATA ONLY: no synthetic
// funding, no placeholder OI; if every source is unreachable, degraded.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const GATE_FUNDING_HIST = 'https://api.gateio.ws/api/v4/futures/usdt/funding_rate?contract=XRP_USDT&limit=30';
const GATE_CONTRACT = 'https://api.gateio.ws/api/v4/futures/usdt/contracts/XRP_USDT';
const KRAKEN_TICKERS = 'https://futures.kraken.com/derivatives/api/v3/tickers';

const OI_WARMUP_READINGS = 6;   // need a real OI trail before trend reads mean anything
const OI_WINDOW = 48;           // trend window: last 48 readings (~8h at 5-min cadence)
const STATE_CAP = 200;

const clip = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function num(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

function loadOiReadings(statePath) {
  try {
    const raw = JSON.parse(readFileSync(statePath, 'utf8'));
    const r = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.oiReadings) ? raw.oiReadings : []);
    return r.filter((x) => x && Number.isFinite(x.t) && Number.isFinite(x.oi) && x.oi > 0)
      .sort((a, b) => a.t - b.t).slice(-STATE_CAP);
  } catch {
    return [];
  }
}

function saveOiReadings(statePath, readings) {
  try {
    writeFileSync(statePath, JSON.stringify({ oiReadings: readings.slice(-STATE_CAP) }) + '\n');
  } catch { /* best-effort only */ }
}

async function tryJson(fetchJson, url) {
  try {
    const j = await fetchJson(url, { timeout: 12000, retries: 1 });
    return j;
  } catch {
    return null;
  }
}

export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl }) {
  const degraded = { bias: 0, degraded: true, warmingUp: false };
  try {
    const fetchJson = typeof getJson === 'function' ? getJson : null;
    const rawFetch = async (url) => {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 12000);
      try {
        const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
        if (!res.ok) return null;
        return await res.json();
      } catch { return null; } finally { clearTimeout(to); }
    };
    const get = fetchJson ? (u) => tryJson(fetchJson, u) : rawFetch;

    // ---- FUNDING leg: cascade ----
    let avgFunding = null, fundingSource = null, fundingCount = 0;
    const gh = await get(GATE_FUNDING_HIST);
    if (Array.isArray(gh)) {
      const rates = gh.map((e) => num(e && e.r)).filter((v) => v !== null);
      if (rates.length >= 3) {
        avgFunding = rates.reduce((a, b) => a + b, 0) / rates.length;
        fundingSource = 'gate.io funding history (8h readings)';
        fundingCount = rates.length;
      }
    }
    let longShortRatio = null;
    if (avgFunding == null) {
      const gc = await get(GATE_CONTRACT);
      const fr = gc ? num(gc.funding_rate) : null;
      if (fr !== null) {
        avgFunding = fr;
        fundingSource = 'gate.io contract funding (current)';
        fundingCount = 1;
      }
      const lu = gc ? num(gc.long_users) : null;
      const su = gc ? num(gc.short_users) : null;
      if (lu !== null && su !== null && su > 0) longShortRatio = lu / su;
    } else {
      // still grab the contract for the long/short cross-check (cheap, one call)
      const gc = await get(GATE_CONTRACT);
      const lu = gc ? num(gc.long_users) : null;
      const su = gc ? num(gc.short_users) : null;
      if (lu !== null && su !== null && su > 0) longShortRatio = lu / su;
    }
    if (avgFunding == null) {
      const kt = await get(KRAKEN_TICKERS);
      const px = kt && Array.isArray(kt.tickers) ? kt.tickers.find((x) => x && x.symbol === 'PF_XRPUSD') : null;
      const fr = px ? num(px.fundingRate) : null;
      if (fr !== null) {
        avgFunding = fr;
        fundingSource = 'kraken futures funding (current)';
        fundingCount = 1;
      }
    }
    if (avgFunding == null) {
      return { ...degraded, reason: 'funding feed unreachable on all sources' };
    }

    // ---- OPEN-INTEREST leg: Kraken, persisted trail ----
    const statePath = path.join(dir || '.', 'daisy-state.json');
    let readings = loadOiReadings(statePath);
    const kt = await get(KRAKEN_TICKERS);
    const px = kt && Array.isArray(kt.tickers) ? kt.tickers.find((x) => x && x.symbol === 'PF_XRPUSD') : null;
    const oiNow = px ? num(px.openInterest) : null;
    if (oiNow !== null && oiNow > 0) {
      const nowMs = Date.now();
      const last = readings[readings.length - 1];
      if (!last || nowMs - last.t >= 60000) readings.push({ t: nowMs, oi: oiNow, src: 'kraken' });
      readings = readings.slice(-STATE_CAP);
      saveOiReadings(statePath, readings);
    }

    if (readings.length < OI_WARMUP_READINGS) {
      return {
        ...degraded, warmingUp: true,
        reason: `open-interest trail building (${readings.length}/${OI_WARMUP_READINGS} readings)`,
        funding8h: avgFunding, fundingSource, fundingCount, oiReadings: readings.length,
        longShortRatio,
      };
    }
    const win = readings.slice(-OI_WINDOW);
    const first = win[0].oi, last = win[win.length - 1].oi;
    const oiTrend = first > 0 ? (last - first) / first : 0;
    const oiRising = oiTrend > 0;

    // --- crowded-positioning tilt ---
    let bias = -avgFunding * 300 * (oiRising ? 1.5 : 1);
    if (longShortRatio !== null && longShortRatio > 0) {
      // crowded longs (ratio >> 1) are fragile -> bearish lean; crowded shorts -> bullish
      bias += -0.004 * Math.tanh(Math.log(longShortRatio));
    }
    bias = clip(bias, -0.02, 0.02);

    return {
      bias,
      degraded: false,
      warmingUp: false,
      funding8h: avgFunding,
      fundingSource,
      fundingCount,
      oiTrend,
      oiRising,
      oiReadings: readings.length,
      longShortRatio,
    };
  } catch (e) {
    return { ...degraded, reason: String((e && e.message) || e || 'fetch error').slice(0, 160) };
  }
}
