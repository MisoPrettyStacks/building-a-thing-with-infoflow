// Clara's supervisor cycle — implements CLARA_CHARTER.md (v1.0.0).
//
// Once per cycle (weekly via workflow) Clara:
//   1. scans the literature (internet: arXiv) for relevant science,
//   2. maintains her hypothesis ledger (statuses change only on evidence),
//   3. summarizes the experimental evidence from the lab notebook,
//   4. renders one honest line per discipline from the actual numbers,
//   5. issues her standing scientific verdict: HOLD / APPLY_CANDIDATE / WITHDRAW.
//
// The verdict is deterministic given its inputs. It never changes a forecast
// weight directly: APPLY_CANDIDATE only *nominates* the quarter-hour member
// for the runner's champion/challenger gates; WITHDRAW recommends
// weight 0. Internet text can propose hypotheses — it can never move weights.
//
// Usage: node scripts/clara-supervisor.js --data ./data-branch
// Writes: <data>/clara_supervisor.json

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseClaraLogLines } from '../lib/claranote.js';

export const CHARTER_VERSION = '1.0.0';
export const HISTORY_CAP = 200;    // notes examined per cycle
export const MIN_HISTORY = 50;     // below this: HOLD, always
export const APPLY_MIN_N = 100;
export const APPLY_DECISIVE_MIN = 0.40;
export const WITHDRAW_DECISIVE_MAX = 0.15;
export const OOS_MIN_N = 200;      // scored forecasts needed for an OOS verdict
export const SKILL_MIN_N = 30;     // scored 24h reads needed for a skill read

const QUERIES = [
  'all:cryptocurrency+AND+all:periodicity+AND+all:trading',
  'all:quarter+AND+all:hour+AND+all:cryptocurrency+AND+all:returns',
  'all:algorithmic+AND+all:trading+AND+all:periodicity+AND+all:markets',
  'all:intraday+AND+all:seasonality+AND+all:cryptocurrency',
  'all:clock+AND+all:time+AND+all:effects+AND+all:asset+AND+all:prices',
  'all:volume+AND+all:bursts+AND+all:high+AND+all:frequency+AND+all:trading',
];

async function arxivSearch(q) {
  const url = 'https://export.arxiv.org/api/query?search_query=' + encodeURIComponent(q) +
    '&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending';
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'building-a-thing-with-infoflow/clara-supervisor' } });
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
export function computeEvidence(notes, scoreboardBoundary) {
  const hist = (Array.isArray(notes) ? notes : []).slice(-HISTORY_CAP);
  const n = hist.length;
  let decisive = 0, blind = 0, warming = 0;
  let burstSum = 0, burstN = 0, persSum = 0, persN = 0;
  for (const note of hist) {
    const c = note && note.computed;
    if (!c) { blind++; continue; }
    if (c.degraded) { blind++; continue; }
    if (c.warming_up) { warming++; continue; }
    if (c.decisive) decisive++;
    if (Number.isFinite(c.burst)) { burstSum += c.burst; burstN++; }
    if (Number.isFinite(c.persistence)) { persSum += c.persistence; persN++; }
  }
  const sb = scoreboardBoundary || {};
  const memberBrier = Number.isFinite(sb.brierMember) ? sb.brierMember : null;
  const baseBrier = Number.isFinite(sb.brierBase) ? sb.brierBase : null;
  const memberN = Number.isFinite(sb.n) ? sb.n : 0;
  const oosEdge = memberBrier != null && baseBrier != null && memberN >= OOS_MIN_N && memberBrier < baseBrier;
  const sk = sb.skill24h || null;
  const skill = sk && Number.isFinite(sk.hitRate) && sk.n >= SKILL_MIN_N
    ? { hit_rate: sk.hitRate, n: sk.n, beats_baseline: sk.hitRate > sk.baseline }
    : null;
  return {
    n,
    blind_frac: n ? blind / n : 1,
    warming_frac: n ? warming / n : 0,
    decisive_frac: n ? decisive / n : 0,
    mean_burst: burstN ? burstSum / burstN : null,
    mean_persistence: persN ? persSum / persN : null,
    member_brier: memberBrier, base_brier: baseBrier, member_n: memberN,
    oos_edge: oosEdge,
    skill24h: skill,
  };
}

