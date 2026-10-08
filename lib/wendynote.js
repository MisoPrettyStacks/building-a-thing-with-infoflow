// Wendy's lab notebook — one honest per-cycle record of the
// whale-watch experiment. Pure function, no I/O: safe to unit test.
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

export const WENDY_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to wendy-log.jsonl on
// the data branch and kept forever. Wendy keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatWendyLogLine(note) { return JSON.stringify(note); }
export function parseWendyLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A flow read counts as "decisive" when it is expressive, not a whisper. */
export function isDecisiveFlow(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  const b = Math.abs(computed.bias || 0);
  return b >= 0.004 || (computed.active_pulses || 0) > 0;
}

export function buildWendyNote({ onchain, scoreboardOnchain, cycle, barT, watchlistSize }) {
  const t = new Date().toISOString();
  const d = onchain || null;
  const degraded = !d || !!d.degraded;
  const warmingUp = !!d && !!d.warmingUp;
  const healthy = !degraded && !warmingUp;

  const checks = [];
  checks.push({
    name: 'feed health',
    pass: !degraded,
    detail: degraded
      ? 'XRPL cluster unreachable — the ledger was blind this cycle, so I abstained rather than guessing'
      : 'XRPL cluster reachable — balances and payments read from the public ledger',
  });
  checks.push({
    name: 'history depth',
    pass: !warmingUp,
    detail: warmingUp
      ? 'snapshot history still building — flows need a full day of history before I trust them, so I abstain'
      : 'a full day+ of balance snapshots on record — flow comparisons are honest',
  });
  if (healthy) {
    const decisive = isDecisiveFlow({ bias: d.bias, active_pulses: d.activePulses, warming_up: false, degraded: false });
    checks.push({
      name: 'flow regime',
      pass: decisive,
      detail: decisive
        ? `decisive read: bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)} (${d.bias > 0 ? 'accumulation — coins leaving exchanges' : d.bias < 0 ? 'distribution — coins arriving at exchanges' : 'neutral'})${d.activePulses ? `, ${d.activePulses} whale pulse${d.activePulses > 1 ? 's' : ''} active` : ''}`
        : 'quiet — flows inside neutral bounds and no whale pulses active',
    });
    checks.push({
      name: 'whale activity',
      pass: (d.activePulses || 0) > 0,
      detail: (d.activePulses || 0) > 0
        ? `${d.activePulses} large-transfer pulse${d.activePulses > 1 ? 's' : ''} still echoing (each fades over about two days)`
        : 'no large transfers touching the watchlist recently',
    });
  }
  const sb = scoreboardOnchain || null;
  if (sb && sb.n >= 30) {
    const edge = sb.brierOnchain < sb.brierBase;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `whale-flow member Brier ${sb.brierOnchain.toFixed(5)} vs baseline ${sb.brierBase.toFixed(5)} over n=${sb.n} scored forecasts${sb.skill24h && sb.skill24h.n >= 30 ? `; 24h direction hit rate ${(sb.skill24h.hitRate * 100).toFixed(1)}% (n=${sb.skill24h.n})` : ''}`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = degraded
      ? 'The ledger feed was unreachable this cycle — I was blind, so I abstained. A blind watchtower reports nothing.'
      : 'My snapshot history is still building — I need a full day of balance history before flow comparisons mean anything, so I abstain rather than invent a read.';
    verdictWhy = 'No honest measurement, no signal, no effect. I would rather say "I don\'t know" than invent a number.';
  } else if (isDecisiveFlow({ bias: d.bias, active_pulses: d.activePulses, warming_up: false, degraded: false })) {
    verdict = 'useful';
    const dir = d.bias > 0 ? 'accumulation (coins draining out of exchanges — bullish tilt)' : d.bias < 0 ? 'distribution (coins piling into exchanges — bearish tilt)' : 'whale-pulse driven';
    finding = `Real flow signal this cycle: ${dir}, bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}${d.activePulses ? ` with ${d.activePulses} whale pulse${d.activePulses > 1 ? 's' : ''} active` : ''}. The 24h net exchange flow is ${d.netFlow24h != null ? `${d.netFlow24h >= 0 ? '+' : ''}${Math.abs(d.netFlow24h) >= 1e6 ? (d.netFlow24h / 1e6).toFixed(1) + 'M' : Math.round(d.netFlow24h)} XRP` : 'unavailable'}.`;
    verdictWhy = 'The flow read is decisive and the feed is healthy — this is the regime my lab exists to catch.';
  } else {
    verdict = 'not useful';
    finding = 'Quiet cycle — exchange flows inside neutral bounds, no whale pulses active. Nothing to report, so I abstain. Most cycles are quiet; that is normal and honest.';
    verdictWhy = 'A weak read confidently applied is worse than no read. The ledger is calm and I say so.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && Math.abs(d.bias) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(2)}: the whale-flow tilt nudged the forecast ${d.bias > 0 ? 'up' : 'down'} this cycle.`,
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
      source: 'XRP Ledger public cluster (no keys)',
      watchlist_wallets: watchlistSize || null,
      window: 'balance snapshots each cycle vs 24h and 7d reference points',
      snapshots: d && d.snapshotCount != null ? d.snapshotCount : null,
      pipeline: 'exchange-wallet balances → net flow vs history → whale-pulse detection on large payments → smoothed regime tilt',
    },
    computed: d ? {
      bias: d.bias,
      whale_pulse: d.whalePulse,
      active_pulses: d.activePulses,
      net_flow_24h: d.netFlow24h,
      net_flow_7d: d.netFlow7d,
      warming_up: warmingUp,
      degraded,
      decisive: healthy && isDecisiveFlow({ bias: d.bias, active_pulses: d.activePulses, warming_up: false, degraded: false }),
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
