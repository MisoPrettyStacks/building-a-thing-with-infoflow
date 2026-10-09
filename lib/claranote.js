// Clara's lab notebook — one honest per-cycle record of the
// quarter-hour boundary experiment. Pure function, no I/O: safe to unit test.
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

export const CLARA_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to clara-log.jsonl on
// the data branch and kept forever. Clara keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatClaraLogLine(note) { return JSON.stringify(note); }
export function parseClaraLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A boundary read counts as "decisive" when healthy AND the bias speaks above a whisper. */
export function isDecisiveClara(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  return Math.abs(computed.bias || 0) >= 0.004;
}

export function buildClaraNote({ signal, scoreboard, cycle, barT }) {
  const t = new Date().toISOString();
  const d = signal || null;
  const degraded = !d || !!d.degraded;
  const warmingUp = !!d && !!d.warmingUp;
  const healthy = !degraded && !warmingUp;
  const decisive = healthy && isDecisiveClara({ bias: d.bias, warming_up: false, degraded: false });

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
      ? 'fewer bars than the clock grid needs — a boundary effect cannot be judged on a handful of quarter-hours, so I abstain'
      : 'enough bars and boundary bars on record — the clock-grid measurement is honest',
  });
  if (healthy) {
    const burstTxt = d.burst != null ? `burst ${d.burst.toFixed(2)}x the off-grid norm` : 'burst unmeasured';
    const persTxt = d.persistence != null ? `sign persistence ${(d.persistence * 100).toFixed(0)}% across the last boundary bars` : 'persistence unmeasured';
    checks.push({
      name: 'boundary read',
      pass: decisive,
      detail: decisive
        ? `the grid spoke: boundary return ${d.boundaryRetBps != null ? (d.boundaryRetBps >= 0 ? '+' : '') + d.boundaryRetBps.toFixed(1) + ' bps' : 'n/a'}, ${burstTxt}, ${persTxt} — bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}`
        : `the grid whispered: ${burstTxt}, ${persTxt} — too faint or too scattered to license a tilt, so I keep it at zero rather than amplify noise`,
    });
  }
  const sb = scoreboard || null;
  if (sb && sb.n >= 30) {
    const edge = sb.brierMember < sb.brierBase;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `quarter-hour member Brier ${sb.brierMember != null ? sb.brierMember.toFixed(5) : 'n/a'} vs baseline ${sb.brierBase != null ? sb.brierBase.toFixed(5) : 'n/a'} over n=${sb.n} scored forecasts${sb.skill24h && sb.skill24h.n >= 30 ? `; 24h direction hit rate ${(sb.skill24h.hitRate * 100).toFixed(1)}% (n=${sb.skill24h.n})` : ''}`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = warmingUp
      ? 'My bar history is still building — the clock grid needs hours of bars, boundary and off-grid alike, before a boundary read means anything. I abstain rather than invent one.'
      : 'The bar data was unusable this cycle — I was blind, so I abstained. A blind lab reports nothing.';
    verdictWhy = 'No honest measurement, no signal, no effect. I would rather say "I don\'t know" than invent a number.';
  } else if (decisive) {
    verdict = 'useful';
    const dir = d.bias > 0 ? 'up' : 'down';
    finding = `The quarter-hour spoke on schedule: the last boundary bar moved ${dir} with volume behind it and the recent boundary bars agreeing in sign. My read is a small ${dir}ward tilt, bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)} — the grid behaving the way the boundary literature says it behaves.`;
    verdictWhy = 'A boundary bar with a burst and sign persistence is exactly the configuration my lab exists to catch — periodic flow leaving a readable footprint.';
  } else {
    verdict = 'not useful';
    finding = 'The grid ticked, but faintly or in scattered directions — no burst worth the name, or boundary bars disagreeing with each other. Forcing a tilt out of that would be noise dressed as punctuality, so I abstain.';
    verdictWhy = 'My rule is conditional by design: the boundary licenses a read only when it arrives with volume and agreement. A quiet grid says nothing, and I repeat nothing.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && Math.abs(d.bias) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(2)}: the boundary tilt nudged the forecast ${d.bias > 0 ? 'up' : 'down'} this cycle.`,
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
      window: 'XRP bars ordered by timestamp; boundary bars are those opening on the quarter-hour (:00/:15/:30/:45), scored against the off-grid bars around them',
      bars: d && d.barCount != null ? d.barCount : null,
      pipeline: 'order bars by timestamp → mark quarter-hour boundary bars → last boundary bar\u2019s return, volume burst vs the off-grid median, sign persistence across recent boundary bars → conditional bias',
    },
    computed: d ? {
      bias: d.bias,
      boundary_ret_bps: d.boundaryRetBps,
      burst: d.burst,
      persistence: d.persistence,
      phase_min: d.phaseMin,
      warming_up: warmingUp,
      degraded,
      decisive,
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
