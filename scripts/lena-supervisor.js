// Lena's supervisor cycle — implements LENA_CHARTER.md (v1.0.0).
//
// Once per cycle (weekly via workflow) Lena:
//   1. scans the literature (internet: arXiv) for relevant science,
//   2. maintains her hypothesis ledger (statuses change only on evidence),
//   3. summarizes the experimental evidence from the lab notebook,
//   4. renders one honest line per discipline from the actual numbers,
//   5. issues her standing scientific verdict: HOLD / APPLY_CANDIDATE / WITHDRAW.
//
// The verdict is deterministic given its inputs. It never changes a forecast
// weight directly: APPLY_CANDIDATE only *nominates* the venue lead-lag
// member for the runner's champion/challenger gates; WITHDRAW recommends
// weight 0. Internet text can propose hypotheses — it can never move weights.
//
// Usage: node scripts/lena-supervisor.js --data ./data-branch
// Writes: <data>/lena_supervisor.json

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseLenaLogLines, isDecisiveLena } from '../lib/lenanote.js';

export const CHARTER_VERSION = '1.0.0';
export const HISTORY_CAP = 200;    // notes examined per cycle
export const MIN_HISTORY = 50;     // below this: HOLD, always
export const APPLY_MIN_N = 100;
export const APPLY_DECISIVE_MIN = 0.40;
export const WITHDRAW_DECISIVE_MAX = 0.15;
export const OOS_MIN_N = 200;      // scored forecasts needed for an OOS verdict
export const SKILL_MIN_N = 30;     // scored 24h reads needed for a skill read

const QUERIES = [
  'all:lead+AND+all:lag+AND+all:cryptocurrency+AND+all:price',
  'all:price+AND+all:discovery+AND+all:cryptocurrency+AND+all:exchange',
  'all:cross+AND+all:exchange+AND+all:arbitrage+AND+all:crypto',
  'all:latency+AND+all:arbitrage+AND+all:market+AND+all:microstructure',
  'all:binance+AND+all:coinbase+AND+all:price',
  'all:information+AND+all:share+AND+all:bitcoin+AND+all:markets',
];

async function arxivSearch(q) {
  const url = 'https://export.arxiv.org/api/query?search_query=' + encodeURIComponent(q) +
    '&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending';
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'building-a-thing-with-infoflow/lena-supervisor' } });
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
export function computeEvidence(notes, scoreboardLeadlag) {
  const hist = (Array.isArray(notes) ? notes : []).slice(-HISTORY_CAP);
  const n = hist.length;
  let decisive = 0, blind = 0, warming = 0;
  let gapSum = 0, gapN = 0, leadSum = 0, leadN = 0, ahead = 0;
  for (const note of hist) {
    const c = note && note.computed;
    if (!c) { blind++; continue; }
    if (c.degraded) { blind++; continue; }
    if (c.warming_up) { warming++; continue; }
    if (c.decisive) decisive++;
    if (Number.isFinite(c.gap_bps)) { gapSum += c.gap_bps; gapN++; if (c.gap_bps > 0) ahead++; }
    if (Number.isFinite(c.lead_ret_bps)) { leadSum += c.lead_ret_bps; leadN++; }
  }
  const sb = scoreboardLeadlag || {};
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
    ahead_frac: gapN ? ahead / gapN : 0,
    mean_gap_bps: gapN ? gapSum / gapN : null,
    mean_lead_ret_bps: leadN ? leadSum / leadN : null,
    member_brier: memberBrier, base_brier: baseBrier, member_n: memberN,
    oos_edge: oosEdge,
    skill24h: skill,
  };
}

/** Pure: the charter's deterministic verdict rules. */
export function decideVerdict(ev) {
  if (ev.n < MIN_HISTORY) {
    return { verdict: 'HOLD', why: `Only ${ev.n} lab notes on record (need >= ${MIN_HISTORY}) — not enough history for any scientific verdict. I keep watching both venues.` };
  }
  if (ev.n >= APPLY_MIN_N && ev.oos_edge && ev.decisive_frac >= APPLY_DECISIVE_MIN) {
    return {
      verdict: 'APPLY_CANDIDATE',
      why: `Real out-of-sample edge (member Brier ${ev.member_brier.toFixed(5)} vs baseline ${ev.base_brier.toFixed(5)}, n=${ev.member_n}) and the lead-lag read actually speaks (${(ev.decisive_frac * 100).toFixed(1)}% of cycles decisive, Binance ahead ${(ev.ahead_frac * 100).toFixed(1)}% of the time). I nominate the venue lead-lag member for weight adoption — the champion/challenger gates still decide.`,
    };
  }
  if (ev.n >= APPLY_MIN_N && !ev.oos_edge && ev.decisive_frac < WITHDRAW_DECISIVE_MAX) {
    return { verdict: 'WITHDRAW', why: `No out-of-sample edge and the lead rarely speaks (decisive only ${(ev.decisive_frac * 100).toFixed(1)}% of cycles). A signal that rarely speaks and never beats the baseline is not a signal — I recommend weight 0 and the ledger records the refutation.` };
  }
  const bits = [];
  if (ev.n < APPLY_MIN_N) bits.push(`history still short (${ev.n}/${APPLY_MIN_N})`);
  if (!ev.oos_edge) bits.push(ev.member_n >= OOS_MIN_N ? 'no out-of-sample edge on the scoreboard' : `scoreboard still warming up (n=${ev.member_n}/${OOS_MIN_N})`);
  if (!(ev.decisive_frac >= APPLY_DECISIVE_MIN)) bits.push(`decisive reads ${(ev.decisive_frac * 100).toFixed(1)}% — below the ${(APPLY_DECISIVE_MIN * 100).toFixed(0)}% bar`);
  if (ev.blind_frac > 0.2) bits.push(`venue data blind ${(ev.blind_frac * 100).toFixed(1)}% of cycles — I check the instruments before trusting the readings`);
  return { verdict: 'HOLD', why: `The case is not made in either direction: ${bits.join('; ')}. I keep the watch open and keep gathering evidence.` };
}

