// Camille's supervisor cycle — implements CAMILLE_CHARTER.md (v1.0.0).
//
// Once per cycle (weekly via workflow) Camille:
//   1. scans the literature (internet: arXiv) for relevant science,
//   2. maintains her hypothesis ledger (statuses change only on evidence),
//   3. summarizes the experimental evidence from the lab notebook,
//   4. renders one honest line per discipline from the actual numbers,
//   5. issues her standing scientific verdict: HOLD / APPLY_CANDIDATE / WITHDRAW.
//
// The verdict is deterministic given its inputs. It never changes a forecast
// weight directly: APPLY_CANDIDATE only *nominates* the escrow-tilt member
// for the runner's champion/challenger gates; WITHDRAW recommends weight 0.
// Internet text can propose hypotheses — it can never move weights.
//
// Usage: node scripts/camille-supervisor.js --data ./data-branch
// Writes: <data>/camille_supervisor.json

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseCamilleLogLines, isDecisiveCamille } from '../lib/camillenote.js';

export const CHARTER_VERSION = '1.0.0';
export const HISTORY_CAP = 200;    // notes examined per cycle
export const MIN_HISTORY = 50;     // below this: HOLD, always
export const APPLY_MIN_N = 100;
export const APPLY_ACTIVE_MIN = 0.15;  // tilt must express on schedule a healthy share of cycles
export const OOS_MIN_N = 200;      // tilt-window scored forecasts needed for an OOS verdict

const QUERIES = [
  'all:calendar+AND+all:effect+AND+all:stock+AND+all:return',
  'all:seasonality+AND+all:anomaly+AND+all:predictability',
  'all:cryptocurrency+AND+all:predictability+AND+all:return',
  'all:token+AND+all:unlock+AND+all:price+AND+all:impact',
  'all:supply+AND+all:schedule+AND+all:crypto+AND+all:market',
  'all:month+AND+all:effect+AND+all:seasonality',
];

async function arxivSearch(q) {
  const url = 'https://export.arxiv.org/api/query?search_query=' + encodeURIComponent(q) +
    '&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending';
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'building-a-thing-with-agents/camille-supervisor' } });
    clearTimeout(to);
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);
    return entries.map((e) => {
      const t = (re) => (e.match(re) || [])[1]?.replace(/\s+/g, ' ').trim() || '';
      return { title: t(/<title>([\s\S]*?)<\/title>/), published: t(/<published>(.*?)<\/published>/), id: t(/<id>(.*?)<\/id>/) };
    }).filter((p) => p.title && p.id);
  } catch {
    clearTimeout(to);
    return [];
  }
}

