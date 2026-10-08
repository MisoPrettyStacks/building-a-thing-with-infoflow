// Ophelia's lab notebook — one honest per-cycle record of the
// on-chain-flow-health experiment. Pure function, no I/O: safe to unit test.
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

export const OPHELIA_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to ophelia-log.jsonl on
// the data branch and kept forever. Ophelia keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatOpheliaLogLine(note) { return JSON.stringify(note); }
export function parseOpheliaLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A flow-health read counts as "decisive" when it takes a real side, not a whisper. */
export function isDecisiveOphelia(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  return Math.abs(computed.bias || 0) >= 0.005; // a real tilt, not a whisper
}

export function buildOpheliaNote({ signal, scoreboard, cycle, barT }) {
  const t = new Date().toISOString();
  const d = signal || null;
  const degraded = !d || !!d.degraded;
  const warmingUp = !!d && !!d.warmingUp;
  const healthy = !degraded && !warmingUp;

  const checks = [];
  checks.push({
    name: 'snapshot health',
    pass: !degraded,
    detail: degraded
      ? `no usable exchange-wallet balance snapshots this cycle${d && d.reason ? ` — ${d.reason}` : ''} — I saw nothing this cycle, so I abstained rather than guessing`
      : `${d.wallets || '?'} tracked exchange wallets measured against the snapshot nearest 24h ago — a real aggregate flow read this cycle`,
  });
  if (healthy) {
    const vel = d.flowVelocity || 0;
    const br = d.breadth || 0;
    const net = d.totalNetFlow || 0;
    const dir = net > 0 ? 'inflow (coins moving toward exchanges — distribution pressure)' : net < 0 ? 'outflow (coins moving off exchanges — accumulation)' : 'net flat (no aggregate direction)';
    checks.push({
      name: 'flow read',
      pass: true,
      detail: `24h aggregate net flow ${(net >= 0 ? '+' : '')}${(net / 1e6).toFixed(2)}M XRP — ${dir}; velocity ${(vel * 100).toFixed(2)}% of tracked balances turned over in 24h; breadth ${(br * 100).toFixed(0)}% of wallets moving with the aggregate`,
    });
    const decisive = isDecisiveOphelia({ bias: d.bias, warming_up: false, degraded: false });
    checks.push({
      name: 'regime',
      pass: decisive,
      detail: decisive
        ? `decisive read: tilt ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)} (${net > 0 ? 'bearish — exchange inventories are building' : 'bullish — exchange inventories are draining'}). This is a slow regime read — it speaks in days, not candles.`
        : 'quiet — aggregate drift is a whisper this cycle. Flow health is a slow signal; most cycles are calm, and I say so.',
    });
  }
  const sb = scoreboard || null;
  // accept the raw windows.all.flowhealth key (brierFlowHealth) or the normalized key (brierMember)
  const memberBrier = sb ? (Number.isFinite(sb.brierMember) ? sb.brierMember : sb.brierFlowHealth) : null;
  const baseBrier = sb ? sb.brierBase : null;
  if (sb && sb.n >= 30 && Number.isFinite(memberBrier) && Number.isFinite(baseBrier)) {
    const edge = memberBrier < baseBrier;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `flow-health member Brier ${memberBrier.toFixed(5)} vs baseline ${baseBrier.toFixed(5)} over n=${sb.n} scored forecasts${sb.skill24h && sb.skill24h.n >= 30 ? `; 24h direction hit rate ${(sb.skill24h.hitRate * 100).toFixed(1)}% (n=${sb.skill24h.n})` : ''}`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = degraded
      ? 'No usable balance snapshots this cycle — I saw nothing, so I abstained. A blind flow ledger reports nothing.'
      : `Still warming up — ${d.wallets || '?'} wallets measured but less than 72h of snapshot history. Flow health is a slow signal and it needs slow data; I abstain until the history is honest.`;
    verdictWhy = 'No honest measurement, no signal, no effect. I would rather say "I don\'t know" than invent a number.';
  } else if (isDecisiveOphelia({ bias: d.bias, warming_up: false, degraded: false })) {
    verdict = 'useful';
    const net = d.totalNetFlow || 0;
    const dir = net > 0
      ? 'inflow tilt — coins moving toward exchanges, distribution pressure, bearish'
      : 'outflow tilt — coins moving off exchanges into custody, accumulation, bullish';
    finding = `Real flow-health read this cycle: ${dir}, tilt ${d.bias >= 0 ? '+' : ''}${d.bias.toFixed(4)}, velocity ${((d.flowVelocity || 0) * 100).toFixed(2)}%, breadth ${((d.breadth || 0) * 100).toFixed(0)}% of ${d.wallets || '?'} wallets.`;
    verdictWhy = 'The tracked exchange-wallet set took a genuine side and the snapshots are healthy — this is the regime my lab exists to catch.';
  } else {
    verdict = 'not useful';
    finding = 'Quiet cycle — aggregate drift is a whisper, breadth unconvincing, no regime to report. I abstain. Most cycles are calm; that is normal and honest.';
    verdictWhy = 'A weak read confidently applied is worse than no read. The flows are calm and I say so.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && Math.abs(d.bias) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(2)}: the flow-health tilt nudged the forecast ${d.bias > 0 ? 'up' : 'down'} this cycle.`,
    };
  } else if (weight > 0) {
    mathEffect = { effect: 'none', detail: `Weight is ${weight.toFixed(2)} but I abstained (no decisive read) — an abstention changes nothing mathematically.` };
  } else {
    mathEffect = { effect: 'none', detail: 'No mathematical effect on the forecast — my flowHealthWeight is 0, so I am scored but never blended in. Scored every cycle either way: the evidence keeps accumulating.' };
  }

  return {
    t,
    cycle,
    bar_t: barT,
    collected: {
      source: 'XRPL exchange-wallet balance snapshots from the runner (no keys)',
      window: '24h per-wallet net flows vs the snapshot nearest 24h ago; aggregate drift, velocity, and breadth computed each cycle',
      snapshots: (d && d.wallets) ? `${d.wallets} tracked exchange wallets` : null,
      pipeline: 'latest balances vs t-24h reference -> per-wallet net flows -> aggregate drift -> velocity (|net|/balances) and breadth (same-sign fraction) -> small bounded tilt from the aggregate drift',
    },
    computed: d ? {
      bias: d.bias,
      flow_velocity: d.flowVelocity,
      breadth: d.breadth,
      total_net_flow: d.totalNetFlow,
      wallets: d.wallets,
      warming_up: warmingUp,
      degraded,
      decisive: healthy && isDecisiveOphelia({ bias: d.bias, warming_up: false, degraded: false }),
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
