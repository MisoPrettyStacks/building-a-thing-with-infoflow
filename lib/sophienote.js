// Sophie's lab notebook — one honest per-cycle record of the
// session-seasonality experiment. Pure function, no I/O: safe to unit test.
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

export const SOPHIE_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to sophie-log.jsonl on
// the data branch and kept forever. Sophie keeps working until Angelica says otherwise.

export const SOPHIE_DECISIVE_BIAS = 0.003;  // |bias| above this = an expressive seasonal read

// --- permanent-notebook helpers (pure, tested) ---
export function formatSophieLogLine(note) { return JSON.stringify(note); }
export function parseSophieLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A seasonal read counts as "decisive" when it is expressive, not a whisper. */
export function isDecisiveSophie(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  return Math.abs(computed.bias || 0) >= SOPHIE_DECISIVE_BIAS;
}

function fmtHour(h) {
  return String(h).padStart(2, '0') + ':00 UTC';
}

export function buildSophieNote({ signal, scoreboard, cycle, barT }) {
  const t = new Date().toISOString();
  const d = signal || null;
  const degraded = !d || !!d.degraded;
  const warmingUp = !!d && !!d.warmingUp;
  const healthy = !degraded && !warmingUp;
  const decisive = healthy && isDecisiveSophie({
    bias: d && d.bias, warming_up: false, degraded: false,
  });
  const sb = scoreboard || null;

  const checks = [];
  checks.push({
    name: 'data health',
    pass: !degraded,
    detail: degraded
      ? 'bar history unreadable this cycle — I abstained rather than guessing'
      : 'bar history read cleanly from the lab\'s own candles — no external fetch to fail',
  });
  checks.push({
    name: 'history depth',
    pass: !warmingUp,
    detail: warmingUp
      ? 'fewer than seven days of closed 5-minute bars on record — seasonality needs a full week of history before the hourly means mean anything, so I abstain'
      : `seven+ days of closed 5-minute bars on record (${d.barsSeen || 0} bars) — the hourly means are honest`,
  });
  if (healthy) {
    checks.push({
      name: 'session rhythm',
      pass: decisive,
      detail: decisive
        ? `expressive read: the next three UTC hours historically tilt ${d.bias > 0 ? 'up' : 'down'} (bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}) · current session ${d.session || '—'} · target hours ${(d.targetHours || []).map(fmtHour).join(', ') || '—'}`
        : 'whisper-quiet — the target hours\' historical tilt is below my expressive bar, so I abstain. Seasonal effects are tiny; most cycles are quiet and I say so.',
    });
    checks.push({
      name: 'strongest hour',
      pass: d.bestHour != null,
      detail: d.bestHour != null
        ? `strongest historical hourly mean: ${fmtHour(d.bestHour)} (${(d.hourlyMeans || [])[d.bestHour] != null ? ((d.hourlyMeans[d.bestHour] >= 0 ? '+' : '') + d.hourlyMeans[d.bestHour].toFixed(6) + ' mean log-return') : 'n/a'})`
        : 'no hourly means computed this cycle',
    });
  }
  if (sb && sb.n >= 30) {
    const edge = sb.brierMember < sb.brierBase;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `session-seasonality member Brier ${sb.brierMember.toFixed(5)} vs baseline ${sb.brierBase.toFixed(5)} over n=${sb.n} scored forecasts${sb.skill24h && sb.skill24h.n >= 30 ? `; 24h direction hit rate ${(sb.skill24h.hitRate * 100).toFixed(1)}% (n=${sb.skill24h.n})` : ''}`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = warmingUp
      ? 'My bar history is still building — I need seven full days of closed 5-minute bars before the hour-by-hour means are trustworthy, so I abstain rather than invent a rhythm.'
      : 'The bar history was unreadable this cycle — I was blind, so I abstained. A blind watchtower reports nothing.';
    verdictWhy = 'No honest measurement, no signal, no effect. I would rather say "I don\'t know" than invent a number.';
  } else if (decisive) {
    verdict = 'useful';
    const dir = d.bias > 0 ? 'the next three UTC hours historically run warm (upward tilt)' : 'the next three UTC hours historically run cool (downward tilt)';
    finding = `Real seasonal read this cycle: ${dir}, bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}, current session ${d.session || '—'}. The pattern is small — seasonal tilts always are — but it cleared my expressive bar, so this is the regime my lab exists to catch.`;
    verdictWhy = 'The seasonal read is decisive and the data is healthy — a quiet but honest signal.';
  } else {
    verdict = 'not useful';
    finding = `Quiet cycle — the target hours' (${(d.targetHours || []).map(fmtHour).join(', ') || '—'}) historical tilt is a whisper, current session ${d.session || '—'}. Nothing to report, so I abstain. Most cycles are quiet; that is normal and honest.`;
    verdictWhy = 'A whisper confidently applied is worse than no read. The clock is calm and I say so.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && Math.abs(d.bias) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(2)}: the seasonal tilt nudged the forecast ${d.bias > 0 ? 'up' : 'down'} this cycle.`,
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
      source: 'the lab\'s own 5-minute XRP candles (no external fetch)',
      window: 'trailing 7+ days of closed bars, grouped by UTC hour-of-day',
      bars_seen: d && d.barsSeen != null ? d.barsSeen : null,
      sessions: 'Asia 0–8 UTC · Europe 7–16 UTC · US 13–21 UTC',
      pipeline: 'closed bars → log-return per bar → mean per UTC hour → average over next 3 UTC hours → small seasonal tilt',
    },
    computed: d ? {
      bias: d.bias,
      session: d.session,
      target_hours: d.targetHours,
      hourly_means: d.hourlyMeans,
      best_hour: d.bestHour,
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
