// Cherry's lab notebook — one honest per-cycle record of the
// correlation-regime experiment. Pure function, no I/O: safe to unit test.
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

export const CHERRY_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to cherry-log.jsonl on
// the data branch and kept forever. Cherry keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatCherryLogLine(note) { return JSON.stringify(note); }
export function parseCherryLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A coupling read counts as "decisive" when coupled AND the bias speaks above a whisper. */
export function isDecisiveCherry(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  if (!computed.coupled) return false;
  return Math.abs(computed.bias || 0) >= 0.004;
}

export function buildCherryNote({ signal, scoreboard, cycle, barT }) {
  const t = new Date().toISOString();
  const d = signal || null;
  const degraded = !d || !!d.degraded;
  const warmingUp = !!d && !!d.warmingUp;
  const healthy = !degraded && !warmingUp;
  const coupled = healthy && !!d.coupled;

  const checks = [];
  checks.push({
    name: 'data health',
    pass: !degraded,
    detail: degraded
      ? 'the bar history was unusable this cycle — I emit no read rather than guess from broken inputs'
      : 'both XRP and BTC bar series read cleanly from the lab\u2019s own candles',
  });
  checks.push({
    name: 'history depth',
    pass: !warmingUp,
    detail: warmingUp
      ? 'fewer than a full day of overlapping XRP/BTC bars — correlation needs a day of shared history before I trust it, so I abstain'
      : 'a full day of aligned XRP/BTC bars on record — the coupling measurement is honest',
  });
  if (healthy) {
    const decisive = isDecisiveCherry({ bias: d.bias, coupled, warming_up: false, degraded: false });
    checks.push({
      name: 'coupling regime',
      pass: decisive,
      detail: coupled
        ? (decisive
          ? `coupled regime: BTC's recent drift is a legitimate read on XRP, bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}`
          : 'coupled, but BTC\u2019s recent drift is a whisper — I keep my tilt at zero rather than amplify noise')
        : 'decoupled regime: XRP and BTC are walking their own paths this cycle — I follow nothing and abstain',
    });
  }
  const sb = scoreboard || null;
  if (sb && sb.n >= 30) {
    const edge = sb.brierMember < sb.brierBase;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `correlation-regime member Brier ${sb.brierMember.toFixed(5)} vs baseline ${sb.brierBase.toFixed(5)} over n=${sb.n} scored forecasts${sb.skill24h && sb.skill24h.n >= 30 ? `; 24h direction hit rate ${(sb.skill24h.hitRate * 100).toFixed(1)}% (n=${sb.skill24h.n})` : ''}`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = warmingUp
      ? 'My overlapping XRP/BTC history is still building — correlation needs a full day of shared bars before it means anything, so I abstain rather than invent a read.'
      : 'The bar data was unusable this cycle — I was blind, so I abstained. A blind lab reports nothing.';
    verdictWhy = 'No honest measurement, no signal, no effect. I would rather say "I don\'t know" than invent a number.';
  } else if (coupled && isDecisiveCherry({ bias: d.bias, coupled, warming_up: false, degraded: false })) {
    verdict = 'useful';
    const dir = d.bias > 0 ? 'bullish' : 'bearish';
    finding = `Coupled regime with a real BTC drift: XRP is tracking BTC, and BTC's recent direction is ${dir}, bias ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}. The coupling estimate over the last day is ${d.corr24h != null ? d.corr24h.toFixed(3) : 'unavailable'}.`;
    verdictWhy = 'The coupling read is decisive — this is exactly the regime my lab exists to catch: XRP following BTC, not noise.';
  } else if (coupled) {
    verdict = 'not useful';
    finding = 'Coupled regime, but BTC\u2019s recent drift is too small to matter — amplifying a whisper would be noise, not signal. I abstain.';
    verdictWhy = 'Conditionality cuts both ways: coupling alone is not a signal, it only licenses one. No drift, no tilt.';
  } else {
    verdict = 'not useful';
    finding = 'Decoupled regime — XRP and BTC are moving independently this cycle. Following BTC now would be importing someone else\u2019s noise, so I abstain.';
    verdictWhy = 'My rule is conditional by design. When the pair decouples, the honest answer is to say nothing.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && Math.abs(d.bias) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(2)}: the coupling tilt nudged the forecast ${d.bias > 0 ? 'up' : 'down'} this cycle.`,
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
      source: 'the lab\u2019s own 5-minute XRP and BTC candles (no keys, no external fetch)',
      window: 'XRP and BTC bars aligned by timestamp; correlation over the last day of shared bars',
      bars: d && d.barCount != null ? d.barCount : null,
      pipeline: 'align bars by timestamp → log returns of closes → rolling correlation of returns → conditional bias from BTC\u2019s recent drift when coupled',
    },
    computed: d ? {
      bias: d.bias,
      corr_24h: d.corr24h,
      coupled: !!d.coupled,
      btc_mom_1h: d.btcMom1h,
      warming_up: warmingUp,
      degraded,
      decisive: healthy && isDecisiveCherry({ bias: d.bias, coupled: !!d.coupled, warming_up: false, degraded: false }),
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
