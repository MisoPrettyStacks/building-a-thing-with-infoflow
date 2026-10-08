// Sasha's lab notebook — one honest per-cycle record of the
// sentiment experiment. Pure function, no I/O: safe to unit test.
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
// Sasha is the noisiest lab on the page and she says so, in her own voice.

export const SASHA_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to sasha-log.jsonl on
// the data branch and kept forever. Sasha keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatSashaLogLine(note) { return JSON.stringify(note); }
export function parseSashaLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A mood read counts as "decisive" when it is expressive, not a murmur. */
export function isDecisiveSasha(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  return Math.abs(computed.z || 0) >= 1.5;
}

export function buildSashaNote({ signal, scoreboard, cycle, barT }) {
  const t = new Date().toISOString();
  const d = signal || null;
  const degraded = !d || !!d.degraded;
  const warmingUp = !!d && !!d.warmingUp;
  const healthy = !degraded && !warmingUp;
  const posts = d && Number.isFinite(d.postsScanned) ? d.postsScanned : 0;

  const checks = [];
  checks.push({
    name: 'feed health',
    pass: !degraded,
    detail: degraded
      ? 'Reddit unreachable this cycle — I was blind, so I abstained rather than guessing. A blind rumor desk reports nothing.'
      : 'Reddit public JSON reachable — post titles read from r/XRP and r/CryptoCurrency, no keys involved',
  });
  checks.push({
    name: 'coverage',
    pass: healthy && posts >= 10,
    detail: healthy
      ? `${posts} post titles scanned this cycle${posts < 10 ? ' — thin coverage, so even a loud mood is a whisper statistically' : ''}`
      : 'no coverage this cycle — nothing to count, nothing to claim',
  });
  if (healthy) {
    const decisive = isDecisiveSasha({ z: d.z, warming_up: false, degraded: false });
    const lean = d.z > 0 ? 'leaning optimistic' : d.z < 0 ? 'leaning fearful' : 'balanced';
    checks.push({
      name: 'mood regime',
      pass: decisive,
      detail: decisive
        ? `decisive read: crowd mood ${lean} (z = ${d.z >= 0 ? '+' : ''}${d.z.toFixed(2)}). Strong, but strong ≠ trustworthy — a brigaded thread can shout just as loud as a real mood shift.`
        : 'quiet — mood inside its usual range. Most cycles are quiet; most quiet cycles mean nothing. Honesty requires saying so.',
    });
    checks.push({
      name: 'gaming sniff test',
      pass: false,
      detail: 'word counts cannot tell a genuine holder from a bot or a brigaded thread — I note every decisive read as possibly gamed, never as pure signal',
    });
  }
  const sb = scoreboard || null;
  if (sb && sb.n >= 30) {
    const edge = sb.brierMember != null && sb.brierBase != null && sb.brierMember < sb.brierBase;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `sentiment member Brier ${sb.brierMember != null ? sb.brierMember.toFixed(5) : '—'} vs baseline ${sb.brierBase != null ? sb.brierBase.toFixed(5) : '—'} over n=${sb.n} scored forecasts${sb.skill24h && sb.skill24h.n >= 30 ? `; 24h direction hit rate ${(sb.skill24h.hitRate * 100).toFixed(1)}% (n=${sb.skill24h.n})` : ''}`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up, and I do not predict the verdict before the evidence' });
  }

  let verdict, finding, verdictWhy;
  if (degraded) {
    verdict = 'insufficient data';
    finding = 'Reddit was unreachable this cycle — I was blind, so I abstained. A silent feed is not a calm crowd.';
    verdictWhy = 'No honest measurement, no signal, no effect. I would rather say "I don\'t know" than invent a mood.';
  } else if (isDecisiveSasha({ z: d.z, warming_up: false, degraded: false })) {
    verdict = 'useful';
    const lean = d.z > 0 ? 'optimistic tilt' : 'fearful tilt';
    finding = `A genuinely expressive mood read this cycle: ${posts} titles scored, mood ${lean} (z = ${d.z >= 0 ? '+' : ''}${d.z.toFixed(2)}). Recorded — with the standing caveat that Reddit mood lags price as often as it leads it, and that loud can mean brigaded.`;
    verdictWhy = 'The read is decisive and the feed is healthy — this is the regime my lab exists to catch, noise and all.';
  } else {
    verdict = 'not useful';
    finding = `Quiet cycle — ${posts} titles scanned, mood inside its usual range. Nothing to report, so I abstain. My data is the noisiest on this page and I say so; a weak mood confidently applied is worse than no mood at all.`;
    verdictWhy = 'The crowd is murmuring and I refuse to narrate murmurs. That restraint IS the lab\'s edge, if it has one.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && Math.abs(d.bias) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast: the sentiment tilt nudged the forecast ${d.bias > 0 ? 'up' : 'down'} this cycle — deliberately tiny, because this is the noisiest feed in the model.`,
    };
  } else if (weight > 0) {
    mathEffect = { effect: 'none', detail: 'A nonzero weight but I abstained (no decisive read) — an abstention changes nothing mathematically.' };
  } else {
    mathEffect = { effect: 'none', detail: 'No mathematical effect on the forecast — my member weight is 0, so I am scored but never blended in.' };
  }

  return {
    t,
    cycle,
    bar_t: barT,
    collected: {
      source: 'Reddit public JSON (r/XRP + r/CryptoCurrency, newest posts — no keys)',
      window: 'newest post titles each cycle, mood scored against a pre-registered word list',
      posts_scanned: posts,
      pipeline: 'post titles → mood word counts → mood score → normalized against recent history → small regime tilt',
    },
    computed: d ? {
      bias: d.bias,
      z: d.z,
      posts_scanned: posts,
      warming_up: warmingUp,
      degraded,
      decisive: healthy && isDecisiveSasha({ z: d.z, warming_up: false, degraded: false }),
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
