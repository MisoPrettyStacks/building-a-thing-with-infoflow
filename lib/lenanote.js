// Lena's lab notebook — one honest per-cycle record of the
// venue lead-lag experiment. Pure function, no I/O: safe to unit test.
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

export const LENA_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to lena-log.jsonl on
// the data branch and kept forever. Lena keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatLenaLogLine(note) { return JSON.stringify(note); }
export function parseLenaLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A lead-lag read counts as "decisive" when healthy AND the bias speaks above a whisper. */
export function isDecisiveLena(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  return Math.abs(computed.bias || 0) >= 0.004;
}

export function buildLenaNote({ signal, scoreboard, cycle, barT }) {
  const t = new Date().toISOString();
  const d = signal || null;
  const degraded = !d || !!d.degraded;
  const warmingUp = !!d && !!d.warmingUp;
  const healthy = !degraded && !warmingUp;
  const decisive = healthy && isDecisiveLena({ bias: d.bias, warming_up: false, degraded: false });

  const checks = [];
  checks.push({
    name: 'data health',
    pass: !degraded,
    detail: degraded
      ? 'Binance was unreachable or its candles were unusable this cycle — I emit no read rather than guess from broken inputs'
      : 'Binance and Coinbase bar series both read cleanly; the cross-venue comparison is real',
  });
  checks.push({
    name: 'history depth',
    pass: !warmingUp,
    detail: warmingUp
      ? 'too few aligned Binance/Coinbase bars yet — a lead-lag read needs shared history before it means anything, so I abstain'
      : 'enough aligned cross-venue bars on record — the gap and lead measurements are honest',
  });
  if (healthy) {
    const gapTxt = d.gapBps != null ? `${d.gapBps >= 0 ? '+' : ''}${d.gapBps.toFixed(1)} bps` : 'unavailable';
    const leadTxt = d.leadRetBps != null ? `${d.leadRetBps >= 0 ? '+' : ''}${d.leadRetBps.toFixed(1)} bps` : 'unavailable';
    checks.push({
      name: 'lead-lag read',
      pass: decisive,
      detail: decisive
        ? `Binance is trading ahead of Coinbase (gap ${gapTxt}, recent lead ${leadTxt}) — the propagation read is expressive, bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}`
        : `the venues are in step (gap ${gapTxt}, recent lead ${leadTxt}) — no propagation to read, so I keep my tilt at zero rather than amplify noise`,
    });
  }
  const sb = scoreboard || null;
  if (sb && sb.n >= 30) {
    const edge = sb.brierMember < sb.brierBase;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `venue lead-lag member Brier ${sb.brierMember.toFixed(5)} vs baseline ${sb.brierBase.toFixed(5)} over n=${sb.n} scored forecasts${sb.skill24h && sb.skill24h.n >= 30 ? `; 24h direction hit rate ${(sb.skill24h.hitRate * 100).toFixed(1)}% (n=${sb.skill24h.n})` : ''}`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = warmingUp
      ? 'My aligned Binance/Coinbase history is still building — a lead-lag read needs shared bars before it means anything, so I abstain rather than invent a read.'
      : 'Binance was unreachable this cycle — I was blind on one venue, so I abstained. A blind lab reports nothing.';
    verdictWhy = 'No honest measurement, no signal, no effect. I would rather say "I don\'t know" than invent a number.';
  } else if (decisive) {
    verdict = 'useful';
    const dir = d.bias > 0 ? 'above' : 'below';
    const gapTxt = d.gapBps != null ? `${d.gapBps >= 0 ? '+' : ''}${d.gapBps.toFixed(1)} bps` : 'unavailable';
    finding = `Binance is leading: it closed ${dir} Coinbase (gap ${gapTxt}) and its recent drift is still ahead. If the usual propagation holds, Coinbase has catching up to do — bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)} over ${d.aligned != null ? d.aligned : 'the available'} aligned bars.`;
    verdictWhy = 'The lead is expressive, both venues are healthy, and the read is exactly the propagation my lab exists to catch.';
  } else {
    verdict = 'not useful';
    finding = 'The venues are in step — Binance shows no lead worth following this cycle. Chasing a gap that is not there would be importing noise, so I abstain.';
    verdictWhy = 'Lead-lag is conditional by design. When Binance is not ahead, the honest answer is to say nothing.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && Math.abs(d.bias) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(2)}: the lead-lag tilt nudged the forecast ${d.bias > 0 ? 'up' : 'down'} this cycle.`,
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
      source: 'Binance XRPUSDT 5-minute klines against the lab\u2019s own Coinbase XRP 5-minute candles (no keys, public endpoints)',
      window: 'Binance closes aligned to Coinbase bar timestamps; the most recent hours of shared bars',
      bars: d && d.aligned != null ? d.aligned : null,
      pipeline: 'align venue closes by bar timestamp → level gap between the venue closes → short-window lead return (Binance drift minus Coinbase drift) → capped cross-venue bias',
    },
    computed: d ? {
      bias: d.bias,
      gap_bps: d.gapBps,
      lead_ret_bps: d.leadRetBps,
      aligned: d.aligned != null ? d.aligned : null,
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