/** Pure: the charter's deterministic verdict rules. */
export function decideVerdict(ev) {
  if (ev.n < MIN_HISTORY) {
    return { verdict: 'HOLD', why: `Only ${ev.n} lab notes on record (need >= ${MIN_HISTORY}) — not enough history for any scientific verdict. I keep watching the clock.` };
  }
  if (ev.n >= APPLY_MIN_N && ev.oos_edge && ev.decisive_frac >= APPLY_DECISIVE_MIN) {
    return {
      verdict: 'APPLY_CANDIDATE',
      why: `Real out-of-sample edge (member Brier ${ev.member_brier.toFixed(5)} vs baseline ${ev.base_brier.toFixed(5)}, n=${ev.member_n}) and the grid actually speaks (${(ev.decisive_frac * 100).toFixed(1)}% of cycles decisive). I nominate the quarter-hour member for weight adoption — the champion/challenger gates still decide.`,
    };
  }
  if (ev.n >= APPLY_MIN_N && !ev.oos_edge && ev.decisive_frac < WITHDRAW_DECISIVE_MAX) {
    return { verdict: 'WITHDRAW', why: `No out-of-sample edge and the grid rarely speaks (decisive only ${(ev.decisive_frac * 100).toFixed(1)}% of cycles). A boundary effect that rarely expresses and never beats the baseline is not an effect — I recommend weight 0 and the ledger records the refutation.` };
  }
  const bits = [];
  if (ev.n < APPLY_MIN_N) bits.push(`history still short (${ev.n}/${APPLY_MIN_N})`);
  if (!ev.oos_edge) bits.push(ev.member_n >= OOS_MIN_N ? 'no out-of-sample edge on the scoreboard' : `scoreboard still warming up (n=${ev.member_n}/${OOS_MIN_N})`);
  if (!(ev.decisive_frac >= APPLY_DECISIVE_MIN)) bits.push(`decisive reads ${(ev.decisive_frac * 100).toFixed(1)}% — below the ${(APPLY_DECISIVE_MIN * 100).toFixed(0)}% bar`);
  if (ev.blind_frac > 0.2) bits.push(`bar data blind ${(ev.blind_frac * 100).toFixed(1)}% of cycles — I check the instruments before trusting the readings`);
  return { verdict: 'HOLD', why: `The case is not made in either direction: ${bits.join('; ')}. I keep the watch open and keep gathering evidence.` };
}

