// Cora's lab notebook — one honest per-cycle record of the
// cross-asset momentum experiment. Pure function, no I/O: safe to unit test.
//
// Each note answers, in plain English:
//   1. What data was collected this cycle?
//   2. What was computed from it?
//   3. What did the agent find?
//   4. Is it useful — how and why (or why not)?
//   5. What mathematical effect did it have on the forecast?
//
// Saved to the data branch every cycle whether or not the member is used.
// Exact thresholds stay in code; user-facing prose stays conceptual.

export const CORA_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to cora-log.jsonl on
// the data branch and kept forever. Cora keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatCoraLogLine(note) { return JSON.stringify(note); }
export function parseCoraLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A momentum read counts as "decisive" when it is expressive, not a whisper. */
export function isDecisiveCora(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  return Math.abs(computed.bias || 0) >= 0.004;
}

function bp(x) {
  // mean log-return per 5-minute bar, rendered as basis points — a measured value
  if (x == null || !Number.isFinite(x)) return '—';
  return (x * 1e4 >= 0 ? '+' : '') + (x * 1e4).toFixed(1) + ' bp/bar';
}

export function buildCoraNote({ signal, scoreboard, cycle, barT }) {
  const t = new Date().toISOString();
  const d = signal || null;
  const degraded = !d || !!d.degraded;
  const warmingUp = !!d && !!d.warmingUp;
  const healthy = !degraded && !warmingUp;

  const checks = [];
  checks.push({
    name: 'feed health',
    pass: !degraded,
    detail: degraded
      ? 'Coinbase candle API unreachable or returned junk — the market was blind this cycle, so I abstained rather than guessing'
      : 'Coinbase public candle API reachable — ETH-USD and SOL-USD 5-minute candles read, no keys',
  });
  checks.push({
    name: 'history depth',
    pass: !warmingUp,
    detail: warmingUp
      ? 'candle history still building — the volatility scale needs a full day of history before the read means anything, so I abstain'
      : 'a full day+ of candle history on record — the momentum-vs-volatility comparison is honest',
  });
  if (healthy) {
    const momETH = d.momETH, momSOL = d.momSOL;
    const agree = momETH != null && momSOL != null && Number.isFinite(momETH) && Number.isFinite(momSOL)
      ? (momETH > 0 && momSOL > 0) || (momETH < 0 && momSOL < 0)
      : null;
    const decisive = isDecisiveCora({ bias: d.bias, warming_up: false, degraded: false });
    checks.push({
      name: 'momentum regime',
      pass: decisive,
      detail: decisive
        ? `decisive read: cross-asset tilt ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)} (${d.bias > 0 ? 'broad-market tailwind — ETH and SOL drifting up together' : 'broad-market headwind — ETH and SOL drifting down together'})${agree != null ? (agree ? ' · ETH and SOL agree' : ' · ETH and SOL disagree — spillover story is weaker') : ''}`
        : `quiet — ETH momentum ${bp(momETH)}, SOL momentum ${bp(momSOL)}: nothing expressive enough to call a regime`,
    });
    checks.push({
      name: 'asset agreement',
      pass: agree === true,
      detail: agree == null
        ? 'momentum values unavailable this cycle'
        : agree
          ? `ETH and SOL point the same way — spillover is a broad-market story, and the broad market is speaking`
          : `ETH (${bp(momETH)}) and SOL (${bp(momSOL)}) point different ways — no unified market drift, so there is little to spill over`,
    });
  }
  const sb = scoreboard || null;
  if (sb && sb.n >= 30) {
    const brierM = Number.isFinite(sb.brierMember) ? sb.brierMember : null;
    const brierB = Number.isFinite(sb.brierBase) ? sb.brierBase : null;
    const edge = brierM != null && brierB != null && brierM < brierB;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: (brierM != null && brierB != null)
        ? `cross-asset member Brier ${brierM.toFixed(5)} vs baseline ${brierB.toFixed(5)} over n=${sb.n} scored forecasts${sb.skill24h && sb.skill24h.n >= 30 ? `; 24h direction hit rate ${(sb.skill24h.hitRate * 100).toFixed(1)}% (n=${sb.skill24h.n})` : ''}`
        : `scoreboard values unavailable — n=${sb.n} scored forecasts on record`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = degraded
      ? 'The candle feed was unreachable or returned junk this cycle — I was blind, so I abstained. A blind watchtower reports nothing.'
      : 'My candle history is still building — the volatility scale needs a full day before the momentum comparison means anything, so I abstain rather than invent a read.';
    verdictWhy = 'No honest measurement, no signal, no effect. I would rather say "I don\'t know" than invent a number.';
  } else if (isDecisiveCora({ bias: d.bias, warming_up: false, degraded: false })) {
    verdict = 'useful';
    const dir = d.bias > 0 ? 'tailwind (broad momentum up — spillover favors XRP up)' : 'headwind (broad momentum down — spillover favors XRP down)';
    finding = `Real cross-asset signal this cycle: ${dir}, tilt ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}. ETH trailing-hour drift ${bp(d.momETH)}, SOL ${bp(d.momSOL)} — each measured against its own trailing-day volatility so the two are comparable. Masha measures information flow; I measure price flow — and the price is flowing.`;
    verdictWhy = 'The momentum read is decisive and the feed is healthy — this is the regime my lab exists to catch.';
  } else {
    verdict = 'not useful';
    finding = `Quiet cycle — ETH ${bp(d.momETH)} and SOL ${bp(d.momSOL)} momentum inside neutral bounds. Nothing expressive, so I abstain. Most cycles are quiet; that is normal and honest.`;
    verdictWhy = 'A weak read confidently applied is worse than no read. The majors are calm and I say so.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && Math.abs(d.bias) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(2)}: the cross-asset tilt nudged the forecast ${d.bias > 0 ? 'up' : 'down'} this cycle.`,
    };
  } else if (weight > 0) {
    mathEffect = { effect: 'none', detail: `Weight is ${weight.toFixed(2)} but I abstained (no decisive read) — an abstention changes nothing mathematically.` };
  } else {
    mathEffect = { effect: 'none', detail: 'No mathematical effect on the forecast — my member weight is 0, so I am scored but never blended in.' };
  }

  return {
    t,
    cycle,
    bar_t: barT,
    collected: {
      source: 'Coinbase public exchange API (no keys)',
      products: 'ETH-USD + SOL-USD',
      window: '5-minute candles: trailing-hour drift per asset vs its own trailing-day volatility',
      candles: d && d.candleCount != null ? d.candleCount : null,
      pipeline: 'public candles → trailing-hour mean drift → standardized by own volatility → blended cross-asset tilt',
    },
    computed: {
      bias: d ? d.bias : null,
      mom_eth: d ? d.momETH : null,
      mom_sol: d ? d.momSOL : null,
      warming_up: warmingUp,
      degraded,
      decisive: healthy && isDecisiveCora({ bias: d.bias, warming_up: false, degraded: false }),
    },
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
