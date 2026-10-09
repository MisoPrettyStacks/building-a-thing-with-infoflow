// Miso's signal: her guess for the current 15-minute frame.
//
// She works at her computer and answers one question per frame, both
// ways: will XRP be above the reference price one minute before the
// frame closes — and will it be below? She goes with whichever answer
// comes back more probable, and that lean is her bias. How the answers
// are produced is her method, and her method is not published — not in
// this file's prose, not on the page, not in her chat.
//
// Answers arrive as a streamed response; the full answer text is in
// hand before the stream closes, whether or not what happens after
// the answer succeeds. One answer per question per frame — repeat
// cycles inside the same frame reuse it instead of asking again.
//
// Best-effort: this function NEVER throws. An unreachable desk returns
// a degraded state with bias 0; too little price history warms up.

const FORECASTER_BASE = 'https://forecaster-5wv4.onrender.com';
const FRAME_S = 900;              // the 15-minute frame she guesses on
const LEAD_S = 60;                // her question is about one minute before the close
const MIN_BARS = 2;               // need a reference close to name a price
const BIAS_CAP = 0.02;            // absolute cap on the emitted bias
const BIAS_GAIN = 0.08;           // how much of her lean reaches the bias
const ASK_TIMEOUT_MS = 210000;    // her desk is thorough; allow for it

// frameEnd -> { pAbove, pBelow } | { failed: true }
const frameCache = new Map();

function clip(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function extractProbability(text) {
  if (typeof text !== 'string' || !text) return null;
  const m = text.match(/Probability:\s*\**\s*==?\s*(\d+(?:\.\d+)?)\s*%\s*==?\s*\**/i)
    || text.match(/Probability:\s*(\d+(?:\.\d+)?)\s*%/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!Number.isFinite(v)) return null;
  return clip(v / 100, 0, 1);
}

async function askStream(question, resolveByIso, resolutionCriteria) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), ASK_TIMEOUT_MS);
  try {
    const res = await fetch(`${FORECASTER_BASE}/api/forecasts/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ question, resolveBy: resolveByIso, resolutionCriteria }),
      signal: ctl.signal,
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let text = '';
    let doneText = null;
    let doneProb = null;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const evMatch = raw.match(/^event:\s*(.+)$/m);
        const dataMatch = raw.match(/^data:\s*(.+)$/m);
        if (!dataMatch) continue;
        let data = null;
        try { data = JSON.parse(dataMatch[1]); } catch { data = null; }
        if (!data) continue;
        const ev = evMatch ? evMatch[1].trim() : '';
        if (ev === 'chunk' && typeof data.text === 'string') text += data.text;
        else if (ev === 'done') {
          if (typeof data.analysis === 'string') doneText = data.analysis;
          if (Number.isFinite(data.probability)) doneProb = clip(data.probability, 0, 1);
        }
      }
    }
    if (doneProb != null) return doneProb;
    const full = doneText || text;
    return extractProbability(full);
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

function fmtWhenET(ts) {
  try {
    return new Date(ts * 1000).toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
    }) + ' ET';
  } catch { return ''; }
}

export async function fetchSignal({ t, bars }) {
  const warming = () => ({
    bias: 0, degraded: false, warmingUp: true,
    guess: null, threshold: null, targetT: null, pAbove: null, pBelow: null,
  });
  try {
    const xs = Array.isArray(bars) ? bars : [];
    const byT = new Map();
    for (const b of xs) {
      if (b == null || !Number.isFinite(b.t) || !Number.isFinite(b.c) || b.c <= 0) continue;
      byT.set(b.t, b);
    }
    const clean = [...byT.values()].sort((a, b) => a.t - b.t);
    if (clean.length < MIN_BARS || !Number.isFinite(t)) return warming();

    const threshold = clean[clean.length - 1].c;
    const frameEnd = (Math.floor(t / FRAME_S) + 1) * FRAME_S;
    const targetT = frameEnd - LEAD_S;
    const thr = '$' + threshold.toFixed(4);
    const when = fmtWhenET(targetT);

    let cached = frameCache.get(frameEnd);
    if (!cached) {
      const resolveByIso = new Date(targetT * 1000).toISOString();
      const pAbove = await askStream(
        `Will XRP be above ${thr} at ${when}?`,
        resolveByIso,
        `YES if the XRP/USD price is above ${thr} at ${when}; otherwise NO.`,
      );
      const pBelow = await askStream(
        `Will XRP be below ${thr} at ${when}?`,
        resolveByIso,
        `YES if the XRP/USD price is below ${thr} at ${when}; otherwise NO.`,
      );
      cached = (pAbove == null && pBelow == null)
        ? { failed: true }
        : { pAbove, pBelow };
      frameCache.set(frameEnd, cached);
      // keep the cache to the current frame only
      for (const k of frameCache.keys()) if (k !== frameEnd) frameCache.delete(k);
    }
    if (cached.failed) {
      // Her screen is dark: no answer either way. Abstain honestly.
      return { bias: 0, degraded: true, warmingUp: false, guess: null, threshold, targetT, pAbove: null, pBelow: null };
    }
    let pA = cached.pAbove, pB = cached.pBelow;
    if (pA == null) pA = 1 - pB;
    if (pB == null) pB = 1 - pA;
    const sum = pA + pB;
    const pAN = sum > 0 ? pA / sum : 0.5;
    const guess = pAN >= 0.5 ? 'above' : 'below';
    let bias = clip((pAN - 0.5) * BIAS_GAIN * 2, -BIAS_CAP, BIAS_CAP);
    if (!Number.isFinite(bias)) bias = 0;

    return {
      bias,
      degraded: false,
      warmingUp: false,
      guess,
      threshold,
      targetT,
      pAbove: pA,
      pBelow: pB,
    };
  } catch {
    return { bias: 0, degraded: true, warmingUp: false, guess: null, threshold: null, targetT: null, pAbove: null, pBelow: null };
  }
}
