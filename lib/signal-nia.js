// Nia's news-catalyst signal: a fast, sparse headline read from free RSS feeds.
//
// Design (deliberately simple and honest):
// - Two free public RSS feeds (CoinDesk, CoinTelegraph), fetched with a
//   timeout. Tolerant hand-rolled <item> parsing — no XML dependency.
// - A headline is a catalyst iff it matches a relevance keyword (xrp,
//   ripple, xrpl). Polarity comes from catalyst word lists: a negative
//   word wins over a positive one ("lawsuit dismissed" is handled by
//   letting negative win, then the decay fades the misread).
// - Active catalysts decay with a 12h half-life and drop when their weight
//   falls below 0.05. The tilt is clip(sum of decayed signed weights,
//   ±0.02). Decisive when |bias| >= 0.004.
// - Degraded when BOTH feeds fail AND no live catalysts survive — only
//   then does she abstain. RSS is sparse; she never invents headlines.
// - State persists to <dir>/nia-state.json (best-effort, never throws).
//
// Exact tuning constants live here in code — never in page text or chat.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const NIA_FEEDS = [
  { name: 'coindesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { name: 'cointelegraph', url: 'https://cointelegraph.com/rss' },
];
export const NIA_FETCH_TIMEOUT_MS = 12000;
export const NIA_STATE_FILE = 'nia-state.json';
export const NIA_HALFLIFE_SEC = 12 * 3600;  // 12h half-life: weight *= 0.5^((now-t)/43200)
export const NIA_DROP_WEIGHT = 0.05;        // catalyst drops out below this weight
export const NIA_BIAS_PER_UNIT = 0.01;      // tilt per unit of decayed signed weight
export const NIA_BIAS_MAX = 0.02;           // tilt range [-0.02, +0.02]
export const NIA_DECISIVE = 0.004;          // |bias| above this = decisive read

const RELEVANT = /(xrp|ripple|xrpl)/i;
const POSITIVE = /(approval|approved|launch|listing|listed|partnership|etf|win|victory|adoption)/i;
const NEGATIVE = /(lawsuit|hack|hacked|delist|enforcement|fine|penalty|crash)/i;

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const decayOf = (tCat, nowSec) => Math.pow(0.5, Math.max(0, nowSec - tCat) / NIA_HALFLIFE_SEC);

