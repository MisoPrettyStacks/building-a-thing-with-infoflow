// Violet's supervisor cycle — implements VIOLET_CHARTER.md (v1.0.0).
//
// Once per cycle (weekly via workflow) Violet:
//   1. scans the literature (internet: arXiv) for relevant science,
//   2. maintains her hypothesis ledger (statuses change only on evidence),
//   3. summarizes the experimental evidence from the lab notebook,
//   4. renders one honest line per discipline from the actual numbers,
//   5. issues her standing scientific verdict: HOLD / APPLY_CANDIDATE / WITHDRAW.
//
// The verdict is deterministic given its inputs. It never changes a forecast
// weight directly: APPLY_CANDIDATE only *nominates* the volatility dampener
// for the runner's champion/challenger gates; WITHDRAW recommends dampener
// weight 0. Her verdict nominates a DAMPENER, never a direction.
// Internet text can propose hypotheses — it can never move weights.
//
// Usage: node scripts/violet-supervisor.js --data ./data-branch
// Writes: <data>/violet_supervisor.json

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseVioletLogLines, isDecisiveViolet } from '../lib/violetnote.js';

export const CHARTER_VERSION = '1.0.0';
export const HISTORY_CAP = 200;    // notes examined per cycle
export const MIN_HISTORY = 50;     // below this: HOLD, always
export const APPLY_MIN_N = 100;
export const APPLY_DECISIVE_MIN = 0.40;
export const WITHDRAW_DECISIVE_MAX = 0.15;
export const OOS_MIN_N = 200;      // scored forecasts needed for an OOS verdict
export const SKILL_MIN_N = 30;     // scored reads needed for a skill read

const QUERIES = [
  'all:realized+AND+all:volatility+AND+all:forecasting',
  'all:volatility+AND+all:regime+AND+all:switching',
  'all:GARCH+AND+all:cryptocurrency+AND+all:volatility',
  'all:volatility+AND+all:forecasting+AND+all:cryptocurrency',
  'all:realized+AND+all:volatility+AND+all:cryptocurrency',
  'all:volatility+AND+all:spillover+AND+all:bitcoin',
];

async function arxivSearch(q) {
  const url = 'https://export.arxiv.org/api/query?search_query=' + encodeURIComponent(q) +
    '&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending';
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'building-a-thing-with-infoflow/violet-supervisor' } });
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
export function computeEvidence(notes, scoreboardVol) {
  const hist = (Array.isArray(notes) ? notes : []).slice(-HISTORY_CAP);
  const n = hist.length;
  let decisive = 0, blind = 0, warming = 0, wild = 0;
  for (const note of hist) {
    const c = note && note.computed;
    if (!c) { blind++; continue; }
    if (c.degraded) { blind++; continue; }
    if (c.warming_up) { warming++; continue; }
    if (c.decisive) decisive++;
    if (c.regime === 'wild') wild++;
  }
  const sb = scoreboardVol || {};
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
    wild_cycles: wild,
    member_brier: memberBrier, base_brier: baseBrier, member_n: memberN,
    oos_edge: oosEdge,
    skill24h: skill,
  };
}

/** Pure: the charter's deterministic verdict rules. */
export function decideVerdict(ev) {
  if (ev.n < MIN_HISTORY) {
    return { verdict: 'HOLD', why: `Only ${ev.n} lab notes on record (need >= ${MIN_HISTORY}) — not enough history for any scientific verdict. I keep watching the regimes.` };
  }
  if (ev.n >= APPLY_MIN_N && ev.oos_edge && ev.decisive_frac >= APPLY_DECISIVE_MIN) {
    return {
      verdict: 'APPLY_CANDIDATE',
      why: `Real out-of-sample edge (dampener Brier ${ev.member_brier.toFixed(5)} vs baseline ${ev.base_brier.toFixed(5)}, n=${ev.member_n}) and wild regimes actually occur (${(ev.decisive_frac * 100).toFixed(1)}% of cycles decisive, ${ev.wild_cycles} wild cycles on record). I nominate the volatility dampener for weight adoption — the champion/challenger gates still decide. Direction is never on the table.`,
    };
  }
  if (ev.n >= APPLY_MIN_N && !ev.oos_edge && ev.decisive_frac < WITHDRAW_DECISIVE_MAX) {
    return { verdict: 'WITHDRAW', why: `No out-of-sample edge and wild regimes too rare to matter (decisive only ${(ev.decisive_frac * 100).toFixed(1)}% of cycles). A dampener that never fires and never beats the baseline is not worth arming — I recommend dampener weight 0 and the ledger records the refutation.` };
  }
  const bits = [];
  if (ev.n < APPLY_MIN_N) bits.push(`history still short (${ev.n}/${APPLY_MIN_N})`);
  if (!ev.oos_edge) bits.push(ev.member_n >= OOS_MIN_N ? 'no out-of-sample edge on the scoreboard' : `scoreboard still warming up (n=${ev.member_n}/${OOS_MIN_N})`);
  if (!(ev.decisive_frac >= APPLY_DECISIVE_MIN)) bits.push(`wild-regime cycles ${(ev.decisive_frac * 100).toFixed(1)}% — below the ${(APPLY_DECISIVE_MIN * 100).toFixed(0)}% bar`);
  if (ev.blind_frac > 0.2) bits.push(`feed blind ${(ev.blind_frac * 100).toFixed(1)}% of cycles — I check the instruments before trusting the readings`);
  return { verdict: 'HOLD', why: `The case is not made in either direction: ${bits.join('; ')}. I keep the watch open and keep gathering evidence.` };
}

