// Sage's supervisor cycle — implements SAGE_CHARTER.md (v1.0.0).
//
// Once per cycle (weekly via workflow) Sage:
//   1. scans the literature (internet: arXiv) for relevant science,
//   2. maintains her hypothesis ledger (statuses change only on evidence),
//   3. summarizes the experimental evidence from the lab notebook,
//   4. renders one honest line per discipline from the actual numbers,
//   5. issues her standing scientific verdict: HOLD / APPLY_CANDIDATE / WITHDRAW.
//
// The verdict is deterministic given its inputs. It never changes a forecast
// weight directly: APPLY_CANDIDATE only *nominates* the stablecoin-flow
// member for the runner's champion/challenger gates; WITHDRAW recommends
// weight 0. Internet text can propose hypotheses — it can never move weights.
//
// Sage's honesty bar: stablecoin market-cap data moves in days, not minutes,
// so claims about 15-minute direction stay modest no matter what the tide
// looks like.
//
// Usage: node scripts/sage-supervisor.js --data ./data-branch
// Writes: <data>/sage_supervisor.json

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseSageLogLines, isDecisiveSage } from '../lib/sagenote.js';

export const CHARTER_VERSION = '1.0.0';
export const HISTORY_CAP = 200;    // notes examined per cycle
export const MIN_HISTORY = 50;     // below this: HOLD, always
export const APPLY_MIN_N = 100;
export const APPLY_DECISIVE_MIN = 0.40;
export const WITHDRAW_DECISIVE_MAX = 0.15;
export const OOS_MIN_N = 200;      // scored forecasts needed for an OOS verdict
export const SKILL_MIN_N = 30;     // scored 24h reads needed for a skill read

const QUERIES = [
  'all:stablecoin+AND+all:cryptocurrency+AND+all:liquidity',
  'all:stablecoin+AND+all:market+AND+all:cap+AND+all:price',
  'all:crypto+AND+all:liquidity+AND+all:flows+AND+all:returns',
  'all:tether+AND+all:supply+AND+all:bitcoin+AND+all:price',
  'all:stablecoin+AND+all:issuance+AND+all:market+AND+all:impact',
  'all:cryptocurrency+AND+all:liquidity+AND+all:predictability',
];

async function arxivSearch(q) {
  const url = 'https://export.arxiv.org/api/query?search_query=' + encodeURIComponent(q) +
    '&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending';
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'building-a-thing-with-infoflow/sage-supervisor' } });
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
export function computeEvidence(notes, scoreboardStable) {
  const hist = (Array.isArray(notes) ? notes : []).slice(-HISTORY_CAP);
  const n = hist.length;
  let decisive = 0, blind = 0, warming = 0, stale = 0;
  for (const note of hist) {
    const c = note && note.computed;
    if (!c) { blind++; continue; }
    if (c.degraded) { blind++; continue; }
    if (c.warming_up) { warming++; continue; }
    if (c.decisive) decisive++;
    if (note.collected && note.collected.stale_note) stale++;
  }
  const sb = scoreboardStable || {};
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
    stale_frac: n ? stale / n : 0,
    decisive_frac: n ? decisive / n : 0,
    member_brier: memberBrier, base_brier: baseBrier, member_n: memberN,
    oos_edge: oosEdge,
    skill24h: skill,
  };
}

/** Pure: the charter's deterministic verdict rules. */
export function decideVerdict(ev) {
  if (ev.n < MIN_HISTORY) {
    return { verdict: 'HOLD', why: `Only ${ev.n} lab notes on record (need >= ${MIN_HISTORY}) — not enough history for any scientific verdict. I keep watching the tide.` };
  }
  if (ev.n >= APPLY_MIN_N && ev.oos_edge && ev.decisive_frac >= APPLY_DECISIVE_MIN) {
    return {
      verdict: 'APPLY_CANDIDATE',
      why: `Real out-of-sample edge (member Brier ${ev.member_brier.toFixed(5)} vs baseline ${ev.base_brier.toFixed(5)}, n=${ev.member_n}) and the liquidity regime actually speaks (${(ev.decisive_frac * 100).toFixed(1)}% of cycles decisive). I nominate the stablecoin-flow member for weight adoption — the champion/challenger gates still decide.`,
    };
  }
  if (ev.n >= APPLY_MIN_N && !ev.oos_edge && ev.decisive_frac < WITHDRAW_DECISIVE_MAX) {
    return { verdict: 'WITHDRAW', why: `No out-of-sample edge and the tide rarely speaks decisively (${(ev.decisive_frac * 100).toFixed(1)}% of cycles). A signal that rarely speaks and never beats the baseline is not a signal — I recommend weight 0 and the ledger records the refutation.` };
  }
  const bits = [];
  if (ev.n < APPLY_MIN_N) bits.push(`history still short (${ev.n}/${APPLY_MIN_N})`);
  if (!ev.oos_edge) bits.push(ev.member_n >= OOS_MIN_N ? 'no out-of-sample edge on the scoreboard' : `scoreboard still warming up (n=${ev.member_n}/${OOS_MIN_N})`);
  if (!(ev.decisive_frac >= APPLY_DECISIVE_MIN)) bits.push(`decisive reads ${(ev.decisive_frac * 100).toFixed(1)}% — below the ${(APPLY_DECISIVE_MIN * 100).toFixed(0)}% bar`);
  if (ev.blind_frac > 0.2) bits.push(`feed blind ${(ev.blind_frac * 100).toFixed(1)}% of cycles — I check the instruments before trusting the readings`);
  if (ev.stale_frac > 0.5) bits.push(`stale cache ${(ev.stale_frac * 100).toFixed(1)}% of cycles — the rate-limited free feed leans on cached reads`);
  return { verdict: 'HOLD', why: `The case is not made in either direction: ${bits.join('; ')}. I keep watching the pool and keep gathering evidence.` };
}

