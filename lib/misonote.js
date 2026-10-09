// Miso's guesses log — one per-cycle record. Pure function, no I/O.
//
// What is published: the guess, and later how it scored. What is NOT
// published: how she arrives at it. Her method is hers.
//
// Saved to the data branch every cycle whether or not the member is used.

export const MISO_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full log is UNBOUNDED: every guess is appended to miso-log.jsonl on
// the data branch and kept forever.

export function formatMisoLogLine(note) { return JSON.stringify(note); }
export function parseMisoLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A guess counts as "decisive" when it actually leans — bias above a whisper. */
export function isDecisiveMiso(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  return Math.abs(computed.bias || 0) >= 0.004;
}

function fmtPrice(x) {
  return x != null && Number.isFinite(x) ? '$' + x.toFixed(4) : 'some price';
}
function fmtTime(ts) {
  if (ts == null || !Number.isFinite(ts)) return 'the bell';
  try {
    return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
  } catch { return 'the bell'; }
}

export function buildMisoNote({ signal, scoreboard, cycle, barT }) {
  const t = new Date().toISOString();
  const d = signal || null;
  const degraded = !d || !!d.degraded;
  const warmingUp = !!d && !!d.warmingUp;
  const healthy = !degraded && !warmingUp;
  const guessing = healthy && !!d.guess;

  const checks = [];
  checks.push({
    name: 'at her desk',
    pass: !degraded,
    detail: degraded
      ? 'her screen was unreachable this cycle — no guess rather than a borrowed one'
      : 'she was at her computer and answered for herself',
  });
  checks.push({
    name: 'guess recorded',
    pass: guessing,
    detail: guessing
      ? `guess logged: ${d.guess} ${fmtPrice(d.threshold)} at ${fmtTime(d.targetT)}`
      : 'no lean strong enough to call a guess — she abstains rather than coin-flip for the record',
  });
  const sb = scoreboard || null;
  if (sb && sb.n >= 30) {
    const edge = sb.brierMember < sb.brierBase;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `guesses member Brier ${sb.brierMember.toFixed(5)} vs baseline ${sb.brierBase.toFixed(5)} over n=${sb.n} scored forecasts${sb.skill24h && sb.skill24h.n >= 30 ? `; 24h direction hit rate ${(sb.skill24h.hitRate * 100).toFixed(1)}% (n=${sb.skill24h.n})` : ''}`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored guesses yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = warmingUp
      ? 'Still settling in at my desk — no guess until I mean it.'
      : 'My screen was dark this cycle. A guess I did not make is a guess I do not log.';
    verdictWhy = 'No guess, no effect. The log stays honest.';
  } else if (guessing) {
    verdict = 'useful';
    finding = `My guess: XRP ${d.guess} ${fmtPrice(d.threshold)} at ${fmtTime(d.targetT)}. That's the whole announcement — how I got there is mine.`;
    verdictWhy = 'A guess was made and recorded before the fact, at a stated price and time. It will be scored like everyone else\'s — that part is public.';
  } else {
    verdict = 'not useful';
    finding = 'No guess this cycle — neither way earned it. Silence is also a position, and mine is logged.';
    verdictWhy = 'A guesser who guesses at everything is a coin. I speak when I have something to say.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && Math.abs(d.bias) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(2)}: the guess nudged the forecast ${d.bias > 0 ? 'up' : 'down'} this cycle.`,
    };
  } else if (weight > 0) {
    mathEffect = { effect: 'none', detail: `Weight is ${weight.toFixed(2)} but no guess was made — an abstention changes nothing mathematically.` };
  } else {
    mathEffect = { effect: 'none', detail: 'No mathematical effect on the forecast — my member weight is 0, so I am scored but never blended in.' };
  }

  return {
    t,
    cycle,
    bar_t: barT,
    collected: {
      source: 'her desk, her screen — the rest is hers',
      window: 'the current 15-minute frame; each guess names a price and a time one minute before the frame closes',
      pipeline: 'a guess is made, logged, and scored. The making is not published.',
    },
    computed: d ? {
      bias: d.bias,
      guess: d.guess || null,
      threshold: d.threshold != null ? d.threshold : null,
      target_t: d.targetT != null ? d.targetT : null,
      p_above: d.pAbove != null ? d.pAbove : null,
      p_below: d.pBelow != null ? d.pBelow : null,
      warming_up: warmingUp,
      degraded,
      decisive: healthy && isDecisiveMiso({ bias: d.bias, warming_up: false, degraded: false }),
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