function seedHypotheses() {
  return [
    { id: 'VI1', claim: 'Wild volatility regimes coincide with forecast misses: the issued forecast scores worse (Brier) in wild-regime windows than on average.', prediction: 'Brier in wild-regime windows exceeds the overall baseline', test: 'Brier split by regime from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'VI2', claim: 'Shrinking confidence toward 0.5 in wild regimes improves the out-of-sample Brier score.', prediction: 'dampener what-if Brier < baseline Brier over scored forecasts', test: 'live what-if scoreboard comparison', status: 'open', status_why: 'scoreboard warming up', updated_at: null },
    { id: 'VI3', claim: 'Volatility regimes persist long enough to matter — wild readings cluster into streaks rather than flickering one bar at a time.', prediction: 'consecutive wild-regime cycles are common in the notebook', test: 'regime run-length analysis from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'VI4', claim: 'Calm regimes need no dampening: leaving them alone does not hurt the Brier, and arming the dampener there would just dull good forecasts.', prediction: 'no dampener arming in calm/normal cycles; no Brier harm observed there', test: 'dampener-armed rate by regime + regime-split Brier', status: 'open', status_why: 'awaiting history', updated_at: null },
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
    set('VI2', ev.oos_edge ? 'supported' : 'refuted',
      `dampener ${ev.member_brier?.toFixed(5)} vs baseline ${ev.base_brier?.toFixed(5)}, n=${ev.member_n}`);
  }
  if (ev.skill24h) {
    set('VI1', ev.skill24h.beats_baseline ? 'supported' : 'refuted',
      `24h hit rate=${(ev.skill24h.hit_rate * 100).toFixed(1)}% vs 50% baseline, n=${ev.skill24h.n}`);
  }
  if (ev.n >= APPLY_MIN_N) {
    set('VI3', ev.decisive_frac >= APPLY_DECISIVE_MIN ? 'supported' : (ev.decisive_frac < WITHDRAW_DECISIVE_MAX ? 'refuted' : 'open'),
      `wild-regime frac=${ev.decisive_frac.toFixed(3)} over n=${ev.n}`);
  }
  return hyps;
}

/** Pure: one honest line per discipline, rendered from the numbers. */
export function buildDisciplines(ev, verdict) {
  const pct = (x) => (x * 100).toFixed(1) + '%';
  return [
    { discipline: 'financial_econometrics', assessment: ev.decisive_frac >= 0.4 ? `The regimes are speaking: ${pct(ev.decisive_frac)} of cycles ran wild, ${ev.wild_cycles} wild cycles on record. Realized vol is measured from log returns against its own rolling baseline — relative, never absolute, so the market cannot outgrow the ruler.` : `Regimes are mostly quiet (${pct(ev.decisive_frac)} wild). I do not mistake one violent bar for a regime — the regime needs the window, not the spike.` },
    { discipline: 'statistician', assessment: `wild_frac=${pct(ev.decisive_frac)} over n=${ev.n}; ${ev.oos_edge ? `out-of-sample edge confirmed (Brier ${ev.member_brier.toFixed(5)} < ${ev.base_brier.toFixed(5)}, n=${ev.member_n})` : ev.member_n >= OOS_MIN_N ? 'no out-of-sample edge — the scoreboard overrules the bench' : `scoreboard still warming up (n=${ev.member_n}/${OOS_MIN_N})`}. Wild regimes are rare — I size my claims to my sample.` },
    { discipline: 'risk_manager', assessment: verdict === 'APPLY_CANDIDATE' ? 'False-discovery risk is priced: nomination only — the champion/challenger gates still decide, and the dampener arms in small tested steps. But missed-uncertainty risk is priced too: full confidence during chaos is an error I refuse to normalize.' : verdict === 'WITHDRAW' ? 'Wild regimes are too rare and the edge is absent — the risk-managed move is to withdraw the dampener rather than keep it armed on noise.' : 'When in doubt I vote HOLD: arming a dampener on noise dulls every forecast it touches, and that is the costliest error I can make.' },
    { discipline: 'mathematician', assessment: 'Realized volatility is defined by its window, its return definition, and its scaling — all three ride with every result. The regime is a relative comparison against the asset\u2019s own recent distribution, so fixed absolute thresholds never enter the lab.' },
    { discipline: 'data_engineer', assessment: ev.blind_frac > 0.2 ? `Instrument flag: feed blind ${pct(ev.blind_frac)} of cycles — a dead feed looks like a frozen market unless you check liveness, and I check.` : `Pipeline healthy: candles readable ${pct(1 - ev.blind_frac)} of cycles; bar completeness checked; same candle history reproduces the same regime read.` },
    { discipline: 'trader', assessment: 'Volatility tells you how wide the cone is, never which way the coin lands. That is why no verdict of mine ever predicts direction — the dampener shrinks confidence toward 0.5 and that is the entire job.' },
    { discipline: 'intelligence_analyst', assessment: `Known: ${pct(ev.decisive_frac)} wild-regime cycles over ${ev.n} notes, ${ev.wild_cycles} wild cycles on record. Unknown: whether the next wild regime behaves like the last one. Confidence: ${verdict === 'HOLD' ? 'low — the honest answer' : 'moderate — evidence-backed, still falsifiable'}.` },
    { discipline: 'research_scientist', assessment: 'Hypothesis ledger updated — statuses changed only where the evidence moved them; nothing was buried and nothing was accepted without a test.' },
    { discipline: 'principal_investigator', assessment: `I sign this verdict: ${verdict}. It is defensible from the record below, and I will reverse it the moment the evidence does.` },
  ];
}

function plainVerdict(v, ev) {
  if (v.verdict === 'APPLY_CANDIDATE') return `Violet's verdict: the evidence supports arming her volatility dampener. When regimes run wild, the dampener has beaten the baseline out-of-sample over ${ev.member_n} scored forecasts — the forecast will admit uncertainty and shrink toward 0.5 in wild weather. Her nomination now goes to formal testing; strict statistical gates still have the final say. Direction is never affected.`;
  if (v.verdict === 'WITHDRAW') return `Violet's verdict: the evidence says the dampener earns nothing. Wild regimes are too rare or the edge is absent — she recommends keeping the dampener parked, a negative result published honestly.`;
  return `Violet's verdict: hold and keep watching. The volatility evidence so far is neither strong enough to arm the dampener nor weak enough to retire it — the watch stays open.`;
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
    const lp = path.join(dataDir, 'violet-log.jsonl');
    if (existsSync(lp)) notes = parseVioletLogLines(readFileSync(lp, 'utf8'));
  } catch { notes = []; }
  if (!notes.length) notes = (summary && summary.violet && Array.isArray(summary.violet.log)) ? summary.violet.log : [];
  const scoreboardVolRaw = summary && summary.windows && summary.windows.all && summary.windows.all.volatility
    ? summary.windows.all.volatility : null;
  const scoreboardVol = scoreboardVolRaw
    ? { n: scoreboardVolRaw.n, brierMember: scoreboardVolRaw.brierVol, brierBase: scoreboardVolRaw.brierBase, skill24h: null }
    : null;

  let prev = null;
  const outPath = path.join(dataDir, 'violet_supervisor.json');
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
  const evidence = computeEvidence(notes, scoreboardVol);
  const v = decideVerdict(evidence);
  const hypotheses = updateHypotheses(prev && prev.hypotheses, evidence, nowIso);
  const disciplines = buildDisciplines(evidence, v.verdict);

  const doc = {
    agent: 'violet',
    title: 'Principal Investigator, Volatility Regime Lab',
    charter_version: CHARTER_VERSION,
    charter: 'VIOLET_CHARTER.md',
    updated_at: nowIso,
    verdict: v.verdict,
    verdict_why: v.why,
    verdict_plain: plainVerdict(v, evidence),
    evidence,
    model_gates: 'APPLY_CANDIDATE nominates only. Adoption requires the runner\'s champion/challenger gates: held-out Brier improvement ≥ 2e-4, positive in both halves, family-wise α=0.05 with Bonferroni correction, ≥24h between adoptions. WITHDRAW recommends volDamp 0. The dampener shrinks confidence toward 0.5 in wild regimes; it can never move the forecast in a direction. This file never changes a weight directly.',
    hypotheses,
    literature: literature.slice(-12),
    literature_new: fresh,
    literature_error: litError,
    disciplines_applied: disciplines,
  };

  writeFileSync(outPath, JSON.stringify(doc, null, 1) + '\n');
  console.log(JSON.stringify({ ts: nowIso, agent: 'violet-supervisor', verdict: v.verdict, notes: evidence.n, new_papers: fresh.length }));
}

if (process.argv[1] && process.argv[1].endsWith('violet-supervisor.js')) main();