function seedHypotheses() {
  return [
    { id: 'LE1', claim: 'Binance leads Coinbase on XRP: when Binance closes ahead and its recent drift is still in front, Coinbase moves the same way over the next bars.', prediction: 'decisive lead-lag regimes align with 24h direction more often than chance', test: '24h directional skill vs 0.50 baseline', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'LE2', claim: 'The venue lead-lag member beats the baseline forecast out-of-sample on Brier score.', prediction: 'member Brier < baseline Brier over n ≥ 200 scored forecasts', test: 'live scoreboard comparison', status: 'open', status_why: 'scoreboard warming up', updated_at: null },
    { id: 'LE3', claim: 'The lead is structural, not folklore: Binance closes ahead of Coinbase (gap > 0) more often than behind it.', prediction: 'ahead_frac > 0.50 over rolling history once n ≥ 100', test: 'gap sign rate from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'LE4', claim: 'The lead-lag read expresses itself often enough to matter — not a once-a-quarter curiosity.', prediction: 'decisive_frac ≥ 0.40 over rolling history once n ≥ 100', test: 'decisive-read rate from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
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
    set('LE2', ev.oos_edge ? 'supported' : 'refuted',
      `member ${ev.member_brier?.toFixed(5)} vs baseline ${ev.base_brier?.toFixed(5)}, n=${ev.member_n}`);
  }
  if (ev.skill24h) {
    set('LE1', ev.skill24h.beats_baseline ? 'supported' : 'refuted',
      `24h hit rate=${(ev.skill24h.hit_rate * 100).toFixed(1)}% vs 50% baseline, n=${ev.skill24h.n}`);
  }
  if (ev.n >= APPLY_MIN_N) {
    set('LE3', ev.ahead_frac > 0.5 ? 'supported' : 'refuted',
      `Binance ahead ${(ev.ahead_frac * 100).toFixed(1)}% of cycles over n=${ev.n}`);
    set('LE4', ev.decisive_frac >= APPLY_DECISIVE_MIN ? 'supported' : (ev.decisive_frac < WITHDRAW_DECISIVE_MAX ? 'refuted' : 'open'),
      `decisive_frac=${ev.decisive_frac.toFixed(3)} over n=${ev.n}`);
  }
  return hyps;
}

/** Pure: one honest line per discipline, rendered from the numbers. */
export function buildDisciplines(ev, verdict) {
  const pct = (x) => (x * 100).toFixed(1) + '%';
  const bps = (x) => (x != null ? (x >= 0 ? '+' : '') + x.toFixed(1) + ' bps' : 'n/a');
  return [
    { discipline: 'statistician', assessment: `mean venue gap ${bps(ev.mean_gap_bps)} with Binance ahead ${pct(ev.ahead_frac)} of cycles; mean lead return ${bps(ev.mean_lead_ret_bps)}. A gap is an estimate with error bars, not a fact — the aligned history is what keeps it honest.` },
    { discipline: 'quantitative_finance', assessment: ev.oos_edge ? `Out-of-sample edge is consistent with real propagation: Binance's lead carries information Coinbase has not priced yet. An unconditional "follow Binance" rule would have imported every noise flicker — the conditionality is the edge.` : `No edge to explain — and I will not pretend a venue flicker was ever a signal.` },
    { discipline: 'mathematician', assessment: `The gap is a ratio of time-aligned closes; change the alignment and the number changes, so the alignment is part of the result. Error propagates: a bias built from two venues is not twice as certain as one built from a single tape.` },
    { discipline: 'risk_manager', assessment: verdict === 'APPLY_CANDIDATE' ? 'False-discovery risk is priced: nomination only — the champion/challenger gates (Brier ≥ 2e-4, both halves positive, Bonferroni α) still decide, and the ladder moves in small tested steps.' : verdict === 'WITHDRAW' ? 'A signal that rarely speaks and never beats the baseline is not a signal — the risk-managed move is to withdraw, not to keep a dead hypothesis on life support.' : 'When in doubt I vote HOLD: adopting noise corrupts every forecast it touches, and that is the costliest error I can make.' },
    { discipline: 'data_engineer', assessment: ev.blind_frac > 0.2 ? `Instrument flag: venue data blind ${pct(ev.blind_frac)} of cycles — a stale Binance candle masquerades as a gap unless you check liveness, and I check.` : `Pipeline healthy: both venue series readable ${pct(1 - ev.blind_frac)} of cycles; timestamps aligned exactly, gaps dropped not interpolated; same bars reproduce the same numbers.` },
    { discipline: 'trader', assessment: 'Leads are rented, never owned — the moment a lead-lag becomes folklore, faster money arbitrages it shut. Everyone watching the same gap watches it close; the edge, if any, is in measuring it fresh every cycle, not in believing last month\'s lead. That is why no APPLY verdict of mine ever skips out-of-sample proof.' },
    { discipline: 'intelligence_analyst', assessment: `Known: Binance ahead ${pct(ev.ahead_frac)} of cycles, decisive ${pct(ev.decisive_frac)}. Unknown: whether the lead survives the next volatility break, when gaps widen and venues decouple. Confidence: ${verdict === 'HOLD' ? 'low — the honest answer' : 'moderate — evidence-backed, still falsifiable'}.` },
    { discipline: 'research_scientist', assessment: 'Hypothesis ledger updated — statuses changed only where the evidence moved them; nothing was buried and nothing was accepted without a test.' },
    { discipline: 'principal_investigator', assessment: `I sign this verdict: ${verdict}. It is defensible from the record below, and I will reverse it the moment the evidence does.` },
  ];
}

function plainVerdict(v, ev) {
  if (v.verdict === 'APPLY_CANDIDATE') return `Lena's verdict: the evidence supports giving the venue lead-lag signal a trial in the forecast model. Following Binance's lead over Coinbase has beaten the baseline out-of-sample over ${ev.member_n} scored forecasts. Her nomination now goes to formal testing — strict statistical gates still have the final say.`;
  if (v.verdict === 'WITHDRAW') return `Lena's verdict: the evidence says the venue lead carries no usable signal at this horizon. She recommends removing it from the model entirely — a negative result, published honestly.`;
  return `Lena's verdict: hold and keep watching. The lead-lag evidence so far is neither strong enough to apply nor weak enough to withdraw — the watch stays open.`;
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
    const lp = path.join(dataDir, 'lena-log.jsonl');
    if (existsSync(lp)) notes = parseLenaLogLines(readFileSync(lp, 'utf8'));
  } catch { notes = []; }
  if (!notes.length) notes = (summary && summary.lena && Array.isArray(summary.lena.log)) ? summary.lena.log : [];
  const scoreboardLeadlagRaw = summary && summary.windows && summary.windows.all && summary.windows.all.leadlag
    ? summary.windows.all.leadlag : null;
  const scoreboardLeadlag = scoreboardLeadlagRaw
    ? { n: scoreboardLeadlagRaw.n, brierMember: scoreboardLeadlagRaw.brierLeadlag, brierBase: scoreboardLeadlagRaw.brierBase, skill24h: scoreboardLeadlagRaw.skill24h }
    : null;

  let prev = null;
  const outPath = path.join(dataDir, 'lena_supervisor.json');
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
  const evidence = computeEvidence(notes, scoreboardLeadlag);
  const v = decideVerdict(evidence);
  const hypotheses = updateHypotheses(prev && prev.hypotheses, evidence, nowIso);
  const disciplines = buildDisciplines(evidence, v.verdict);

  const doc = {
    agent: 'lena',
    title: 'Principal Investigator, Venue Lead-Lag Lab',
    charter_version: CHARTER_VERSION,
    charter: 'LENA_CHARTER.md',
    updated_at: nowIso,
    verdict: v.verdict,
    verdict_why: v.why,
    verdict_plain: plainVerdict(v, evidence),
    evidence,
    model_gates: 'APPLY_CANDIDATE nominates only. Adoption requires the runner\'s champion/challenger gates: held-out Brier improvement ≥ 2e-4, positive in both halves, family-wise α=0.05 with Bonferroni correction, ≥24h between adoptions. WITHDRAW recommends leadlagWeight 0. This file never changes a weight directly.',
    hypotheses,
    literature: literature.slice(-12),
    literature_new: fresh,
    literature_error: litError,
    disciplines_applied: disciplines,
  };

  writeFileSync(outPath, JSON.stringify(doc, null, 1) + '\n');
  console.log(JSON.stringify({ ts: nowIso, agent: 'lena-supervisor', verdict: v.verdict, notes: evidence.n, new_papers: fresh.length }));
}

if (process.argv[1] && process.argv[1].endsWith('lena-supervisor.js')) main();
