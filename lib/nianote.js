// Nia's lab notebook — one honest per-cycle record of the
// news-catalyst experiment. Pure function, no I/O: safe to unit test.
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

export const NIA_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to nia-log.jsonl on
// the data branch and kept forever. Nia keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatNiaLogLine(note) { return JSON.stringify(note); }
export function parseNiaLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A catalyst read counts as "decisive" when a live headline is actually pushing the tilt. */
export function isDecisiveNia(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  const b = Math.abs(computed.bias || 0);
  return b >= 0.004 || (computed.active_catalysts || 0) > 0;
}

export function buildNiaNote({ signal, scoreboard, cycle, barT }) {
  const t = new Date().toISOString();
  const d = signal || null;
  const degraded = !d || !!d.degraded;
  const warmingUp = !!d && !!d.warmingUp;
  const healthy = !degraded && !warmingUp;
  const actives = (d && Array.isArray(d.activeCatalysts)) ? d.activeCatalysts : [];

  const checks = [];
  checks.push({
    name: 'feed health',
    pass: !degraded,
    detail: degraded
      ? 'both RSS feeds unreachable and no live catalysts survived — the news wire was blind this cycle, so I abstained rather than guessing'
      : 'news wire reachable (CoinDesk and/or CoinTelegraph) — headlines read from the free public feeds',
  });
  if (healthy) {
    const decisive = isDecisiveNia({ bias: d.bias, active_catalysts: actives.length, warming_up: false, degraded: false });
    const nPos = actives.filter((a) => a.dir > 0).length;
    const nNeg = actives.filter((a) => a.dir < 0).length;
    checks.push({
      name: 'catalyst watch',
      pass: actives.length > 0,
      detail: actives.length > 0
        ? `${actives.length} live catalyst${actives.length > 1 ? 's' : ''} still fresh (fading over the hours): ${nPos} pushing up, ${nNeg} pushing down`
        : 'no crypto-specific catalyst headlines in the last cycle — the wire is quiet on the XRP front',
    });
    checks.push({
      name: 'catalyst read',
      pass: decisive,
      detail: decisive
        ? `decisive read: tilt ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)} — a fresh ${d.bias > 0 ? 'upbeat' : 'worrying'} headline is actively pushing the read`
        : 'quiet — no headline is pushing hard enough to call this a read',
    });
  }
  const sb = scoreboard || null;
  if (sb && sb.n >= 30) {
    const edge = sb.brierMember < sb.brierBase;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `news-catalyst member Brier ${sb.brierMember.toFixed(5)} vs baseline ${sb.brierBase.toFixed(5)} over n=${sb.n} scored forecasts${sb.skill24h && sb.skill24h.n >= 30 ? `; 24h direction hit rate ${(sb.skill24h.hitRate * 100).toFixed(1)}% (n=${sb.skill24h.n})` : ''}`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = degraded
      ? 'Both news feeds were unreachable this cycle and no earlier catalyst was still live — I was blind, so I abstained. A blind newswire reports nothing.'
      : 'The news wire is still being set up — I abstain rather than invent a read.';
    verdictWhy = 'No honest measurement, no signal, no effect. I would rather say "I don\'t know" than invent a number.';
  } else if (isDecisiveNia({ bias: d.bias, active_catalysts: actives.length, warming_up: false, degraded: false })) {
    verdict = 'useful';
    const top = actives.slice(0, 2).map((a) => `"${a.headline.length > 90 ? a.headline.slice(0, 90) + '…' : a.headline}"`).join(' · ');
    finding = `Real catalyst signal this cycle: ${actives.length} live headline${actives.length > 1 ? 's' : ''}, net tilt ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}${d.bias > 0 ? ' (upbeat news — Ripple/XRP-positive)' : d.bias < 0 ? ' (worrying news — Ripple/XRP-negative)' : ''}. Latest: ${top || 'n/a'}.`;
    verdictWhy = 'The catalyst read is decisive and the feeds are healthy — this is the regime my lab exists to catch. Caveat: news moves fast and the market may already have priced it.';
  } else {
    verdict = 'not useful';
    finding = 'Quiet cycle — no relevant, signed catalyst headlines on the wire right now. Nothing to report, so I abstain. Most cycles are quiet; that is normal and honest.';
    verdictWhy = 'A weak read confidently applied is worse than no read. The newswire is calm on the XRP front and I say so.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && Math.abs(d.bias) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(2)}: the news-catalyst tilt nudged the forecast ${d.bias > 0 ? 'up' : 'down'} this cycle.`,
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
      source: 'CoinDesk + CoinTelegraph public RSS feeds (no keys)',
      window: 'headline items parsed each cycle; catalyst list persists with a fading memory of recent headlines',
      catalysts_seen_24h: d && d.catalysts24h != null ? d.catalysts24h : null,
      feeds: d && d.feeds ? d.feeds.map((f) => `${f.name}:${f.ok ? 'ok' : 'down'}`).join(', ') : null,
      pipeline: 'RSS headlines → crypto-relevance filter → signed catalyst detection → fading headline memory → net news tilt',
    },
    computed: d ? {
      bias: d.bias,
      active_catalysts: actives.length,
      warming_up: warmingUp,
      degraded,
      decisive: healthy && isDecisiveNia({ bias: d.bias, active_catalysts: actives.length, warming_up: false, degraded: false }),
      catalysts_24h: d.catalysts24h != null ? d.catalysts24h : null,
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