function stripHtml(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

/** Parse <item> blocks from raw RSS XML. Tolerant, pure. */
export function parseRssItems(xml, source) {
  const out = [];
  try {
    const blocks = String(xml || '').match(/<item>([\s\S]*?)<\/item>/gi) || [];
    for (const b of blocks) {
      const title = stripHtml((b.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
      const pubRaw = stripHtml((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || '');
      const tSec = pubRaw ? Math.floor(Date.parse(pubRaw) / 1000) : NaN;
      if (!title) continue;
      out.push({ title, source: source || 'rss', t: Number.isFinite(tSec) ? tSec : null });
    }
  } catch { /* malformed feed: return what we got */ }
  return out;
}

/** Classify a headline. Returns null when not relevant. */
export function classifyHeadline(title) {
  const t = String(title || '');
  if (!RELEVANT.test(t)) return null;
  const dir = NEGATIVE.test(t) ? -1 : POSITIVE.test(t) ? 1 : 0;
  if (dir === 0) return null; // relevant but unsigned: no catalyst, just noise
  return dir;
}

/**
 * Merge fresh items into the catalyst list, decaying and dropping old ones. Pure.
 * catalysts: [{t, headline, dir, source}]. items: [{title, t, source}].
 */
export function detectCatalysts(items, catalysts, nowSec) {
  const seen = new Set((catalysts || []).map((c) => c.headline));
  const next = [];
  for (const c of catalysts || []) {
    const age = nowSec - c.t;
    if (age < -3600) continue; // future-dated weirdness: keep briefly
    if (decayOf(c.t, nowSec) < NIA_DROP_WEIGHT) continue;
    next.push(c);
  }
  for (const it of items || []) {
    if (!it.title || seen.has(it.title)) continue;
    const dir = classifyHeadline(it.title);
    if (dir == null) continue;
    const t = Number.isFinite(it.t) ? it.t : nowSec;
    next.push({ t, headline: it.title, dir, source: it.source || 'rss' });
    seen.add(it.title);
  }
  return next;
}

/** Pure: the decayed news tilt for this cycle. */
export function computeNewsBias(catalysts, nowSec) {
  let signed = 0;
  const active = [];
  for (const c of catalysts || []) {
    const w = decayOf(c.t, nowSec);
    if (w < NIA_DROP_WEIGHT) continue;
    signed += c.dir * w;
    active.push({ headline: c.headline, dir: c.dir, weight: +w.toFixed(4), t: c.t });
  }
  active.sort((a, b) => b.weight - a.weight);
  const bias = clamp(signed * NIA_BIAS_PER_UNIT, -NIA_BIAS_MAX, NIA_BIAS_MAX);
  return { bias, activeCatalysts: active };
}

async function fetchFeed(feed) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), NIA_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(feed.url, {
      signal: ctl.signal,
      headers: { 'User-Agent': 'building-a-thing-with-infoflow/nia-signal', Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    });
    clearTimeout(to);
    if (!res.ok) return { ok: false, items: [] };
    const xml = await res.text();
    return { ok: true, items: parseRssItems(xml, feed.name) };
  } catch {
    clearTimeout(to);
    return { ok: false, items: [] };
  }
}

function readState(stateDir) {
  try {
    if (!stateDir) return null;
    return JSON.parse(readFileSync(path.join(stateDir, NIA_STATE_FILE), 'utf8'));
  } catch { return null; }
}
function writeState(stateDir, state) {
  try {
    if (!stateDir) return;
    writeFileSync(path.join(stateDir, NIA_STATE_FILE), JSON.stringify(state) + '\n');
  } catch { /* best-effort only */ }
}

/**
 * Nia's per-cycle news-catalyst read. NEVER throws.
 *
 * `dir` is treated as her state directory (where nia-state.json lives);
 * anything non-string is ignored and she runs stateless for the cycle.
 */
export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl } = {}) {
  try {
    const nowSec = t != null ? Math.floor(t / 1000) : Math.floor(Date.now() / 1000);
    const stateDir = typeof dir === 'string' && dir.length ? dir : (typeof process !== 'undefined' && process.env && process.env.NIA_DATA_DIR) || null;

    let prev = null;
    try { prev = readState(stateDir); } catch { prev = null; }
    const prevCatalysts = (prev && Array.isArray(prev.catalysts)) ? prev.catalysts : [];

    const results = await Promise.all(NIA_FEEDS.map(fetchFeed));
    const allItems = results.flatMap((r) => r.items);
    const feedsOk = results.some((r) => r.ok);

    const catalysts = detectCatalysts(allItems, prevCatalysts, nowSec);
    const { bias, activeCatalysts } = computeNewsBias(catalysts, nowSec);

    const degraded = !feedsOk && activeCatalysts.length === 0;
    const catalysts24h = catalysts.filter((c) => nowSec - c.t <= 24 * 3600).length;

    try {
      writeState(stateDir, { updated_at: new Date(nowSec * 1000).toISOString(), catalysts });
    } catch { /* best-effort */ }

    return {
      bias,
      degraded,
      warmingUp: false,
      activeCatalysts,
      catalysts24h,
      feeds: NIA_FEEDS.map((f, i) => ({ name: f.name, ok: !!results[i].ok, items: results[i].items.length })),
    };
  } catch {
    // absolute last resort: abstain honestly
    return { bias: 0, degraded: true, warmingUp: false, activeCatalysts: [], catalysts24h: 0, feeds: [] };
  }
}