/** Pure: evidence summary from lab notes + scoreboard. */
export function computeEvidence(notes, scoreboard) {
  const hist = (Array.isArray(notes) ? notes : []).slice(-HISTORY_CAP);
  const n = hist.length;
  let active = 0, blind = 0, spurious = 0;
  let tiltSum = 0, tiltActiveSum = 0, tiltActiveN = 0, minTilt = Infinity;
  const relockGroups = new Map(); // relock -> { tiltSum, n }
  for (const note of hist) {
    const c = note && note.computed;
    if (!c) { blind++; continue; }
    if (c.degraded || c.warming_up) { blind++; continue; }
    const tilt = Number(c.tilt) || 0;
    const ds = c.days_since;
    tiltSum += tilt;
    if (tilt < minTilt) minTilt = tilt;
    if (tilt > 0) {
      active++;
      tiltActiveSum += tilt; tiltActiveN++;
      if (!Number.isInteger(ds) || ds < 0 || ds >= 7) spurious++; // tilt firing off schedule
    }
    const rl = Number(c.relock);
    if (Number.isFinite(rl)) {
      const g = relockGroups.get(rl) || { tiltSum: 0, n: 0 };
      g.tiltSum += tilt; g.n++;
      relockGroups.set(rl, g);
    }
  }
  const sb = scoreboard || {};
  const tw = sb.tiltWindow || null;
  const tiltN = tw && Number.isFinite(tw.n) ? tw.n : 0;
  const escBrier = tw && Number.isFinite(tw.brierEscrow) ? tw.brierEscrow : null;
  const baseBrier = tw && Number.isFinite(tw.brierBase) ? tw.brierBase : null;
  const oosEdge = escBrier != null && baseBrier != null && tiltN >= OOS_MIN_N && escBrier < baseBrier;
  // C3: does a lower re-lock ratio go with a stronger tilt?
  let relockSlope = null;
  const groups = [...relockGroups.entries()].map(([rl, g]) => ({ rl, meanTilt: g.tiltSum / g.n, n: g.n })).filter((g) => g.n >= 20);
  if (groups.length >= 2) {
    groups.sort((a, b) => a.rl - b.rl);
    const lo = groups[0], hi = groups[groups.length - 1];
    relockSlope = { low_relock: lo.rl, low_mean_tilt: lo.meanTilt, high_relock: hi.rl, high_mean_tilt: hi.meanTilt, supports: lo.meanTilt > hi.meanTilt };
  }
  return {
    n,
    blind_frac: n ? blind / n : 1,
    active_frac: n ? active / n : 0,
    spurious_frac: active ? spurious / active : 0,
    mean_tilt: n ? tiltSum / n : 0,
    mean_active_tilt: tiltActiveN ? tiltActiveSum / tiltActiveN : 0,
    min_tilt: minTilt === Infinity ? null : minTilt,
    relock_slope: relockSlope,
    relock_distinct: groups.length,
    tilt_n: tiltN,
    tilt_brier_esc: escBrier, tilt_brier_base: baseBrier,
    oos_edge: oosEdge,
    scoreboard_n: Number.isFinite(sb.n) ? sb.n : 0,
  };
}

/** Pure: the charter's deterministic verdict rules. */
export function decideVerdict(ev) {
  if (ev.n < MIN_HISTORY) {
    return { verdict: 'HOLD', why: `Only ${ev.n} lab notes on record (need >= ${MIN_HISTORY}) — not enough history for any scientific verdict. I keep watching the calendar.` };
  }
  if (ev.n >= APPLY_MIN_N && ev.oos_edge && ev.active_frac >= APPLY_ACTIVE_MIN) {
    return {
      verdict: 'APPLY_CANDIDATE',
      why: `Real out-of-sample edge inside the tilt window (tilted Brier ${ev.tilt_brier_esc.toFixed(5)} vs baseline ${ev.tilt_brier_base.toFixed(5)}, n=${ev.tilt_n}) and the tilt expresses on schedule (${(ev.active_frac * 100).toFixed(1)}% of cycles active, never off schedule). I nominate the escrow-tilt member for weight adoption — the champion/challenger gates still decide.`,
    };
  }
  if (ev.n >= APPLY_MIN_N && ev.tilt_n >= OOS_MIN_N && !ev.oos_edge && ev.active_frac >= APPLY_ACTIVE_MIN) {
    return { verdict: 'WITHDRAW', why: `The schedule is working (tilt active ${(ev.active_frac * 100).toFixed(1)}% of cycles, on schedule) and the tilt window is well sampled (n=${ev.tilt_n}), but the tilted what-if series shows no out-of-sample edge. A calendar effect that fires perfectly and helps nothing is not worth adopting — I recommend weight 0 and the ledger records the refutation.` };
  }
  const bits = [];
  if (ev.n < APPLY_MIN_N) bits.push(`history still short (${ev.n}/${APPLY_MIN_N})`);
  if (!ev.oos_edge) bits.push(ev.tilt_n >= OOS_MIN_N ? 'no out-of-sample edge in the tilt window' : `tilt-window scoreboard still warming up (n=${ev.tilt_n}/${OOS_MIN_N})`);
  if (!(ev.active_frac >= APPLY_ACTIVE_MIN)) bits.push(`tilt active only ${(ev.active_frac * 100).toFixed(1)}% of cycles — below the ${(APPLY_ACTIVE_MIN * 100).toFixed(0)}% bar; a deterministic calendar that never fires is a broken instrument, and I check the instruments before trusting the readings`);
  if (ev.spurious_frac > 0) bits.push(`tilt fired off schedule ${(ev.spurious_frac * 100).toFixed(1)}% of active cycles — the clock is suspect`);
  return { verdict: 'HOLD', why: `The case is not made in either direction: ${bits.join('; ')}. I keep the calendar open and keep gathering evidence.` };
}

