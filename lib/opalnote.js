// Opal's lab notebook — one honest per-cycle record of the
// order-book-depth experiment. Pure function, no I/O: safe to unit test.
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

export const OPAL_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to opal-log.jsonl on
// the data branch and kept forever. Opal keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatOpalLogLine(note) { return JSON.stringify(note); }
export function parseOpalLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A book read counts as "decisive" when it takes a real side, not a whisper. */
export function isDecisiveOpal(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  return Math.abs(computed.imbalance || 0) >= 0.15;
}

export function buildOpalNote({ signal, scoreboard, cycle, barT }) {
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
      ? 'Coinbase book API unreachable or returned a broken book — I saw nothing this cycle, so I abstained rather than guessing'
      : 'Coinbase book API reachable — a real level-2 book read this cycle',
  });
  if (healthy) {
    const spreadSane = Number.isFinite(d.spreadBps) && d.spreadBps >= 0;
    checks.push({
      name: 'book quality',
      pass: spreadSane,
      detail: spreadSane
        ? `top-of-book spread sane (${d.spreadBps.toFixed(1)} bps) — the book looked tradable, not broken`
        : 'spread unreadable — a broken book is worse than no book, so I abstained',
    });
    const decisive = isDecisiveOpal({ imbalance: d.imbalance, warming_up: false, degraded: false });
    checks.push({
      name: 'book regime',
      pass: decisive,
      detail: decisive
        ? `decisive read: imbalance ${(d.imbalance >= 0 ? '+' : '')}${(d.imbalance * 100).toFixed(1)}% (${d.imbalance > 0 ? 'bid-side heavy — resting demand outweighs supply' : 'ask-side heavy — resting supply outweighs demand'}), bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}`
        : 'quiet — resting interest roughly balanced on both sides, the book took no side',
    });
    checks.push({
      name: 'usable depth',
      pass: (d.depthBid || 0) + (d.depthAsk || 0) > 0,
      detail: `resting notional within 1% of mid: ${(d.depthBid || 0) >= 1000 ? ((d.depthBid || 0) / 1000).toFixed(0) + 'K' : Math.round(d.depthBid || 0)} bids vs ${(d.depthAsk || 0) >= 1000 ? ((d.depthAsk || 0) / 1000).toFixed(0) + 'K' : Math.round(d.depthAsk || 0)} asks (USD) — deep books absorb pressure, thin ones don't`,
    });
  }
  const sb = scoreboard || null;
  if (sb && sb.n >= 30) {
    const edge = sb.brierMember < sb.brierBase;
    const hz = sb.horizons || null;
    const hzTxt = hz && hz.h5 && hz.h5.n >= 30 && hz.h15 && hz.h15.n >= 30
      ? `; horizon decay: 5m direction hit ${(hz.h5.hitRate * 100).toFixed(1)}% (n=${hz.h5.n}) vs 15m ${(hz.h15.hitRate * 100).toFixed(1)}% (n=${hz.h15.n}) — imbalance is documented to fade within minutes, so I report where mine dies`
      : '; horizon decay: still collecting paired 5m/15m resolutions';
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `order-book member Brier ${sb.brierMember.toFixed(5)} vs baseline ${sb.brierBase.toFixed(5)} over n=${sb.n} scored forecasts${sb.skill24h && sb.skill24h.n >= 30 ? `; 24h direction hit rate ${(sb.skill24h.hitRate * 100).toFixed(1)}% (n=${sb.skill24h.n})` : ''}${hzTxt}`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = 'The book was unreachable or unreadable this cycle — I saw nothing, so I abstained. A blind depth chart reports nothing.';
    verdictWhy = 'No honest measurement, no signal, no effect. I would rather say "I don\'t know" than invent a number.';
  } else if (isDecisiveOpal({ imbalance: d.imbalance, warming_up: false, degraded: false })) {
    verdict = 'useful';
    const dir = d.imbalance > 0
      ? 'demand-heavy (bids outweigh asks — resting demand pressure, bullish tilt)'
      : 'supply-heavy (asks outweigh bids — resting supply pressure, bearish tilt)';
    finding = `Real book signal this cycle: ${dir}, imbalance ${(d.imbalance >= 0 ? '+' : '')}${(d.imbalance * 100).toFixed(1)}% with a ${(d.spreadBps).toFixed(1)} bps spread. Bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}.`;
    verdictWhy = 'The book took a genuine side and the feed is healthy — this is the regime my lab exists to catch.';
  } else {
    verdict = 'not useful';
    finding = 'Quiet cycle — resting interest roughly balanced on both sides and no strong one-sided pressure. Nothing to report, so I abstain. Most cycles are quiet; that is normal and honest.';
    verdictWhy = 'A weak read confidently applied is worse than no read. The book is calm and I say so.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && Math.abs(d.bias) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(2)}: the order-book tilt nudged the forecast ${d.bias > 0 ? 'up' : 'down'} this cycle.`,
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
      source: 'Coinbase public level-2 order-book API (no keys)',
      window: 'one book snapshot each cycle: top levels by notional, top-of-book quotes, depth within 1% of mid',
      snapshots: null,
      pipeline: 'top-of-book -> mid and spread -> notional imbalance across the visible levels -> depth within 1% of mid -> small scaled tilt',
    },
    computed: d ? {
      bias: d.bias,
      imbalance: d.imbalance,
      spread_bps: d.spreadBps,
      depth_bid: d.depthBid,
      depth_ask: d.depthAsk,
      levels: d.levels || null,
      warming_up: warmingUp,
      degraded,
      decisive: healthy && isDecisiveOpal({ imbalance: d.imbalance, warming_up: false, degraded: false }),
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
