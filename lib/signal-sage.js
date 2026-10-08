// Sage's stablecoin-flow member — one slow liquidity read per cycle.
//
// Reads USDT + USDC 24-hour market-cap change from the free CoinGecko API,
// rate-limited by an hourly cache in <dir>/sage-state.json. Rising combined
// market cap = fresh fiat parked on-chain (liquidity entering, mild bullish);
// falling = liquidity leaving. It is a SLOW tide: stablecoin supply moves in
// days, not minutes, so this read is modest about what it can say about
// 15-minute XRP direction.
//
// Never throws: a fetch failure degrades (abstain), it never breaks the
// forecast. Tuning constants live here in code — they never appear in
// page text, chat replies, or the charter.

const CG_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=tether,usd-coin&price_change_percentage=24h';
const CACHE_TTL_MS = 3600 * 1000;  // refetch at most once per hour
const DECISIVE_AT = 0.003;         // |bias| at or above this is an expressive read
const BIAS_GAIN = 0.002;
const BIAS_CAP = 0.01;

function clip(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

async function readCache(dir) {
  if (!dir) return null;
  try {
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(dir + '/sage-state.json', 'utf8'));
  } catch { return null; }
}

async function writeCache(dir, doc) {
  if (!dir) return;
  try {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(dir, { recursive: true });
    await writeFile(dir + '/sage-state.json', JSON.stringify(doc));
  } catch { /* cache is best-effort */ }
}

function computeFromPayload(payload) {
  let usdt = null, usdc = null;
  for (const row of Array.isArray(payload) ? payload : []) {
    if (!row || typeof row !== 'object') continue;
    const chg = Number(row.market_cap_change_percentage_24h);
    if (!Number.isFinite(chg)) continue;
    if (row.id === 'tether') usdt = chg;
    if (row.id === 'usd-coin') usdc = chg;
  }
  if (usdt == null && usdc == null) return null;
  const totalChange = (usdt || 0) + (usdc || 0);
  const bias = clip(totalChange * BIAS_GAIN, -BIAS_CAP, BIAS_CAP);
  return {
    usdtChange24h: usdt,
    usdcChange24h: usdc,
    totalChange,
    bias,
    decisive: Math.abs(bias) >= DECISIVE_AT,
  };
}

function degradedSignal() {
  return {
    bias: 0,
    degraded: true,
    warmingUp: false,
    usdtChange24h: null,
    usdcChange24h: null,
    totalChange: null,
    decisive: false,
    cached: false,
  };
}

/**
 * One stablecoin-liquidity read.
 * @param {object} p
 * @param {string} p.dir - working directory for the hourly cache
 * @param {function} p.getJson - injected fetch helper (from ../lib/data.js)
 * Never throws.
 */
export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl }) {
  try {
    const now = Date.now();
    const cached = await readCache(dir);
    const ageMs = cached && Number.isFinite(cached.fetched_at) ? now - cached.fetched_at : Infinity;
    const hasCache = cached && cached.payload != null;

    let payload, usedCache = false, staleNote = null;
    if (hasCache && ageMs < CACHE_TTL_MS) {
      payload = cached.payload;
      usedCache = true;
    } else {
      let fresh = null, fetchErr = null;
      try {
        if (typeof getJson !== 'function') throw new Error('no getJson provided');
        fresh = await getJson(CG_URL);
      } catch (e) { fetchErr = e; }
      if (fresh != null) {
        payload = fresh;
        await writeCache(dir, { fetched_at: now, payload: fresh });
      } else if (hasCache) {
        // fetch failed but the last good read survives: use it, label it stale
        payload = cached.payload;
        usedCache = true;
        staleNote = 'using last good read — ' + Math.round(ageMs / 60000) + ' min old';
      } else {
        return degradedSignal();
      }
    }

    const sig = computeFromPayload(payload);
    if (!sig) return { ...degradedSignal(), cached: usedCache, staleNote };
    return {
      bias: sig.bias,
      degraded: false,
      warmingUp: false,
      usdtChange24h: sig.usdtChange24h,
      usdcChange24h: sig.usdcChange24h,
      totalChange: sig.totalChange,
      decisive: sig.decisive,
      cached: usedCache,
      staleNote,
    };
  } catch {
    return degradedSignal();
  }
}
