// Masha's lab notebook — one honest per-cycle record of the
// information-flow experiment. Pure function, no I/O: safe to unit test.
//
// Each note answers, in plain English:
//   1. What data was collected this cycle?
//   2. What was computed from it?
//   3. What did the agent find?
//   4. Is it useful — how and why (or why not)?
//   5. What mathematical effect did it have on the forecast?
//
// Saved to the data branch every cycle whether or not the member is used.

export const LAB_Z_THRESHOLD = 2;    // significance bar for the 50-shuffle surrogate test
export const LAB_MIN_ALIGNED = 100;  // minimum aligned BTC/XRP bars for an honest measurement
export const LAB_NOISE_PE = 0.85;    // permutation-entropy noise-regime threshold
export const LAB_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to masha-log.jsonl on
// the data branch and kept forever. Masha keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatLogLine(note) { return JSON.stringify(note); }
export function parseLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

export function buildLabNote({ infoflow, windowsAll, cycle, barT, xrpBars, btcBars }) {
  const t = new Date().toISOString();
  const d = infoflow || null;
  const aligned = d && Number.isFinite(d.window_bars) ? d.window_bars : 0;
  const enough = !!d && aligned >= LAB_MIN_ALIGNED;

  const checks = [];
  checks.push({
    name: 'data sufficiency',
    pass: enough,
    detail: enough
      ? `${aligned} aligned BTC/XRP 5-min bars in the 24h window (need >= ${LAB_MIN_ALIGNED})`
      : `only ${aligned} aligned bars (need >= ${LAB_MIN_ALIGNED}) — too thin to measure honestly`,
  });
  if (enough) {
    checks.push({
      name: 'significance (BTC→XRP)',
      pass: d.z_btc_xrp > LAB_Z_THRESHOLD,
      detail: `z = ${d.z_btc_xrp.toFixed(2)} from shuffle surrogates (significance bar)`,
    });
    checks.push({
      name: 'flow direction',
      pass: d.net > 0,
      detail: `net ${d.net >= 0 ? '+' : ''}${d.net.toFixed(4)} nats (${d.net > 0 ? 'BTC leads XRP' : d.net < 0 ? 'XRP leads BTC' : 'balanced'})`,
    });
    checks.push({
      name: 'noise regime',
      pass: !d.noisy,
      detail: `permutation entropy ${d.perm_entropy.toFixed(4)} ${d.noisy ? `— noise-dominated, any signal drowns` : `— ordered enough to listen`}`,
    });
  }
  const mem = windowsAll && windowsAll.members ? windowsAll.members.infoflow : null;
  const memN = windowsAll && windowsAll.members ? windowsAll.members.infoflow_n : null;
  const ensBrier = windowsAll ? windowsAll.brier : null;
  if (mem != null && ensBrier != null && memN) {
    const edge = mem < ensBrier;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `member Brier ${mem.toFixed(5)} vs ensemble ${ensBrier.toFixed(5)} over n=${memN} scored forecasts`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  const weight = (d && d.weight) || 0;
  if (!enough) {
    verdict = 'insufficient data';
    finding = `Only ${aligned} usable BTC/XRP bars this cycle — not enough to measure information flow honestly, so I skipped the computation rather than guessing.`;
    verdictWhy = 'No measurement, no vote, no effect. I would rather say "I don\'t know" than invent a number.';
  } else if (d.z_btc_xrp > LAB_Z_THRESHOLD && d.net > 0) {
    verdict = 'useful';
    finding = `BTC is carrying real, significant information about XRP's next move: TE = ${d.te_btc_xrp.toFixed(4)} nats with z = ${d.z_btc_xrp.toFixed(2)} — that clears my significance bar. I vote P(up) = ${d.vote.toFixed(3)}.`;
    verdictWhy = `The shuffle test says this flow beats chance (above my significance bar), and the net direction favors BTC→XRP.`;
  } else {
    verdict = 'not useful';
    const whyBits = [];
    if (!(d.z_btc_xrp > LAB_Z_THRESHOLD)) whyBits.push(`z = ${d.z_btc_xrp.toFixed(2)} is inside chance noise (below my significance bar)`);
    if (!(d.net > 0)) whyBits.push(`net flow ${d.net.toFixed(4)} does not favor BTC→XRP`);
    if (d.noisy) whyBits.push(`the market is in a noise regime (PE ${d.perm_entropy.toFixed(3)} — too noisy to trust)`);
    finding = `Measured BTC→XRP flow of ${d.te_btc_xrp.toFixed(4)} nats, but ${whyBits.join('; ')}. I'm abstaining (vote 0.50) — a weak signal confidently applied is worse than no signal.`;
    verdictWhy = 'The numbers do not clear the bar for a real edge, so the honest answer is "not yet".';
  }

  let mathEffect;
  if (weight > 0 && d && d.vote !== 0.5) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(3)}: this member moved P(up) by ${((d.vote - 0.5) * weight).toFixed(4)} this cycle.`,
    };
  } else if (weight > 0) {
    mathEffect = { effect: 'none', detail: `Weight is ${weight.toFixed(3)} but I abstained (vote 0.50) — an abstention changes nothing mathematically.` };
  } else {
    mathEffect = { effect: 'none', detail: 'No mathematical effect on the forecast — my member weight is 0.00, so I am scored but never blended in.' };
  }

  return {
    t,
    cycle,
    bar_t: barT,
    collected: {
      source: 'Coinbase Exchange public candles',
      products: ['XRP-USD', 'BTC-USD'],
      xrp_bars: xrpBars,
      btc_bars: btcBars,
      window: '288 bars / 24h of 5-minute close log-returns',
      aligned_bars: aligned,
      pipeline: 'quantile bins (3) → TE both directions → 50 shuffle surrogates → permutation-entropy noise check',
    },
    computed: d ? {
      te_btc_xrp: d.te_btc_xrp,
      te_xrp_btc: d.te_xrp_btc,
      net: d.net,
      z_btc_xrp: d.z_btc_xrp,
      z_xrp_btc: d.z_xrp_btc,
      perm_entropy: d.perm_entropy,
      noisy: d.noisy,
      vote: d.vote,
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
