// Violet's lab notebook — one honest per-cycle record of the
// volatility-regime experiment. Pure function, no I/O: safe to unit test.
//
// Each note answers, in plain English:
//   1. What data was collected this cycle?
//   2. What was computed from it?
//   3. What did the agent find?
//   4. Is it useful — how and why (or why not)?
//   5. What mathematical effect did it have on the forecast?
//
// Saved to the data branch every cycle whether or not the dampener is used.
// Exact thresholds stay in code; user-facing prose stays conceptual.
// Violet nominates a DAMPENER (confidence shrinks toward 0.5), never a
// directional vote: her math_effect can never lean the forecast up or down.

export const VIOLET_PAGE_WINDOW = 120; // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to violet-log.jsonl
// on the data branch and kept forever. Violet keeps working until Angelica
// says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatVioletLogLine(note) { return JSON.stringify(note); }
export function parseVioletLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A volatility read counts as "decisive" when the regime is wild: only wild
 *  regimes can ever arm the dampener, so only they count as decisive. */
export function isDecisiveViolet(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  return computed.regime === 'wild';
}

export function buildVioletNote({ signal, scoreboard, cycle, barT }) {
  const t = new Date().toISOString();
  const d = signal || null;
  const degraded = !d || !!d.degraded;
  const warmingUp = !!d && !!d.warmingUp;
  const healthy = !degraded && !warmingUp;
  const regime = d && d.regime ? d.regime : 'unknown';

  const checks = [];
  checks.push({
    name: 'feed health',
    pass: !degraded,
    detail: degraded
      ? 'the candle feed was unreadable this cycle — I abstained rather than guessing; a blind lab reports nothing'
      : 'candle feed readable — realized volatility measured from the lab\u2019s own closed candles',
  });
  checks.push({
    name: 'history depth',
    pass: !warmingUp,
    detail: warmingUp
      ? 'candle history still building — a regime baseline needs several days of history, so I abstain'
      : 'several days of candle history on record — the regime baseline is honest',
  });
  if (healthy) {
    const decisive = isDecisiveViolet({ regime, warming_up: false, degraded: false });
    checks.push({
      name: 'volatility regime',
      pass: decisive,
      detail: decisive
        ? 'WILD regime: current realized volatility is running well above its own baseline — this is the regime my dampener exists for'
        : `${regime === 'calm' ? 'calm' : 'normal'} regime: volatility near or below its baseline — the dampener stays parked`,
    });
  }
  const sb = scoreboard || null;
  if (sb && sb.n >= 30) {
    const edge = sb.brierMember < sb.brierBase;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `dampener what-if Brier ${sb.brierMember.toFixed(5)} vs baseline ${sb.brierBase.toFixed(5)} over n=${sb.n} scored forecasts`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = degraded
      ? 'The candle feed was unreadable this cycle — I was blind, so I abstained. A blind watchtower reports nothing.'
      : 'My candle history is still building — the regime baseline needs several days of data before a wild call means anything, so I abstain rather than invent a read.';
    verdictWhy = 'No honest measurement, no regime read, no dampening. I would rather say "I don\u2019t know" than invent a number.';
  } else if (isDecisiveViolet({ regime, warming_up: false, degraded: false })) {
    verdict = 'dampening';
    finding = `WILD volatility regime this cycle: realized volatility is running well above its recent baseline (current reads ${d.volNow != null ? d.volNow.toFixed(4) : '\u2014'} vs baseline ${d.volMedian != null ? d.volMedian.toFixed(4) : '\u2014'}). Confidence should shrink toward 0.5 — the honest forecast admits it knows less when the market is thrashing.`;
    verdictWhy = 'The regime read is wild and the feed is healthy — this is the regime my lab exists to catch. I nominate the dampener; I never predict direction.';
  } else {
    verdict = 'standby';
    finding = `${regime === 'calm' ? 'Calm' : 'Normal'} regime this cycle — volatility near or below its baseline, so there is nothing to dampen. The dampener stays parked and the forecast keeps its full confidence. Most cycles are like this; that is normal and honest.`;
    verdictWhy = 'A dampener that cries wolf in calm weather dulls every forecast it touches. The market is quiet, and I say so.';
  }

  const dampenerOn = (d && d.dampenerOn) || false;
  let mathEffect;
  if (dampenerOn && regime === 'wild') {
    mathEffect = {
      effect: 'applied',
      detail: 'The volatility dampener is armed this cycle: the forecast\u2019s deviation from 0.5 was shrunk, so it admitted uncertainty in the wild regime. It cannot move the probability up or down — dampening is directionless by design.',
    };
  } else if (dampenerOn) {
    mathEffect = { effect: 'none', detail: 'The dampener is armed but the regime is not wild — a dampener with nothing to dampen changes nothing mathematically.' };
  } else {
    mathEffect = { effect: 'none', detail: 'No mathematical effect on the forecast — the volatility dampener carries weight 0, so I am scored but never blended in.' };
  }

  return {
    t,
    cycle,
    bar_t: barT,
    collected: {
      source: 'the lab\u2019s own 5-minute candles (no keys, no outside feed)',
      window: 'realized volatility over the trailing window vs its own rolling baseline',
      history_note: 'regime baseline needs several days of candle history',
    },
    computed: d ? {
      regime,
      vol_now: d.volNow,
      vol_median: d.volMedian,
      warming_up: warmingUp,
      degraded,
      decisive: healthy && isDecisiveViolet({ regime, warming_up: false, degraded: false }),
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
