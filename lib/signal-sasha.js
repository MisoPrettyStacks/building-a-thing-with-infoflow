// Sasha's sentiment signal — public crypto-chatter feeds, read-only, no keys.
//
// Reddit's public JSON 403s server IPs (including GitHub Actions), so Sasha
// now reads a cascade of free public chatter sources, first working source
// wins:
//
//   1. StockTwits public symbol stream (no keys):
//      https://api.stocktwits.com/api/2/streams/symbol/XRP.json?limit=30
//      Real trader messages; many carry an EXPLICIT bullish/bearish tag,
//      which is counted directly alongside the mood-word lexicon.
//   2. Reddit public JSON (r/XRP + r/CryptoCurrency) — kept as a fallback;
//      it works from some networks.
//
// Every cycle: fetch newest messages/titles, count explicit sentiment tags
// plus pre-registered mood words, and turn the mood score into a small
// regime tilt by normalizing against recent history. Deliberately tiny:
// social mood is the noisiest feed in the model, so its mathematical
// footprint stays small by design. Never throws — returns degraded state.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const STOCKTWITS_FEEDS = [
  'https://api.stocktwits.com/api/2/streams/symbol/XRP.json?limit=30',
];
const REDDIT_FEEDS = [
  'https://www.reddit.com/r/XRP/new.json?limit=25',
  'https://www.reddit.com/r/CryptoCurrency/new.json?limit=25',
];
const UA = 'building-a-thing-with-agents/sasha-supervisor';
const FETCH_TIMEOUT_MS = 12000;
const HISTORY_CAP = 60;

// Pre-registered lexicon, frozen before testing. Never tuned on outcomes.
// (Exact counts and calibration live in code; the page speaks conceptually.)
const POSITIVE_WORDS = [
  'moon', 'mooning', 'bullish', 'bull', 'rally', 'pump', 'pumping', 'surge',
  'surging', 'rocket', 'breakout', 'gains', 'green', 'hodl', 'buy', 'buying',
  'accumulate', 'accumulation', 'undervalued', 'adoption', 'partnership',
  'upgrade', 'ath', 'skyrocket', 'explode', 'moonshot', 'gem', 'lambo',
  'diamond', 'bounce', 'rebound', 'recovery', 'recovering', 'optimistic',
  'optimism', 'confidence', 'confident', 'strong', 'strength', 'support',
  'holding',
];
const NEGATIVE_WORDS = [
  'bearish', 'bear', 'dump', 'dumping', 'dumped', 'crash', 'crashing',
  'sell', 'selling', 'sold', 'scam', 'rug', 'fraud', 'fud', 'fear', 'panic',
  'red', 'bleeding', 'dead', 'dying', 'collapse', 'plummet', 'tanking',
  'hack', 'lawsuit', 'sec', 'banned', 'delist', 'warning', 'bubble', 'ponzi',
  'overvalued', 'correction', 'worthless', 'downfall', 'regulators',
  'manipulation', 'capitulation', 'breakdown', 'weak',
];

const posRe = new RegExp('\\b(' + POSITIVE_WORDS.join('|') + ')\\b', 'gi');
const negRe = new RegExp('\\b(' + NEGATIVE_WORDS.join('|') + ')\\b', 'gi');

function countHits(re, text) {
  re.lastIndex = 0;
  const m = text.match(re);
  return m ? m.length : 0;
}

async function fetchJson(url, extraHeaders) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json', ...(extraHeaders || {}) },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

/** StockTwits: [{ text, explicit }] where explicit is +1 (bullish), -1 (bearish), 0 (none). */
async function fetchStockTwits() {
  const out = [];
  const results = await Promise.all(STOCKTWITS_FEEDS.map((u) => fetchJson(u)));
  for (const j of results) {
    const msgs = j && Array.isArray(j.messages) ? j.messages : [];
    for (const m of msgs) {
      const body = m && typeof m.body === 'string' ? m.body : '';
      if (!body.trim()) continue;
      const tag = m && m.entities && m.entities.sentiment && m.entities.sentiment.basic;
      const explicit = tag === 'Bullish' ? 1 : tag === 'Bearish' ? -1 : 0;
      out.push({ text: body, explicit });
    }
  }
  return out;
}

async function fetchTitles(url) {
  const j = await fetchJson(url);
  if (!j) return [];
  const kids = j && j.data && Array.isArray(j.data.children) ? j.data.children : [];
  return kids.map((k) => (k && k.data && typeof k.data.title === 'string' ? k.data.title : '')).filter(Boolean);
}

function loadState(dir) {
  if (!dir) return { rawScores: [] };
  try {
    const p = path.join(dir, 'sasha-state.json');
    if (!existsSync(p)) return { rawScores: [] };
    const j = JSON.parse(readFileSync(p, 'utf8'));
    const rs = Array.isArray(j.rawScores) ? j.rawScores.filter(Number.isFinite) : [];
    return { rawScores: rs.slice(-HISTORY_CAP) };
  } catch {
    return { rawScores: [] };
  }
}

function saveState(dir, state) {
  if (!dir) return;
  try {
    writeFileSync(path.join(dir, 'sasha-state.json'), JSON.stringify({ rawScores: state.rawScores.slice(-HISTORY_CAP) }) + '\n');
  } catch { /* best-effort only */ }
}

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Sasha's mood signal. Never throws.
 * @returns {{ bias:number, degraded:boolean, warmingUp:boolean, rawScore:number, z:number, postsScanned:number }}
 */
export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl } = {}) {
  try {
    // Primary: StockTwits (explicit sentiment tags + bodies). Fallback: Reddit titles.
    const stMsgs = await fetchStockTwits();
    let items; // [{ text, explicit }]
    let source;
    if (stMsgs.length > 0) {
      items = stMsgs;
      source = 'stocktwits';
    } else {
      const [a, b] = await Promise.all([fetchTitles(REDDIT_FEEDS[0]), fetchTitles(REDDIT_FEEDS[1])]);
      items = [...a, ...b].map((title) => ({ text: title, explicit: 0 }));
      source = 'reddit';
    }
    const postsScanned = items.length;
    if (postsScanned === 0) {
      return { bias: 0, degraded: true, warmingUp: false, rawScore: 0, z: 0, postsScanned: 0 };
    }
    let pos = 0, neg = 0, expPos = 0, expNeg = 0;
    for (const it of items) {
      if (it.explicit > 0) expPos++;
      else if (it.explicit < 0) expNeg++;
      const low = String(it.text).toLowerCase();
      pos += countHits(posRe, low);
      neg += countHits(negRe, low);
    }
    const rawScore = (expPos - expNeg + pos - neg) / (expPos + expNeg + pos + neg + 5);

    const state = loadState(dir);
    state.rawScores.push(Math.round(rawScore * 1e5) / 1e5);
    saveState(dir, state);
    const hist = state.rawScores;

    // z: robust normalization against recent history; needs a real sample.
    let z = 0;
    if (hist.length >= 10) {
      const med = median(hist);
      const mad = median(hist.map((x) => Math.abs(x - med)));
      const scale = Math.max(mad * 1.4826, 0.02);
      z = scale > 0 ? (rawScore - med) / scale : 0;
      if (!Number.isFinite(z)) z = 0;
    }
    // deliberately small: social mood is the noisiest feed in the model.
    const bias = Math.max(-0.012, Math.min(0.012, z * 0.008));
    return { bias, degraded: false, warmingUp: false, rawScore, z, postsScanned, source, expPos, expNeg };
  } catch {
    return { bias: 0, degraded: true, warmingUp: false, rawScore: 0, z: 0, postsScanned: 0 };
  }
}
