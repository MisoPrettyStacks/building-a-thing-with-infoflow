// Nora's lab notebook — one honest per-cycle record of the
// network-health experiment. Pure function, no I/O: safe to unit test.
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
// Nora's voice: network gardener — nurturing, systems-thinking. 💚🌿

export const NORA_PAGE_WINDOW = 120;  // notes embedded in summary.json for the fast page view
// The full notebook is UNBOUNDED: every note is appended to nora-log.jsonl on
// the data branch and kept forever. Nora keeps working until Angelica says otherwise.

// --- permanent-notebook helpers (pure, tested) ---
export function formatNoraLogLine(note) { return JSON.stringify(note); }
export function parseNoraLogLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a corrupt line, keep the rest */ }
  }
  return out;
}

/** A crowd-activity read counts as "decisive" when it is clearly expressive, not a whisper. */
export function isDecisiveNora(computed) {
  if (!computed || computed.warming_up || computed.degraded) return false;
  return Math.abs(computed.activity_z || 0) >= 1.0;
}

function fmtCount(x) {
  if (x == null) return '—';
  const a = Math.abs(x);
  if (a >= 1e6) return (x / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return (x / 1e3).toFixed(1) + 'K';
  return String(Math.round(x));
}

function gardenWord(z) {
  if (z >= 1.0) return 'blooming 🌿';
  if (z <= -1.0) return 'wilting 🍂';
  return 'calm 🌱';
}

export function buildNoraNote({ signal, scoreboard, cycle, barT }) {
  const t = new Date().toISOString();
  const d = signal || null;
  const degraded = !d || !!d.degraded;
  const warmingUp = !!d && !!d.warmingUp;
  const healthy = !degraded && !warmingUp;
  const z = d && Number.isFinite(d.activityZ) ? d.activityZ : 0;

  const checks = [];
  checks.push({
    name: 'feed health',
    pass: !degraded,
    detail: degraded
      ? 'the XRPL scan feed was unreachable or empty this cycle — I saw no payments, so I abstained rather than guessing'
      : 'the XRPL scan feed delivered fresh payments this cycle — real ledger data, nothing invented',
  });
  checks.push({
    name: 'history depth',
    pass: !warmingUp,
    detail: warmingUp
      ? 'my hourly history is still young — crowd comparisons need several days of history before they mean anything, so I abstain'
      : 'several days of hourly buckets on record — the crowd comparisons are honest',
  });
  if (healthy) {
    const decisive = isDecisiveNora({ activity_z: z, warming_up: false, degraded: false });
    const dirWord = z > 0 ? 'blooming (more activity than usual — adoption-like)' : z < 0 ? 'wilting (less activity than usual — attention fading)' : 'steady';
    checks.push({
      name: 'crowd regime',
      pass: decisive,
      detail: decisive
        ? `decisive read: activity ${dirWord}, activity z ${z >= 0 ? '+' : ''}${z.toFixed(2)} — ${fmtCount(d.txCount24h)} payments vs a ${fmtCount(d.txCountMed7d)} 7-day median, ${fmtCount(d.uniqueAddrs24h)} distinct wallets taking part`
        : `calm — the crowd is within its usual rhythm (activity z ${z >= 0 ? '+' : ''}${z.toFixed(2)}), nothing blooming or wilting`,
    });
    checks.push({
      name: 'participation breadth',
      pass: (d.uniqueAddrs24h || 0) > 0,
      detail: (d.uniqueAddrs24h || 0) > 0
        ? `${fmtCount(d.uniqueAddrs24h)} distinct wallets moved XRP in the last 24h — breadth is what I tend most carefully`
        : 'no distinct wallets observed in the window',
    });
  }
  const sb = scoreboard || null;
  if (sb && sb.n >= 30) {
    const edge = sb.brierMember < sb.brierBase;
    checks.push({
      name: 'out-of-sample edge',
      pass: edge,
      detail: `crowd-activity member Brier ${sb.brierMember.toFixed(5)} vs baseline ${sb.brierBase.toFixed(5)} over n=${sb.n} scored forecasts${sb.skill24h && sb.skill24h.n >= 30 ? `; 24h direction hit rate ${(sb.skill24h.hitRate * 100).toFixed(1)}% (n=${sb.skill24h.n})` : ''}`,
    });
  } else {
    checks.push({ name: 'out-of-sample edge', pass: false, detail: 'no scored forecasts yet — the scoreboard is still warming up' });
  }

  let verdict, finding, verdictWhy;
  if (degraded || warmingUp) {
    verdict = 'insufficient data';
    finding = degraded
      ? 'The scan feed was blind this cycle — I saw no payments, so I abstained. An unwatered garden gets no reading.'
      : 'My hourly history is still young — crowd comparisons need several days before they mean anything, so I abstain rather than invent a read.';
    verdictWhy = 'No honest measurement, no signal, no effect. I would rather say "I don\'t know" than invent a number.';
  } else if (isDecisiveNora({ activity_z: z, warming_up: false, degraded: false })) {
    verdict = 'useful';
    finding = `Real crowd signal this cycle: the network is ${gardenWord(z)} — ${fmtCount(d.txCount24h)} payments in 24h (7-day median ${fmtCount(d.txCountMed7d)}), ${fmtCount(d.uniqueAddrs24h)} distinct wallets, ${fmtCount(d.volumeXrp24h)} XRP moved. Activity z ${z >= 0 ? '+' : ''}${z.toFixed(2)} is clearly expressive.`;
    verdictWhy = 'The crowd read is decisive and the feed is healthy — this is the regime my lab exists to catch. Wendy watches the whales; I watch everyone else, and right now everyone else is speaking.';
  } else {
    verdict = 'not useful';
    finding = 'Calm cycle — the crowd is within its usual rhythm, nothing blooming, nothing wilting. Nothing to report, so I abstain. Most cycles are calm; that is normal and honest. 🌿';
    verdictWhy = 'A weak read confidently applied is worse than no read. The garden is quiet and I say so.';
  }

  const weight = (d && d.weight) || 0;
  let mathEffect;
  if (weight > 0 && d && Math.abs(d.bias) > 0) {
    mathEffect = {
      effect: 'applied',
      detail: `Blended into the forecast at weight ${weight.toFixed(2)}: the crowd-activity tilt nudged the forecast ${d.bias > 0 ? 'up' : 'down'} this cycle.`,
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
      source: 'XRP Ledger public payment scans (no keys)',
      window: 'fresh scan payments folded into hourly buckets each cycle; 24h totals vs 7-day medians',
      pipeline: 'scan payments → hourly buckets (30d history) → 24h tx count / distinct wallets / volume vs medians → mean z → slow bounded activity tilt',
    },
    computed: d ? {
      bias: d.bias,
      activity_z: z,
      tx_count_24h: d.txCount24h,
      tx_count_med_7d: d.txCountMed7d,
      unique_addrs_24h: d.uniqueAddrs24h,
      volume_xrp_24h: d.volumeXrp24h,
      warming_up: warmingUp,
      degraded,
      decisive: healthy && isDecisiveNora({ activity_z: z, warming_up: false, degraded: false }),
    } : null,
    checks,
    finding,
    verdict,
    verdict_why: verdictWhy,
    math_effect: mathEffect,
  };
}
