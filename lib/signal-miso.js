// Miso's signal: her guess for the current 15-minute frame.
//
// She works at her computer and answers one question per frame, both
// ways: will XRP be above the reference price one minute before the
// frame closes — and will it be below? She goes with whichever answer
// comes back more probable, and that lean is her bias. How the answers
// are produced is her method, and her method is not published — not in
// this file's prose, not on the page, not in her chat.
//
// Best-effort: this function NEVER throws. An unreachable desk returns
// a degraded state with bias 0; too little price history warms up.

const FORECASTER_BASE = 'https://forecaster-5wv4.onrender.com';
const FRAME_S = 900;              // the 15-minute frame she guesses on
const LEAD_S = 60;                // her question is about one minute before the close
const MIN_BARS = 2;               // need a reference close to name a price
const BIAS_CAP = 0.02;            // absolute cap on the emitted bias
const BIAS_GAIN = 0.08;           // how much of her lean reaches the bias

function clip(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function extractProbability(doc) {
  if (doc == null || typeof doc !== 'object') return null;
  const cand = [
    doc.probability, doc.p, doc.prob, doc.pAbove, doc.p_above,
    doc.answer && doc.answer.probability, doc.answer && doc.answer.p,
    doc.result && doc.result.probability, doc.forecast && doc.forecast.probability,
  ];
  for (const v of cand) {
    if (Number.isFinite(v)) {
      if (v > 1 && v <= 100) return v / 100;
      if (v >= 0 && v <= 1) return v;
    }
  }
  if (typeof doc.text === 'string') {
    const m = doc.text.match(/(\d+(?:\.\d+)?)\s*%/);
    if (m) return clip(parseFloat(m[1]) / 100, 0, 1);
  }
  return null;
}

async function ask(getJson, question) {
  if (typeof getJson !== 'function') return null;
  const urls = [
    `${FORECASTER_BASE}/api/ask?q=${encodeURIComponent(question)}`,
    `${FORECASTER_BASE}/api/forecast?question=${encodeURIComponent(question)}`,
  ];
  for (const u of urls) {
    try {
      const doc = await getJson(u);
      const p = extractProbability(doc);
      if (p != null) return p;
    } catch { /* try the next shape, then give up honestly */ }
  }
  return null;
}

function fmtTimeET(ts) {
  try {
    return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
  } catch { return ''; }
}

export async function fetchSignal({ t, bars, getJson }) {
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
    const when = fmtTimeET(targetT);

    const pAbove = await ask(getJson, `Will XRP be above ${thr} at ${when}?`);
    const pBelow = await ask(getJson, `Will XRP be below ${thr} at ${when}?`);
    if (pAbove == null && pBelow == null) {
      // Her screen is dark: no answer either way. Abstain honestly.
      return { bias: 0, degraded: true, warmingUp: false, guess: null, threshold, targetT, pAbove: null, pBelow: null };
    }
    let pA = pAbove, pB = pBelow;
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
