// Molly's lab notebook — one honest per-cycle record of the
// macro-events experiment. Pure function, no I/O: safe to unit test.
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

export const MOLLY_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to molly-log.jsonl on
// the data branch and kept forever. Molly keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatMollyLogLine(note) { return JSON.stringify(note); }
export function parseMollyLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** Molly's regime is the event window: inside one, she is working. */
export function isInWindow(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  return !!computed.active;
}

function fmtCountdown(min) {
  if (min == null || !isFinite(min)) return 'unknown';
  const a = Math.abs(min);
  if (a < 1) return 'right about now';
  if (a < 60) return `${Math.round(a)} min ${min > 0 ? 'away' : 'ago'}`;
  const h = Math.floor(a / 60), m = Math.round(a % 60);
  return `${h}h ${m}m ${min > 0 ? 'away' : 'ago'}`;
}

export function buildMollyNote({ signal, scoreboard, cycle, barT }) {
  const t = new Date().toISOString();
  const d = signal || null;
  const degraded = !d || !!d.degraded;
  const warmingUp = !!d && !!d.warmingUp;
  const healthy = !degraded && !warmingUp;

  const checks = [];
  checks.push({
    name: 'calendar health',
    pass: !degraded,
    detail: degraded
      ? 'macro-calendar.json unreadable — I saw no schedule this cycle, so I abstained rather than guessing. A blind calendar reports nothing'
      : `calendar loaded (${d.calendarEvents || '?'} scheduled releases) — next: ${d.nextRelease ? `${d.nextRelease.event} (${d.nextRelease.date} ${d.nextRelease.time_et} ET, tier ${d.nextRelease.tier}), ${fmtCountdown(d.nextRelease.minutes_until)}` : 'no upcoming releases on the schedule'}`,
  });
  if (healthy) {
    checks.push({
      name: 'window state',
      pass: !!d.active,
      detail: d.active
        ? `INSIDE an event window: ${d.event} (${d.date} ${d.time_et} ET), tier ${d.tier}, ${fmtCountdown(d.minutesToEvent)} — window ±${d.windowMinutes} min. This is my regime: confidence shrinks, the cone widens`
        : `quiet — no release near (nearest window is ${d.nextRelease ? fmtCountdown(d.nextRelease.minutes_until) : 'off the schedule'}). Full confidence restored; I say so plainly`,
    });
    checks.push({
      name: 'humility doctrine',
      pass: (d.bias || 0) === 0,
      detail: 'bias is exactly 0 — the surprise direction of a macro release is a coin flip, and I never predict it. I dampen confidence; I never take a side',
    });
  }
  const sb = scoreboard || null;
  const ew = sb && sb.eventWindow ? sb.eventWindow : null;
  if (ew && ew.n >= 10) {
    const edge = ew.brierMacro < ew.brierBase;
    checks.push({
      name: 'out-of-sample edge in event windows',
      pass: edge,
      detail: `dampened what-if Brier ${ew.brierMacro.toFixed(5)} vs issued-forecast Brier ${ew.brierBase.toFixed(5)} over n=${ew.n} scored forecasts inside event windows — the only place the dampening can matter`,
    });
  } else if (sb && sb.n >= 30) {
    checks.push({
      name: 'out-of-sample edge in event windows',
      pass: false,
      detail: `not enough in-window history yet (eventWindow n=${ew ? ew.n : 0} — needs a solid sample of real releases); overall the what-if series is scored on n=${sb.n} forecasts`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge in event windows', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = 'The calendar was unreadable this cycle — I saw no schedule, so I abstained. A blind calendar reports nothing.';
    verdictWhy = 'No honest measurement, no window read, no effect. I would rather say "I don\'t know" than invent a schedule.';
  } else if (d.active) {
    verdict = 'useful';
    const armed = (d.weight || 0) > 0;
    finding = `Event window engaged: ${d.event} (tier ${d.tier}), ${fmtCountdown(d.minutesToEvent)}. Volatility runs hot around scheduled releases while the surprise direction stays a coin flip — the humble move is to shrink confidence toward 0.5 and widen the cone, ${armed ? 'and the dampener is armed, so that is exactly what happened' : 'which is scored as a what-if series until the evidence earns adoption'}.`;
    verdictWhy = 'Inside an event window is my whole reason for existing — scheduled releases spike volatility, and confidence is a liability there.';
  } else {
    verdict = 'not useful';
    finding = `Quiet cycle — no macro release near (next: ${d.nextRelease ? `${d.nextRelease.event}, ${fmtCountdown(d.nextRelease.minutes_until)}` : 'off the schedule'}). Nothing to dampen, so I abstain. Most cycles are quiet; that is normal and honest.`;
    verdictWhy = 'Dampening confidence when there is no event would be theater, not science. The calendar is calm and I say so.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && d.active) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended at weight ${weight.toFixed(2)}: inside the window the forecast's P(up) deviation shrank toward 0.5 and the forecast cone widened — a confidence adjustment, never a directional bet.`,
    };
  } else if (weight > 0) {
    mathEffect = { effect: 'none', detail: `Weight is ${weight.toFixed(2)} but no event window is active — outside windows the dampened series equals the issued forecast by construction, so nothing changed mathematically.` };
  } else {
    mathEffect = { effect: 'none', detail: 'No mathematical effect on the forecast — the dampener weight is 0, so it is scored as a what-if series but never blended in.' };
  }

  return {
    t,
    cycle,
    bar_t: barT,
    collected: {
      source: 'data/macro-calendar.json — hardcoded schedule from official Fed/BLS/Census/ISM calendars (no feed to break)',
      window: 'proximity of the cycle time to the nearest scheduled release: ±60 min tier-1 (FOMC, CPI, payrolls), ±30 min tier-2 (PPI, retail sales, ISM)',
      snapshots: null,
      pipeline: 'parse calendar once -> per cycle, find nearest release -> window check -> next-3 upcoming list -> latest-bar |log return| for the volatility study',
    },
    computed: d ? {
      bias: d.bias,
      active: !!d.active,
      tier: d.tier || 0,
      event: d.event || null,
      date: d.date || null,
      time_et: d.time_et || null,
      minutes_to_event: d.minutesToEvent,
      shrink: d.shrink,
      window_minutes: d.windowMinutes || 0,
      next_release: d.nextRelease || null,
      next_tier: d.nextTier || 0,
      calendar_events: d.calendarEvents || 0,
      ret_abs: d.lastRetAbs,
      warming_up: warmingUp,
      degraded,
      in_window: healthy && isInWindow({ active: d.active, warming_up: false, degraded: false }),
      decisive: healthy && isInWindow({ active: d.active, warming_up: false, degraded: false }),
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
