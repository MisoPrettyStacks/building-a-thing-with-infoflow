// Sage's lab notebook — one honest per-cycle record of the
// stablecoin-flow experiment. Pure function, no I/O: safe to unit test.
//
// Each note answers, in plain English:
//   1. What data was collected this cycle?
//   2. What was computed from it?
//   3. What did the agent find?
//   4. Is it useful — how and why (or why not)?
//   5. What mathematical effect did it have on the forecast?
//
// Saved to the data branch every cycle whether or not the member is used.
// The tilt bar stays conceptual in prose; exact thresholds stay in code.
//
// Sage's voice here: liquidity zen — calm, unhurried, honest about the
// slowness of her own data.

export const SAGE_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to sage-log.jsonl on
// the data branch and kept forever. Sage keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatSageLogLine(note) { return JSON.stringify(note); }
export function parseSageLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A liquidity read counts as "decisive" when it is expressive, not a whisper. */
export function isDecisiveSage(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  if (typeof computed.decisive === 'boolean') return computed.decisive;
  return Math.abs(computed.bias || 0) >= 0.003;
}

export function buildSageNote({ signal, scoreboard, cycle, barT }) {
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
      ? 'CoinGecko API unreachable and no cached read to fall back on — I was blind this cycle, so I abstained rather than guessing'
      : d.staleNote
        ? 'CoinGecko API unreachable — ' + d.staleNote + '. A stale tide is better than an invented one, but I read it with care'
        : d.cached
          ? 'reading from the hourly cache — the free API is rate-limited, so I fetch at most once an hour and rest on the last good read'
          : 'CoinGecko API reachable — fresh USDT + USDC market-cap reads this cycle',
  });
  if (healthy) {
    const decisive = isDecisiveSage({
      bias: d.bias, warming_up: false, degraded: false,
      decisive: typeof d.decisive === 'boolean' ? d.decisive : undefined,
    });
    checks.push({
      name: 'liquidity regime',
      pass: decisive,
      detail: decisive
        ? `decisive read: liquidity tilt ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)} (${d.bias > 0 ? 'supply expanding — fresh fiat parking on-chain' : 'supply contracting — fiat withdrawing from the ecosystem'}), on a combined 24h change of ${d.totalChange != null ? (d.totalChange >= 0 ? '+' : '') + d.totalChange.toFixed(2) + '%' : '—'}`
        : 'quiet — the combined 24h stablecoin change sits inside neutral bounds. The tide is barely breathing today.',
    });
    checks.push({
      name: 'horizon honesty',
      pass: true,
      detail: 'my data moves in days, not minutes — I read a liquidity tide, not a timer. Any link to 15-minute XRP direction is thin, and I say so every cycle rather than pretending otherwise.',
    });
  }
  const sb = scoreboard || null;
  if (sb && sb.n >= 30) {
    const edge = sb.brierMember < sb.brierBase;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `stablecoin-flow member Brier ${sb.brierMember.toFixed(5)} vs baseline ${sb.brierBase.toFixed(5)} over n=${sb.n} scored forecasts${sb.skill24h && sb.skill24h.n >= 30 ? `; 24h direction hit rate ${(sb.skill24h.hitRate * 100).toFixed(1)}% (n=${sb.skill24h.n}) — the meaningful read for a slow signal` : ''}`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = degraded
      ? 'No stablecoin read this cycle — the feed was blind and there was nothing honest to fall back on. I abstained. A quiet lab reports nothing.'
      : 'My feed is warming up — I need one clean read before the tide means anything, so I abstain rather than invent one.';
    verdictWhy = 'No honest measurement, no signal, no effect. I would rather say "I don\'t know" than invent a number.';
  } else if (isDecisiveSage({
    bias: d.bias, warming_up: false, degraded: false,
    decisive: typeof d.decisive === 'boolean' ? d.decisive : undefined,
  })) {
    verdict = 'useful';
    const dir = d.bias > 0
      ? 'supply expanding — fiat flowing into the ecosystem, a mild bullish tide'
      : 'supply contracting — fiat leaving the ecosystem, a mild bearish tide';
    finding = `Real liquidity signal this cycle: ${dir}, tilt ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}. USDT moved ${d.usdtChange24h != null ? (d.usdtChange24h >= 0 ? '+' : '') + d.usdtChange24h.toFixed(2) + '%' : '—'} and USDC ${d.usdcChange24h != null ? (d.usdcChange24h >= 0 ? '+' : '') + d.usdcChange24h.toFixed(2) + '%' : '—'} over 24h. Still: this is a tide, not a timer — treat it as background liquidity, not a 15-minute call.`;
    verdictWhy = 'The liquidity read is decisive and the feed is healthy — this is the regime my lab exists to catch, calmly.';
  } else {
    verdict = 'not useful';
    finding = 'Quiet cycle — the combined 24h stablecoin change sits inside neutral bounds. Nothing to report, so I abstain. Most tides move slowly; that is normal and honest.';
    verdictWhy = 'A weak read confidently applied is worse than no read. The pool is calm and I say so.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && Math.abs(d.bias) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(2)}: the liquidity tilt nudged the forecast ${d.bias > 0 ? 'up' : 'down'} this cycle.`,
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
      source: 'CoinGecko free API (no keys)',
      assets: ['tether (USDT)', 'usd-coin (USDC)'],
      window: '24h market-cap change per asset, summed; refetched at most once per hour, cached between',
      cached: !!(d && d.cached),
      stale_note: (d && d.staleNote) || null,
      pipeline: 'USDT+USDC 24h market-cap change → combined change → gentle capped liquidity tilt',
    },
    computed: d ? {
      bias: d.bias,
      total_change_24h: d.totalChange,
      usdt_change_24h: d.usdtChange24h,
      usdc_change_24h: d.usdcChange24h,
      warming_up: warmingUp,
      degraded,
      decisive: healthy && isDecisiveSage({
        bias: d.bias, warming_up: false, degraded: false,
        decisive: typeof d.decisive === 'boolean' ? d.decisive : undefined,
      }),
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
