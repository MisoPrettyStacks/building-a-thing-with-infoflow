// Daisy's lab notebook — one honest per-cycle record of the
// derivatives-positioning experiment. Pure function, no I/O: safe to unit test.
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

export const DAISY_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to daisy-log.jsonl on
// the data branch and kept forever. Daisy keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatDaisyLogLine(note) { return JSON.stringify(note); }
export function parseDaisyLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A positioning read counts as "decisive" when it is expressive, not a whisper. */
export function isDecisiveDaisy(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  return Math.abs(computed.bias || 0) >= 0.004;
}

export function buildDaisyNote({ signal, scoreboard, cycle, barT }) {
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
      ? 'derivatives API unreachable — the feed was blind this cycle, so I abstained rather than guessing'
      : 'derivatives API reachable — funding rate and open interest read from the public Gate.io + Kraken Futures feeds',
  });
  checks.push({
    name: 'history depth',
    pass: !warmingUp,
    detail: warmingUp
      ? 'history still building — I need a real funding and open-interest trail before my reads mean anything, so I abstain'
      : 'a solid trail of funding and open-interest readings on record — regime comparisons are honest',
  });
  if (healthy) {
    const decisive = isDecisiveDaisy({ bias: d.bias, warming_up: false, degraded: false });
    const crowd = d.bias < 0 ? 'crowded longs — longs are paying, the long side is packed and fragile (bearish tilt)'
      : d.bias > 0 ? 'crowded shorts — shorts are paying, the short side is packed and fragile (bullish tilt)'
      : 'neutral';
    checks.push({
      name: 'positioning regime',
      pass: decisive,
      detail: decisive
        ? `decisive read: ${crowd}, bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}; funding ${d.funding8h != null ? (d.funding8h * 100).toFixed(4) + '%/8h' : 'n/a'}; open interest ${d.oiRising ? 'rising' : 'flat/falling'}`
        : 'quiet — the derivatives crowd is balanced and no strong tilt is on the board',
    });
    checks.push({
      name: 'open interest',
      pass: !!d.oiRising,
      detail: d.oiRising
        ? `open interest is climbing (trend ${d.oiTrend != null ? (d.oiTrend >= 0 ? '+' : '') + (d.oiTrend * 100).toFixed(1) + '%' : 'n/a'}) — fresh money is confirming the positioning read`
        : 'open interest flat or falling — the read stands on the funding side alone, so I hold it lightly',
    });
  }
  const sb = scoreboard || null;
  if (sb && sb.n >= 30) {
    const edge = sb.brierMember < sb.brierBase;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `derivatives member Brier ${sb.brierMember.toFixed(5)} vs baseline ${sb.brierBase.toFixed(5)} over n=${sb.n} scored forecasts${sb.skill24h && sb.skill24h.n >= 30 ? `; 24h direction hit rate ${(sb.skill24h.hitRate * 100).toFixed(1)}% (n=${sb.skill24h.n})` : ''}`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = degraded
      ? 'The derivatives feed was unreachable this cycle — I was blind, so I abstained. A blind crowd meter reports nothing.'
      : 'My funding and open-interest history is still building — I need a real trail before regime reads mean anything, so I abstain rather than invent a read.';
    verdictWhy = 'No honest measurement, no signal, no effect. I would rather say "I don\'t know" than invent a number.';
  } else if (isDecisiveDaisy({ bias: d.bias, warming_up: false, degraded: false })) {
    verdict = 'useful';
    const crowd = d.bias < 0 ? 'crowded longs (the market is packed on one side — bearish tilt)' : 'crowded shorts (the market is packed on the other side — bullish tilt)';
    finding = `Real positioning signal this cycle: ${crowd}, bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}. Funding is running ${d.funding8h != null ? (d.funding8h * 100).toFixed(4) + '% per 8h' : 'unavailable'} and open interest is ${d.oiRising ? `climbing (${(d.oiTrend * 100).toFixed(1)}% across the window) — fresh money confirming the crowd` : 'flat or falling — so I hold the read lightly'}.`;
    verdictWhy = 'The positioning read is decisive and the feed is healthy — this is the regime my lab exists to catch.';
  } else {
    verdict = 'not useful';
    finding = 'Quiet cycle — funding near neutral and no strong positioning tilt on the board. Nothing to report, so I abstain. Most cycles are quiet; that is normal and honest.';
    verdictWhy = 'A weak read confidently applied is worse than no read. The derivatives crowd is balanced and I say so.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && Math.abs(d.bias) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(2)}: the positioning tilt nudged the forecast ${d.bias > 0 ? 'up' : 'down'} this cycle.`,
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
      source: 'Gate.io + Kraken Futures public derivatives APIs (no keys)',
      window: 'funding-rate history (per-8h readings) plus recent open-interest readings',
      snapshots: d && d.fundingCount != null ? d.fundingCount : null,
      pipeline: 'funding history -> average crowd rate -> open-interest trend -> crowded-positioning tilt',
    },
    computed: d ? {
      bias: d.bias,
      funding_8h: d.funding8h,
      oi_trend: d.oiTrend,
      warming_up: warmingUp,
      degraded,
      decisive: healthy && isDecisiveDaisy({ bias: d.bias, warming_up: false, degraded: false }),
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