function seedHypotheses() {
  return [
    { id: 'SG1', claim: 'Rising USDT+USDC 24h market-cap change (liquidity entering) tilts subsequent XRP moves up; contracting supply tilts them down.', prediction: 'decisive liquidity regimes align with 24h direction more often than chance', test: '24h directional skill vs 0.50 baseline', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'SG2', claim: 'The stablecoin-flow member beats the baseline forecast out-of-sample on Brier score.', prediction: 'member Brier < baseline Brier over n ≥ 200 scored forecasts', test: 'live scoreboard comparison', status: 'open', status_why: 'scoreboard warming up', updated_at: null },
    { id: 'SG3', claim: 'Liquidity tides move slowly and rarely speak decisively — but when they do, the moves coincide with broader risk-on/risk-off crypto regimes, not 15-minute timing.', prediction: 'decisive cycles show alignment at 24h horizons rather than 15-minute ones', test: '24h skill vs 15-minute skill from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'SG4', claim: 'The liquidity read expresses itself often enough to matter — not a once-a-quarter curiosity.', prediction: 'decisive_frac ≥ 0.40 over rolling history once n ≥ 100', test: 'decisive-read rate from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
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
    set('SG2', ev.oos_edge ? 'supported' : 'refuted',
      `member ${ev.member_brier?.toFixed(5)} vs baseline ${ev.base_brier?.toFixed(5)}, n=${ev.member_n}`);
  }
  if (ev.skill24h) {
    set('SG1', ev.skill24h.beats_baseline ? 'supported' : 'refuted',
      `24h hit rate=${(ev.skill24h.hit_rate * 100).toFixed(1)}% vs 50% baseline, n=${ev.skill24h.n}`);
  }
  if (ev.n >= APPLY_MIN_N) {
    set('SG4', ev.decisive_frac >= APPLY_DECISIVE_MIN ? 'supported' : (ev.decisive_frac < WITHDRAW_DECISIVE_MAX ? 'refuted' : 'open'),
      `decisive_frac=${ev.decisive_frac.toFixed(3)} over n=${ev.n}`);
  }
  return hyps;
}

/** Pure: one honest line per discipline, rendered from the numbers. */
export function buildDisciplines(ev, verdict) {
  const pct = (x) => (x * 100).toFixed(1) + '%';
  return [
    { discipline: 'on_chain_analysis', assessment: ev.decisive_frac >= 0.4 ? `The tide is moving: ${pct(ev.decisive_frac)} of cycles carry a decisive liquidity read. USDT and USDC market caps are minted and burned against real dollars — rising supply is real fiat parked on-chain, not a model artifact.` : `The pool is mostly calm (${pct(ev.decisive_frac)} decisive). A smooth series can look related to anything, so I size my claims to the sample and do not narrate ripples.` },
    { discipline: 'monetary_economics', assessment: `Liquidity is a background condition, not a trigger. An expanding stablecoin supply raises on-chain purchasing power and accompanies risk-on regimes; a contracting supply withdraws it. The transmission to a 15-minute XRP move is long, leaky, and noisy — I claim a tide, never a timer.` },
    { discipline: 'network_science', assessment: `USDT and USDC rebalance across chains, so a headline market-cap jump can be plumbing, not fresh fiat. I aggregate the two issuers and read the 24-hour change to separate genuine supply change from internal shuffling.` },
    { discipline: 'statistics', assessment: `decisive_frac=${pct(ev.decisive_frac)} over n=${ev.n}; ${ev.oos_edge ? `out-of-sample edge confirmed (Brier ${ev.member_brier.toFixed(5)} < ${ev.base_brier.toFixed(5)}, n=${ev.member_n})` : ev.member_n >= OOS_MIN_N ? 'no out-of-sample edge — the scoreboard overrules the tide bench' : `scoreboard still warming up (n=${ev.member_n}/${OOS_MIN_N})`}. Slow predictors are the classic trap — I demand more proof, not less.` },
    { discipline: 'risk_manager', assessment: verdict === 'APPLY_CANDIDATE' ? 'False-discovery risk is priced: nomination only — the champion/challenger gates (Brier ≥ 2e-4, both halves positive, Bonferroni α) still decide, and the ladder moves in small tested steps.' : verdict === 'WITHDRAW' ? 'A tide that rarely speaks and never beats the baseline is not a signal — the risk-managed move is to withdraw, not to keep a dead hypothesis afloat.' : 'When in doubt I vote HOLD: adopting noise corrupts every forecast it touches, and that is the costliest error I can make.' },
    { discipline: 'data_engineer', assessment: ev.blind_frac > 0.2 ? `Instrument flag: feed blind ${pct(ev.blind_frac)} of cycles — a throttled free API looks like "no change" unless you check, and I check.` : ev.stale_frac > 0.5 ? `Feed healthy but rate-limited: ${pct(ev.stale_frac)} of cycles read from the hourly cache, each labeled stale. Cache hygiene holds — at most one fetch per hour.` : `Pipeline healthy: feed reachable ${pct(1 - ev.blind_frac)} of cycles; same market state reproduces the same numbers.` },
    { discipline: 'trader', assessment: 'Stablecoin supply is a background condition, not a trade trigger — nobody mints USDT because XRP is about to move in 15 minutes. That is why no APPLY verdict of mine ever skips out-of-sample proof, and why I score this member at the 24h horizon too.' },
    { discipline: 'intelligence_analyst', assessment: `Known: ${pct(ev.decisive_frac)} decisive reads over ${ev.n} cycles. Unknown: whether supply regimes transmit to short-horizon XRP moves at all. Confidence: ${verdict === 'HOLD' ? 'low — the honest answer for a slow lab' : 'moderate — evidence-backed, still falsifiable'}.` },
    { discipline: 'research_scientist', assessment: 'Hypothesis ledger updated — statuses changed only where the evidence moved them; nothing was buried and nothing was accepted without a test. The negative hypotheses are the most important ones.' },
    { discipline: 'principal_investigator', assessment: `I sign this verdict: ${verdict}. It is defensible from the record below, modest about the horizon, and I will reverse it the moment the evidence does.` },
  ];
}

function plainVerdict(v, ev) {
  if (v.verdict === 'APPLY_CANDIDATE') return `Sage's verdict: the evidence supports giving stablecoin flow a trial in the forecast model. The liquidity tide has beaten the baseline out-of-sample over ${ev.member_n} scored forecasts. Her nomination now goes to formal testing — strict statistical gates still have the final say. She remains a liquidity lab, not a timing lab.`;
  if (v.verdict === 'WITHDRAW') return `Sage's verdict: the evidence says stablecoin flow carries no usable signal. She recommends removing it from the model entirely — a negative result, published honestly.`;
  return `Sage's verdict: hold and keep watching. The liquidity evidence so far is neither strong enough to apply nor weak enough to withdraw — the watch stays open.`;
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
    const lp = path.join(dataDir, 'sage-log.jsonl');
    if (existsSync(lp)) notes = parseSageLogLines(readFileSync(lp, 'utf8'));
  } catch { notes = []; }
  if (!notes.length) notes = (summary && summary.sage && Array.isArray(summary.sage.log)) ? summary.sage.log : [];
  // scoreboard: normalize the stable member of windows.all.stable
  const raw = summary && summary.windows && summary.windows.all && summary.windows.all.stable;
  const scoreboardStable = raw ? { n: raw.n, brierMember: raw.brierStable, brierBase: raw.brierBase, skill24h: raw.skill24h } : null;

  let prev = null;
  const outPath = path.join(dataDir, 'sage_supervisor.json');
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
  const evidence = computeEvidence(notes, scoreboardStable);
  const v = decideVerdict(evidence);
  const hypotheses = updateHypotheses(prev && prev.hypotheses, evidence, nowIso);
  const disciplines = buildDisciplines(evidence, v.verdict);

  const doc = {
    agent: 'sage',
    title: 'Principal Investigator, Stablecoin Flow Lab',
    charter_version: CHARTER_VERSION,
    charter: 'SAGE_CHARTER.md',
    updated_at: nowIso,
    verdict: v.verdict,
    verdict_why: v.why,
    verdict_plain: plainVerdict(v, evidence),
    evidence,
    model_gates: 'APPLY_CANDIDATE nominates only. Adoption requires the runner\'s champion/challenger gates: held-out Brier improvement ≥ 2e-4, positive in both halves, family-wise α=0.05 with Bonferroni correction, ≥24h between adoptions, weight ladder [0, 0.5, 1.0]. WITHDRAW recommends stableWeight 0. This file never changes a weight directly.',
    hypotheses,
    literature: literature.slice(-12),
    literature_new: fresh,
    literature_error: litError,
    disciplines_applied: disciplines,
  };

  writeFileSync(outPath, JSON.stringify(doc, null, 1) + '\n');
  console.log(JSON.stringify({ ts: nowIso, agent: 'sage-supervisor', verdict: v.verdict, notes: evidence.n, new_papers: fresh.length }));
}

if (process.argv[1] && process.argv[1].endsWith('sage-supervisor.js')) main();