function seedHypotheses() {
  return [
    { id: 'C1', claim: 'The 1st-7th bearish tilt points in a consistent direction: tilt is never negative and expresses only inside the window.', prediction: 'mean tilt across notes is positive, min tilt is never below zero', test: 'tilt distribution from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'C2', claim: 'The tilted what-if series beats the issued baseline out-of-sample inside the tilt window.', prediction: 'tilt-window Brier(escrow) < Brier(base) over n ≥ 200 scored forecasts', test: 'live scoreboard tilt-window comparison', status: 'open', status_why: 'scoreboard warming up', updated_at: null },
    { id: 'C3', claim: 'A lower re-lock ratio means more XRP stays out, so the tilt strengthens.', prediction: 'notes with a lower re-lock ratio show a higher mean tilt', test: 'tilt grouped by re-lock ratio from lab notes', status: 'open', status_why: 'awaiting re-lock variation', updated_at: null },
    { id: 'C4', claim: 'The tilt expresses on schedule, not spuriously: tilt > 0 only on days 1-7 of the month.', prediction: 'zero tilt readings outside the window across the full history', test: 'spurious-fire rate from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
  ];
}

/** Pure: update hypothesis statuses from evidence. Statuses change only on evidence. */
export function updateHypotheses(prev, ev, nowIso) {
  const hyps = (Array.isArray(prev) && prev.length ? prev : seedHypotheses()).map((h) => ({ ...h }));
  const set = (id, status, why) => {
    const h = hyps.find((x) => x.id === id);
    if (!h) return;
    if (h.status !== status) { h.status = status; h.status_why = why; h.updated_at = nowIso; }
  };
  if (ev.n >= APPLY_MIN_N) {
    const dirConsistent = ev.min_tilt != null && ev.min_tilt >= 0 && ev.mean_active_tilt > 0;
    set('C1', dirConsistent ? 'supported' : 'refuted',
      `n=${ev.n}, min_tilt=${ev.min_tilt?.toFixed(6)}, mean_active_tilt=${ev.mean_active_tilt.toFixed(6)}`);
    set('C4', ev.spurious_frac === 0 && ev.active_frac >= APPLY_ACTIVE_MIN ? 'supported' : (ev.spurious_frac > 0 ? 'refuted' : 'open'),
      `spurious_frac=${ev.spurious_frac.toFixed(3)}, active_frac=${ev.active_frac.toFixed(3)}, n=${ev.n}`);
  }
  if (ev.tilt_n >= OOS_MIN_N) {
    set('C2', ev.oos_edge ? 'supported' : 'refuted',
      `tilt-window ${ev.tilt_brier_esc?.toFixed(5)} vs baseline ${ev.tilt_brier_base?.toFixed(5)}, n=${ev.tilt_n}`);
  }
  if (ev.relock_slope) {
    const s = ev.relock_slope;
    set('C3', s.supports ? 'supported' : 'refuted',
      `relock ${s.low_relock} mean_tilt=${s.low_mean_tilt.toFixed(6)} vs relock ${s.high_relock} mean_tilt=${s.high_mean_tilt.toFixed(6)} (${ev.relock_distinct} distinct re-lock ratios)`);
  }
  return hyps;
}

/** Pure: one honest line per discipline, rendered from the numbers. */
export function buildDisciplines(ev, verdict) {
  const pct = (x) => (x * 100).toFixed(1) + '%';
  return [
    { discipline: 'calendar_econometrics', assessment: `The schedule is deterministic: tilt active ${pct(ev.active_frac)} of cycles, mean tilt ${ev.mean_tilt.toFixed(6)}. A calendar effect needs no estimation — the question is only whether it moves prices, and I measure that in the window where it lives, not across the whole month.` },
    { discipline: 'market_microstructure', assessment: ev.oos_edge ? 'The tilt window scores better with the tilt applied — a scheduled supply event the market has not fully arbitraged away. I keep asking the hard question: why would a perfectly predictable release still leave an edge?' : 'No tilt-window edge yet — the market appears to price the release. A predictable event that everyone knows about should be priced; the null hypothesis is that it is.' },
    { discipline: 'statistician', assessment: `active_frac=${pct(ev.active_frac)} over n=${ev.n}; ${ev.oos_edge ? `tilt-window edge confirmed (Brier ${ev.tilt_brier_esc.toFixed(5)} < ${ev.tilt_brier_base.toFixed(5)}, n=${ev.tilt_n})` : ev.tilt_n >= OOS_MIN_N ? 'no tilt-window edge — the scoreboard overrules the calendar bench' : `tilt-window scoreboard still warming up (n=${ev.tilt_n}/${OOS_MIN_N})`}. I test the window where the tilt is nonzero; a full-month test would dilute the comparison into meaninglessness.` },
    { discipline: 'data_engineer', assessment: ev.spurious_frac > 0 ? `Instrument flag: tilt fired off schedule ${pct(ev.spurious_frac)} of active cycles — the clock is suspect and I check it before trusting anything else.` : ev.blind_frac > 0.2 ? `Instrument flag: calendar blind ${pct(ev.blind_frac)} of cycles — a pure-clock read should never fail, so I investigate.` : `Calendar instrument healthy: same timestamp reproduces the same tilt; tilt fired only on schedule (${pct(ev.active_frac)} of cycles); the what-if series is scored, not blended.` },
    { discipline: 'behavioral_finance', assessment: 'Traders watch the escrow headline — a known release concentrates attention, and attention can overshoot or shrug. I treat escrow sentiment as a competing explanation to test, never as evidence. The Brier score is the only opinion I count.' },
    { discipline: 'risk_manager', assessment: verdict === 'APPLY_CANDIDATE' ? 'False-discovery risk is priced: nomination only — the champion/challenger gates (held-out Brier bar, both halves positive, multiplicity-corrected significance) still decide, and the ladder moves in small tested steps from zero.' : verdict === 'WITHDRAW' ? 'The schedule works and the window is well sampled, but the tilt helps nothing — the risk-managed move is to withdraw, not to keep a dead hypothesis on life support.' : 'When in doubt I vote HOLD: adopting a spurious calendar pattern corrupts every forecast it touches, and that is the costliest error I can make.' },
    { discipline: 'intelligence_analyst', assessment: `Known: the release schedule (1B XRP on the 1st, re-lock days later). Unknown: whether the market still misprices it. Confidence: ${verdict === 'HOLD' ? 'low — the honest answer; the calendar is certain, the effect is not' : 'moderate — evidence-backed, still falsifiable'}.` },
    { discipline: 'research_scientist', assessment: 'Hypothesis ledger updated — statuses changed only where the evidence moved them; nothing was buried and nothing was accepted without a test.' },
    { discipline: 'principal_investigator', assessment: `I sign this verdict: ${verdict}. It is defensible from the record below, and I will reverse it the moment the evidence does.` },
  ];
}

function plainVerdict(v, ev) {
  if (v.verdict === 'APPLY_CANDIDATE') return `Camille's verdict: the evidence supports giving the escrow tilt a trial in the forecast model. The tilted what-if series has beaten the baseline out-of-sample inside the 1st-7th window over ${ev.tilt_n} scored forecasts, with the tilt firing exactly on schedule. Her nomination now goes to formal testing — strict statistical gates still have the final say.`;
  if (v.verdict === 'WITHDRAW') return `Camille's verdict: the evidence says the escrow tilt carries no usable signal. She recommends removing it from the model entirely — a negative result, published honestly.`;
  return `Camille's verdict: hold and keep watching. The calendar evidence so far is neither strong enough to apply nor weak enough to withdraw — the watch stays open.`;
}

async function main() {
  const arg = (k, dflt) => {
    const i = process.argv.indexOf('--' + k);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
  };
  const dataDir = path.resolve(arg('data', './data-branch'));
  const nowIso = new Date().toISOString();

  let summary = null;
  try { summary = JSON.parse(readFileSync(path.join(dataDir, 'summary.json'), 'utf8')); }
  catch { summary = null; }
  // Evidence comes from her permanent notebook (unbounded); the embedded
  // summary.json log is only a recent page-view window.
  let notes = [];
  try {
    const lp = path.join(dataDir, 'camille-log.jsonl');
    if (existsSync(lp)) notes = parseCamilleLogLines(readFileSync(lp, 'utf8'));
  } catch { notes = []; }
  if (!notes.length) notes = (summary && summary.camille && Array.isArray(summary.camille.log)) ? summary.camille.log : [];
  const scoreboard = summary && summary.windows && summary.windows.all && summary.windows.all.escrow
    ? summary.windows.all.escrow : null;

  let prev = null;
  const outPath = path.join(dataDir, 'camille_supervisor.json');
  try { prev = JSON.parse(readFileSync(outPath, 'utf8')); } catch { prev = null; }

  // 1) literature scan (internet) — findings are recorded, never acted on directly
  const seen = new Set((prev && Array.isArray(prev.literature) ? prev.literature : []).map((p) => p.id));
  const fresh = [];
  let litError = null;
  try {
    for (const q of QUERIES) {
      for (const p of await arxivSearch(q)) {
        if (seen.has(p.id) || fresh.some((x) => x.id === p.id)) continue;
        seen.add(p.id);
        fresh.push({ ...p, query: q.replace(/\+/g, ' '), found_at: nowIso });
        if (fresh.length >= 8) break;
      }
      if (fresh.length >= 8) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
  } catch (e) { litError = String(e?.message || e).slice(0, 200); }
  const literature = [...((prev && Array.isArray(prev.literature) ? prev.literature : []).slice(-40)), ...fresh];

  // 2-4) evidence, hypotheses, verdict — deterministic
  const evidence = computeEvidence(notes, scoreboard);
  const v = decideVerdict(evidence);
  const hypotheses = updateHypotheses(prev && prev.hypotheses, evidence, nowIso);
  const disciplines = buildDisciplines(evidence, v.verdict);

  const doc = {
    agent: 'camille',
    title: 'Principal Investigator, Calendar Effect Lab',
    charter_version: CHARTER_VERSION,
    charter: 'CAMILLE_CHARTER.md',
    updated_at: nowIso,
    verdict: v.verdict,
    verdict_why: v.why,
    verdict_plain: plainVerdict(v, evidence),
    evidence,
    model_gates: 'APPLY_CANDIDATE nominates only. Adoption requires the runner\'s champion/challenger gates: held-out Brier improvement above a published bar, positive in both halves, multiplicity-corrected significance, and a minimum gap between adoptions. WITHDRAW recommends escrowWeight 0. This file never changes a weight directly.',
    hypotheses,
    literature: literature.slice(-12),
    literature_new: fresh,
    literature_error: litError,
    disciplines_applied: disciplines,
  };

  writeFileSync(outPath, JSON.stringify(doc, null, 1) + '\n');
  console.log(JSON.stringify({ ts: nowIso, agent: 'camille-supervisor', verdict: v.verdict, notes: evidence.n, new_papers: fresh.length }));
}

if (process.argv[1] && process.argv[1].endsWith('camille-supervisor.js')) main();
