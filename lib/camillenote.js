// Camille's lab notebook — one honest per-cycle record of the
// calendar-effect experiment. Pure function, no I/O: safe to unit test.
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

export const CAMILLE_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to camille-log.jsonl on
// the data branch and kept forever. Camille keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatCamilleLogLine(note) { return JSON.stringify(note); }
export function parseCamilleLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A cycle counts as "decisive" when the tilt is actually active (inside the 1st-7th window). */
export function isDecisiveCamille(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  return (computed.tilt || 0) > 0;
}

export function buildCamilleNote({ signal, scoreboard, cycle, barT }) {
  const t = new Date().toISOString();
  const d = signal || null;
  const degraded = !d || !!d.degraded;
  const warmingUp = !!d && !!d.warmingUp; // always false: the calendar needs no warm-up
  const healthy = !degraded && !warmingUp;

  const checks = [];
  checks.push({
    name: 'calendar determinism',
    pass: healthy && Number.isFinite(d.tilt) && Number.isFinite(d.daysSince),
    detail: healthy && Number.isFinite(d.tilt) && Number.isFinite(d.daysSince)
      ? `the tilt is computed from the clock alone — no feed, no fetch, no guesswork; days since escrow ${d.daysSince}, re-lock ${((d.relock || 0) * 100).toFixed(0)}%`
      : 'the calendar read failed this cycle — a broken clock is the one thing this lab cannot tolerate, so I abstained',
  });
  if (healthy) {
    const decisive = isDecisiveCamille({ tilt: d.tilt, warming_up: false, degraded: false });
    checks.push({
      name: 'tilt state',
      pass: decisive,
      detail: decisive
        ? `inside the 1st-7th window (day ${d.daysSince + 1} of the month): a small bearish tilt is active this cycle`
        : 'outside the 1st-7th window: the tilt is exactly zero — the schedule is quiet, so I abstain',
    });
    checks.push({
      name: 'schedule fidelity',
      pass: Number.isInteger(d.daysSince) && d.daysSince >= 0 && d.daysSince <= 30,
      detail: `day-of-month read ${d.daysSince + 1} is sane — the tilt fires only on schedule, never spuriously`,
    });
  }
  const sb = scoreboard || null;
  const tw = sb && sb.tiltWindow ? sb.tiltWindow : null;
  if (tw && tw.n >= 10) {
    const edge = tw.brierEscrow < tw.brierBase;
    checks.push({
      name: 'out-of-sample evidence in the tilt window',
      pass: edge,
      detail: `tilt-window what-if series Brier ${tw.brierEscrow.toFixed(5)} vs baseline ${tw.brierBase.toFixed(5)} over n=${tw.n} scored forecasts — this window is the only place the comparison is meaningful, because the tilted series equals the baseline by construction outside it`,
    });
  } else if (sb && sb.n > 0) {
    checks.push({ name: 'out-of-sample evidence in the tilt window', pass: false, detail: `scoreboard has n=${sb.n} scored forecasts but the tilt window is still too thin for a verdict — I wait for real history, not a handful of days` });
  } else {
    checks.push({ name: 'out-of-sample evidence in the tilt window', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = 'The calendar read failed this cycle — no honest measurement, so I abstained. A broken clock reports nothing.';
    verdictWhy = 'I would rather say "I don\'t know" than invent a day of the month.';
  } else if (isDecisiveCamille({ tilt: d.tilt, warming_up: false, degraded: false })) {
    verdict = 'useful';
    finding = `Tilt window active: day ${d.daysSince + 1} of the month, re-lock ratio ${((d.relock || 0) * 100).toFixed(0)}%. The bearish tilt is live this cycle — this is the regime my lab exists to score.`;
    verdictWhy = 'The schedule fired exactly on time and the read is honest — a tilt on schedule is the whole experiment.';
  } else {
    verdict = 'not useful';
    finding = 'Quiet cycle — outside the 1st-7th window the tilt is exactly zero, so there is nothing to tilt and nothing to score. Most cycles are quiet; that is the calendar working as designed, not a failure.';
    verdictWhy = 'A tilt that fired off schedule would be a broken instrument. Silence here is correctness.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && (d.tilt || 0) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(2)}: the escrow tilt nudged the forecast down this cycle, inside the 1st-7th window.`,
    };
  } else if (weight > 0) {
    mathEffect = { effect: 'none', detail: `Weight is ${weight.toFixed(2)} but the tilt is zero outside the window — a zero tilt changes nothing mathematically.` };
  } else {
    mathEffect = { effect: 'none', detail: 'No mathematical effect on the forecast — my member weight is 0, so the tilt is computed and scored but never blended in.' };
  }

  return {
    t,
    cycle,
    bar_t: barT,
    collected: {
      source: 'the calendar itself — Ripple\'s monthly escrow release schedule (public knowledge), plus the configured re-lock ratio',
      window: 'one clock read each cycle: whole days since the 1st of the month (UTC)',
      snapshots: null,
      pipeline: 'day of month -> tilt magnitude (strongest on the 1st, decaying to zero by the 7th, scaled by re-lock) -> small bearish tilt',
    },
    computed: d ? {
      bias: d.bias,
      tilt: d.tilt,
      days_since: d.daysSince,
      relock: d.relock,
      warming_up: warmingUp,
      degraded,
      decisive: healthy && isDecisiveCamille({ tilt: d.tilt, warming_up: false, degraded: false }),
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
