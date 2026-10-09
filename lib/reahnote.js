// Reah's lab notebook — one honest per-cycle record of the
// mean-reversion experiment. Pure function, no I/O: safe to unit test.
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

export const REAH_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to reah-log.jsonl on
// the data branch and kept forever. Reah keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatReahLogLine(note) { return JSON.stringify(note); }
export function parseReahLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A reversion read counts as "decisive" when she is actually fading — the bias speaks above a whisper. */
export function isDecisiveReah(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  return Math.abs(computed.bias || 0) >= 0.004;
}

export function buildReahNote({ signal, scoreboard, cycle, barT }) {
  const t = new Date().toISOString();
  const d = signal || null;
  const degraded = !d || !!d.degraded;
  const warmingUp = !!d && !!d.warmingUp;
  const healthy = !degraded && !warmingUp;
  const fading = healthy && !!d.fading;

  const checks = [];
  checks.push({
    name: 'data health',
    pass: !degraded,
    detail: degraded
      ? 'the bar history was unusable this cycle — I emit no read rather than guess from broken inputs'
      : 'the XRP bar series read cleanly from the lab\u2019s own candles',
  });
  checks.push({
    name: 'history depth',
    pass: !warmingUp,
    detail: warmingUp
      ? 'fewer bars than I need to read a move honestly — a snap-back needs something to snap from, so I abstain'
      : 'enough closed bars on record to read the recent move — the measurement is honest',
  });
  if (healthy) {
    const decisive = isDecisiveReah({ bias: d.bias, warming_up: false, degraded: false });
    checks.push({
      name: 'reversion read',
      pass: decisive,
      detail: fading
        ? `fading: the recent move is expressive enough to lean against, bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}`
        : 'quiet: the recent move is a whisper — leaning against it would be fighting noise, so I keep my tilt at zero',
    });
  }
  const sb = scoreboard || null;
  if (sb && sb.n >= 30) {
    const edge = sb.brierMember < sb.brierBase;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `mean-reversion member Brier ${sb.brierMember.toFixed(5)} vs baseline ${sb.brierBase.toFixed(5)} over n=${sb.n} scored forecasts${sb.skill24h && sb.skill24h.n >= 30 ? `; 24h direction hit rate ${(sb.skill24h.hitRate * 100).toFixed(1)}% (n=${sb.skill24h.n})` : ''}`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = warmingUp
      ? 'My bar history is still building — a snap-back read needs a real move behind it before it means anything, so I abstain rather than invent one.'
      : 'The bar data was unusable this cycle — I was blind, so I abstained. A blind lab reports nothing.';
    verdictWhy = 'No honest measurement, no signal, no effect. I would rather say "I don\'t know" than invent a number.';
  } else if (fading) {
    verdict = 'useful';
    const dir = d.bias > 0 ? 'up (fading the drop)' : 'down (fading the run-up)';
    finding = `A move worth fading: XRP just moved and I lean ${dir}, bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}. The last closed bar ran ${d.lastRetBps != null ? Math.abs(d.lastRetBps).toFixed(1) + ' bps' : 'an expressive amount'}${d.volRatio != null && d.volRatio >= 1 ? ' on aggressive volume — exactly the kind of move that tends to snap back' : ''}.`;
    verdictWhy = 'The move is expressive and I am leaning against it — this is exactly the setup my lab exists to catch: price overshoots, liquidity compensates, the snap-back follows.';
  } else {
    verdict = 'not useful';
    finding = 'The recent move is too small to fade honestly — leaning against a whisper would be noise dressed as conviction, so I abstain.';
    verdictWhy = 'Reversion is a discipline of patience: most moves are not worth fading. No expressive move, no tilt.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && Math.abs(d.bias) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(2)}: the reversion tilt nudged the forecast ${d.bias > 0 ? 'up' : 'down'} this cycle.`,
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
      source: 'the lab\u2019s own 5-minute XRP candles (no keys, no external fetch)',
      window: 'recent closed XRP bars; volume compared against its recent median',
      bars: d && d.barCount != null ? d.barCount : null,
      pipeline: 'recent closes → log returns of the last bars → fade the move, stronger after aggressive high-volume bars',
    },
    computed: d ? {
      bias: d.bias,
      last_ret_bps: d.lastRetBps != null ? d.lastRetBps : null,
      vol_ratio: d.volRatio != null ? d.volRatio : null,
      fading: !!d.fading,
      warming_up: warmingUp,
      degraded,
      decisive: healthy && isDecisiveReah({ bias: d.bias, warming_up: false, degraded: false }),
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}