function seedHypotheses() {
  return [
    { id: 'CL1', claim: 'Returns at quarter-hour boundary openings (:00/:15/:30/:45) carry predictable structure that off-grid bars do not.', prediction: 'boundary-issued reads align with subsequent direction more often than chance', test: '24h directional skill vs 0.50 baseline', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'CL2', claim: 'The quarter-hour member beats the baseline forecast out-of-sample on Brier score.', prediction: 'member Brier < baseline Brier over n ≥ 200 scored forecasts', test: 'live scoreboard comparison', status: 'open', status_why: 'scoreboard warming up', updated_at: null },
    { id: 'CL3', claim: 'Volume bursts at boundary bars mark periodic algorithmic flow, and bursts condition the effect: loud boundary bars predict better than quiet ones.', prediction: 'average burst ratio above the off-grid norm in decisive cycles', test: 'burst statistics from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'CL4', claim: 'The boundary effect expresses itself often enough to matter — not a once-a-quarter curiosity.', prediction: 'decisive_frac ≥ 0.40 over rolling history once n ≥ 100', test: 'decisive-read rate from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
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
  if (ev.member_n >= OOS_MIN_N) {
    set('CL2', ev.oos_edge ? 'supported' : 'refuted',
      `member ${ev.member_brier?.toFixed(5)} vs baseline ${ev.base_brier?.toFixed(5)}, n=${ev.member_n}`);
  }
  if (ev.skill24h) {
    set('CL1', ev.skill24h.beats_baseline ? 'supported' : 'refuted',
      `24h hit rate=${(ev.skill24h.hit_rate * 100).toFixed(1)}% vs 50% baseline, n=${ev.skill24h.n}`);
  }
  if (ev.n >= APPLY_MIN_N) {
    set('CL4', ev.decisive_frac >= APPLY_DECISIVE_MIN ? 'supported' : (ev.decisive_frac < WITHDRAW_DECISIVE_MAX ? 'refuted' : 'open'),
      `decisive_frac=${ev.decisive_frac.toFixed(3)} over n=${ev.n}`);
  }
  if (ev.mean_burst != null && ev.n >= APPLY_MIN_N) {
    set('CL3', ev.mean_burst >= 1.2 ? 'supported' : 'refuted',
      `mean burst=${ev.mean_burst.toFixed(2)}x over n=${ev.n}`);
  }
  return hyps;
}

/** Pure: one honest line per discipline, rendered from the numbers. */
export function buildDisciplines(ev, verdict) {
  const pct = (x) => (x * 100).toFixed(1) + '%';
  return [
    { discipline: 'statistician', assessment: `boundary volume runs ${ev.mean_burst != null ? ev.mean_burst.toFixed(2) + 'x' : 'n/a'} the off-grid norm on average; decisive ${pct(ev.decisive_frac)} of cycles. Periodicity is an estimate against a noisy tape, not a fact — hours of grid history are what keep it honest.` },
    { discipline: 'quantitative_finance', assessment: ev.oos_edge ? `Out-of-sample edge is consistent with periodic flow: the grid helps *only when it arrives with volume and agreement*. An unconditional clock rule would have imported every quiet boundary as if it were a signal.` : `No edge to explain — and I will not pretend a quiet boundary bar was ever a signal.` },
    { discipline: 'mathematician', assessment: `A boundary is a definition before it is a discovery: bars opening at minute 0, 15, 30, 45 of the hour. Change the grid definition and the effect must be re-measured — phase is part of the result, and placebo phases are the control.` },
    { discipline: 'risk_manager', assessment: verdict === 'APPLY_CANDIDATE' ? 'False-discovery risk is priced: nomination only — the champion/challenger gates (Brier ≥ 2e-4, both halves positive, Bonferroni α) still decide, and the ladder moves in small tested steps. Clock effects are the easiest patterns to overfit, so the bar stays high.' : verdict === 'WITHDRAW' ? 'A boundary effect that rarely speaks and never beats the baseline is not an effect — the risk-managed move is to withdraw, not to keep a dead hypothesis on life support.' : 'When in doubt I vote HOLD: adopting noise corrupts every forecast it touches, and that is the costliest error I can make.' },
    { discipline: 'data_engineer', assessment: ev.blind_frac > 0.2 ? `Instrument flag: bar data blind ${pct(ev.blind_frac)} of cycles — a feed gap at a boundary bar masquerades as a quiet grid unless you check liveness, and I check.` : `Pipeline healthy: the bar series readable ${pct(1 - ev.blind_frac)} of cycles; timestamps exact, boundary bars identified by the clock and never interpolated; same bars reproduce the same numbers.` },
    { discipline: 'trader', assessment: 'Everyone can see the clock — that is precisely the problem. If boundary flow were a free lunch, the crowd standing at :00/:15/:30/:45 would have eaten it. The edge, if any, is in conditioning on the burst and the agreement, not in "the quarter-hour moved." That is why no APPLY verdict of mine ever skips out-of-sample proof.' },
    { discipline: 'intelligence_analyst', assessment: `Known: decisive ${pct(ev.decisive_frac)} of cycles, mean sign persistence ${ev.mean_persistence != null ? pct(ev.mean_persistence) : 'n/a'}. Unknown: whether the phase structure survives the next change in who trades this market and when. Confidence: ${verdict === 'HOLD' ? 'low — the honest answer' : 'moderate — evidence-backed, still falsifiable'}.` },
    { discipline: 'research_scientist', assessment: 'Hypothesis ledger updated — statuses changed only where the evidence moved them; nothing was buried and nothing was accepted without a test.' },
    { discipline: 'principal_investigator', assessment: `I sign this verdict: ${verdict}. It is defensible from the record below, and I will reverse it the moment the evidence does.` },
  ];
}

function plainVerdict(v, ev) {
  if (v.verdict === 'APPLY_CANDIDATE') return `Clara's verdict: the evidence supports giving the quarter-hour signal a trial in the forecast model. Boundary bars arriving with volume and agreement have beaten the baseline out-of-sample over ${ev.member_n} scored forecasts. Her nomination now goes to formal testing — strict statistical gates still have the final say.`;
  if (v.verdict === 'WITHDRAW') return `Clara's verdict: the evidence says the clock grid carries no usable signal here. She recommends removing it from the model entirely — a negative result, published honestly.`;
  return `Clara's verdict: hold and keep watching. The boundary evidence so far is neither strong enough to apply nor weak enough to withdraw — the watch stays open, ticking.`;
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
    const lp = path.join(dataDir, 'clara-log.jsonl');
    if (existsSync(lp)) notes = parseClaraLogLines(readFileSync(lp, 'utf8'));
  } catch { notes = []; }
  if (!notes.length) notes = (summary && summary.clara && Array.isArray(summary.clara.log)) ? summary.clara.log : [];
  const scoreboardBoundaryRaw = summary && summary.windows && summary.windows.all && summary.windows.all.boundary
    ? summary.windows.all.boundary : null;
  const scoreboardBoundary = scoreboardBoundaryRaw
    ? { n: scoreboardBoundaryRaw.n, brierMember: scoreboardBoundaryRaw.brierBoundary, brierBase: scoreboardBoundaryRaw.brierBase, skill24h: scoreboardBoundaryRaw.skill24h }
    : null;

  let prev = null;
  const outPath = path.join(dataDir, 'clara_supervisor.json');
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
  const evidence = computeEvidence(notes, scoreboardBoundary);
  const v = decideVerdict(evidence);
  const hypotheses = updateHypotheses(prev && prev.hypotheses, evidence, nowIso);
  const disciplines = buildDisciplines(evidence, v.verdict);

  const doc = {
    agent: 'clara',
    title: 'Principal Investigator, Quarter-Hour Boundary Lab',
    charter_version: CHARTER_VERSION,
    charter: 'CLARA_CHARTER.md',
    updated_at: nowIso,
    verdict: v.verdict,
    verdict_why: v.why,
    verdict_plain: plainVerdict(v, evidence),
    evidence,
    model_gates: 'APPLY_CANDIDATE nominates only. Adoption requires the runner\'s champion/challenger gates: held-out Brier improvement ≥ 2e-4, positive in both halves, family-wise α=0.05 with Bonferroni correction, ≥24h between adoptions. WITHDRAW recommends boundaryWeight 0. This file never changes a weight directly.',
    hypotheses,
    literature: literature.slice(-12),
    literature_new: fresh,
    literature_error: litError,
    disciplines_applied: disciplines,
  };

  writeFileSync(outPath, JSON.stringify(doc, null, 1) + '\n');
  console.log(JSON.stringify({ ts: nowIso, agent: 'clara-supervisor', verdict: v.verdict, notes: evidence.n, new_papers: fresh.length }));
}

if (process.argv[1] && process.argv[1].endsWith('clara-supervisor.js')) main();
