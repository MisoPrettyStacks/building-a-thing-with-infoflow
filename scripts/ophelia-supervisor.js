// Ophelia's supervisor cycle — implements OPHELIA_CHARTER.md (v1.0.0).
//
// Once per cycle (weekly via workflow) Ophelia:
//   1. scans the literature (internet: arXiv) for relevant science,
//   2. maintains her hypothesis ledger (statuses change only on evidence),
//   3. summarizes the experimental evidence from the lab notebook,
//   4. renders one honest line per discipline from the actual numbers,
//   5. issues her standing scientific verdict: HOLD / APPLY_CANDIDATE / WITHDRAW.
//
// The verdict is deterministic given its inputs. It never changes a forecast
// weight directly: APPLY_CANDIDATE only *nominates* the flow-health member
// for the runner's champion/challenger gates; WITHDRAW recommends weight 0.
// It never touches Wendy's onchainWeight or any other agent's weight.
// Internet text can propose hypotheses — it can never move weights.
//
// Usage: node scripts/ophelia-supervisor.js --data ./data-branch
// Writes: <data>/ophelia_supervisor.json

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseOpheliaLogLines, isDecisiveOphelia } from '../lib/ophelianote.js';

export const CHARTER_VERSION = '1.0.0';
export const HISTORY_CAP = 200;    // notes examined per cycle
export const MIN_HISTORY = 50;     // below this: HOLD, always
export const APPLY_MIN_N = 100;
export const APPLY_DECISIVE_MIN = 0.40;
export const WITHDRAW_DECISIVE_MAX = 0.15;
export const OOS_MIN_N = 200;      // scored forecasts needed for an OOS verdict
export const SKILL_MIN_N = 30;     // scored 24h reads needed for a skill read

const QUERIES = [
  'all:exchange+AND+all:balance+AND+all:crypto+AND+all:price',
  'all:on-chain+AND+all:analytics+AND+all:cryptocurrency',
  'all:exchange+AND+all:inflow+AND+all:outflow+AND+all:crypto',
  'all:blockchain+AND+all:flows+AND+all:market+AND+all:microstructure',
  'all:crypto+AND+all:price+AND+all:prediction+AND+all:flows',
  'all:on-chain+AND+all:data+AND+all:trading+AND+all:strategy',
];

async function arxivSearch(q) {
  const url = 'https://export.arxiv.org/api/query?search_query=' + encodeURIComponent(q) +
    '&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending';
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'building-a-thing-with-agents/ophelia-supervisor' } });
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
  let decisive = 0, blind = 0, warming = 0;
  for (const note of hist) {
    const c = note && note.computed;
    if (!c) { blind++; continue; }
    if (c.degraded) { blind++; continue; }
    if (c.warming_up) { warming++; continue; }
    if (c.decisive) decisive++;
  }
  const sb = scoreboard || {};
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
    member_brier: memberBrier, base_brier: baseBrier, member_n: memberN,
    oos_edge: oosEdge,
    skill24h: skill,
  };
}

/** Pure: the charter's deterministic verdict rules. */
export function decideVerdict(ev) {
  if (ev.n < MIN_HISTORY) {
    return { verdict: 'HOLD', why: `Only ${ev.n} lab notes on record (need >= ${MIN_HISTORY}) — not enough history for any scientific verdict. I keep watching the flows.` };
  }
  if (ev.n >= APPLY_MIN_N && ev.oos_edge && ev.decisive_frac >= APPLY_DECISIVE_MIN) {
    return {
      verdict: 'APPLY_CANDIDATE',
      why: `Real out-of-sample edge (member Brier ${ev.member_brier.toFixed(5)} vs baseline ${ev.base_brier.toFixed(5)}, n=${ev.member_n}) and the flow read actually takes a side (${(ev.decisive_frac * 100).toFixed(1)}% of cycles decisive). I nominate the flow-health member for weight adoption — the champion/challenger gates still decide.`,
    };
  }
  if (ev.n >= APPLY_MIN_N && !ev.oos_edge && ev.decisive_frac < WITHDRAW_DECISIVE_MAX) {
    return { verdict: 'WITHDRAW', why: `No out-of-sample edge and the flow read rarely takes a side (decisive only ${(ev.decisive_frac * 100).toFixed(1)}% of cycles). A slow signal that never speaks and never beats the baseline is not a signal — I recommend weight 0 and the ledger records the refutation.` };
  }
  const bits = [];
  if (ev.n < APPLY_MIN_N) bits.push(`history still short (${ev.n}/${APPLY_MIN_N})`);
  if (!ev.oos_edge) bits.push(ev.member_n >= OOS_MIN_N ? 'no out-of-sample edge on the scoreboard' : `scoreboard still warming up (n=${ev.member_n}/${OOS_MIN_N})`);
  if (!(ev.decisive_frac >= APPLY_DECISIVE_MIN)) bits.push(`decisive reads ${(ev.decisive_frac * 100).toFixed(1)}% — below the ${(APPLY_DECISIVE_MIN * 100).toFixed(0)}% bar`);
  if (ev.blind_frac > 0.2) bits.push(`snapshots blind ${(ev.blind_frac * 100).toFixed(1)}% of cycles — I check the instruments before trusting the readings`);
  return { verdict: 'HOLD', why: `The case is not made in either direction: ${bits.join('; ')}. I keep the ledger open and keep gathering evidence.` };
}

function seedHypotheses() {
  return [
    { id: 'O1', claim: 'Sustained exchange outflows tilt subsequent XRP moves up; sustained exchange inflows tilt them down.', prediction: 'decisive outflow reads align with 24h up moves, inflow reads with down moves, more often than chance', test: '24h directional skill vs 0.50 baseline', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'O2', claim: 'The flow-health member beats the baseline forecast out-of-sample on Brier score.', prediction: 'member Brier < baseline Brier over n ≥ 200 scored forecasts', test: 'live scoreboard comparison', status: 'open', status_why: 'scoreboard warming up', updated_at: null },
    { id: 'O3', claim: 'The edge, if any, concentrates in high breadth+velocity regimes — when many tracked wallets move together and the turnover is fast, the read carries information.', prediction: 'decisive-cycle edge is larger when breadth and velocity are both elevated', test: 'scoreboard split by breadth/velocity regime from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'O4', claim: 'The aggregate flow-health read is distinct from the whale-pulse signal — low correlation with Wendy\u2019s whale pulses.', prediction: 'correlation between flow-health bias and whale-pulse tilt below 0.3 over rolling history once n ≥ 100', test: 'correlation of per-cycle bias vs whale-pulse tilt from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
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
    set('O2', ev.oos_edge ? 'supported' : 'refuted',
      `member ${ev.member_brier?.toFixed(5)} vs baseline ${ev.base_brier?.toFixed(5)}, n=${ev.member_n}`);
  }
  if (ev.skill24h) {
    set('O1', ev.skill24h.beats_baseline ? 'supported' : 'refuted',
      `24h hit rate=${(ev.skill24h.hit_rate * 100).toFixed(1)}% vs 50% baseline, n=${ev.skill24h.n}`);
  }
  if (ev.n >= APPLY_MIN_N) {
    set('O3', ev.decisive_frac >= APPLY_DECISIVE_MIN ? 'supported' : (ev.decisive_frac < WITHDRAW_DECISIVE_MAX ? 'refuted' : 'open'),
      `decisive_frac=${ev.decisive_frac.toFixed(3)} over n=${ev.n}`);
  }
  return hyps;
}

/** Pure: one honest line per discipline, rendered from the numbers. */
export function buildDisciplines(ev, verdict) {
  const pct = (x) => (x * 100).toFixed(1) + '%';
  return [
    { discipline: 'onchain_analysis', assessment: ev.decisive_frac >= 0.4 ? `The ledger is talking: ${pct(ev.decisive_frac)} of cycles carry a decisive flow-health read. Aggregate exchange balances are inventory — building means distribution pressure, draining means accumulation. I read the whole tracked set, never a single whale.` : `The ledger is mostly quiet (${pct(ev.decisive_frac)} decisive). A single large transfer is an event, not a trend — that is Wendy's beat, not mine.` },
    { discipline: 'flow_accounting', assessment: `Velocity and breadth are defined against a fixed 24h window on a fixed watchlist — change the window and you change the number, so every read carries its window. Accounting is an identity, not a model; I give predictive claims built on it extra scrutiny.` },
    { discipline: 'statistician', assessment: `decisive_frac=${pct(ev.decisive_frac)} over n=${ev.n}; ${ev.oos_edge ? `out-of-sample edge confirmed (Brier ${ev.member_brier.toFixed(5)} < ${ev.base_brier.toFixed(5)}, n=${ev.member_n})` : ev.member_n >= OOS_MIN_N ? 'no out-of-sample edge — the scoreboard overrules the flow desk' : `scoreboard still warming up (n=${ev.member_n}/${OOS_MIN_N})`}. Flow health is slow — I size my claims to my sample.` },
    { discipline: 'microstructure', assessment: ev.oos_edge ? 'Marginal value question is next: what does aggregate flow add once the other members are in the blend? I watch for correlation rot — if my tilt agrees with everyone else on every cycle, its incremental value is gone.' : 'No standalone edge to decompose yet — the portfolio question stays open until the member beats the baseline.' },
    { discipline: 'network_science', assessment: 'I think in graphs: exchanges are hubs, wallets are nodes. Broad drift with high breadth is a regime; a single edge is an anecdote. Hub-to-hub plumbing is filtered by design — internal shuffling is not a flow.' },
    { discipline: 'data_engineer', assessment: ev.blind_frac > 0.2 ? `Instrument flag: snapshots unseen ${pct(ev.blind_frac)} of cycles — a failed fetch looks like calm balances unless you check, and I check. 72h of history required before any read.` : `Pipeline healthy: snapshots present ${pct(1 - ev.blind_frac)} of cycles; same ledger state reproduces the same numbers.` },
    { discipline: 'risk_manager', assessment: verdict === 'APPLY_CANDIDATE' ? 'False-discovery risk is priced: nomination only — the champion/challenger gates (held-out Brier bar, both halves positive, multiplicity-corrected significance) still decide, and the ladder moves in small tested steps from zero.' : verdict === 'WITHDRAW' ? 'A slow signal that never speaks and never beats the baseline is not a signal — the risk-managed move is to withdraw, not to keep a dead hypothesis on life support.' : 'When in doubt I vote HOLD: adopting noise corrupts every forecast it touches, and that is the costliest error I can make.' },
    { discipline: 'intelligence_analyst', assessment: `Known: ${pct(ev.decisive_frac)} decisive reads over ${ev.n} cycles. Unknown: whether aggregate drift reflects genuine repositioning or rotating exchange plumbing. Confidence: ${verdict === 'HOLD' ? 'low — the honest answer' : 'moderate — evidence-backed, still falsifiable'}.` },
    { discipline: 'research_scientist', assessment: 'Hypothesis ledger updated — statuses changed only where the evidence moved them; nothing was buried and nothing was accepted without a test.' },
    { discipline: 'principal_investigator', assessment: `I sign this verdict: ${verdict}. It is defensible from the record below, and I will reverse it the moment the evidence does.` },
    { discipline: 'trader', assessment: 'The ledger you see is history — by the time balances visibly drain, the informed money may already be positioned. Flow health is a slow regime read; I never trade it like a fast signal, and no APPLY verdict of mine ever skips out-of-sample proof.' },
  ];
}

function plainVerdict(v, ev) {
  if (v.verdict === 'APPLY_CANDIDATE') return `Ophelia's verdict: the evidence supports giving aggregate exchange flows a trial in the forecast model. Her flow-health reads have beaten the baseline out-of-sample over ${ev.member_n} scored forecasts. Her nomination now goes to formal testing — strict statistical gates still have the final say.`;
  if (v.verdict === 'WITHDRAW') return `Ophelia's verdict: the evidence says aggregate exchange flows carry no usable signal. She recommends removing it from the model entirely — a negative result, published honestly.`;
  return `Ophelia's verdict: hold and keep watching. The flow evidence so far is neither strong enough to apply nor weak enough to withdraw — the watch stays open.`;
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
    const lp = path.join(dataDir, 'ophelia-log.jsonl');
    if (existsSync(lp)) notes = parseOpheliaLogLines(readFileSync(lp, 'utf8'));
  } catch { notes = []; }
  if (!notes.length) notes = (summary && summary.ophelia && Array.isArray(summary.ophelia.log)) ? summary.ophelia.log : [];
  const raw = summary && summary.windows && summary.windows.all && summary.windows.all.flowhealth
    ? summary.windows.all.flowhealth : null;
  const scoreboard = raw ? { n: raw.n, brierMember: raw.brierFlowHealth, brierBase: raw.brierBase, skill24h: raw.skill24h } : null;

  let prev = null;
  const outPath = path.join(dataDir, 'ophelia_supervisor.json');
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
    agent: 'ophelia',
    title: 'Principal Investigator, On-Chain Flows Lab',
    charter_version: CHARTER_VERSION,
    charter: 'OPHELIA_CHARTER.md',
    updated_at: nowIso,
    verdict: v.verdict,
    verdict_why: v.why,
    verdict_plain: plainVerdict(v, evidence),
    evidence,
    model_gates: 'APPLY_CANDIDATE nominates only. Adoption requires the runner\'s champion/challenger gates: held-out Brier improvement above a published bar, positive in both halves, multiplicity-corrected significance, and a minimum gap between adoptions. WITHDRAW recommends flowHealthWeight 0. This file never changes a weight directly and never touches Wendy\'s onchainWeight or any other agent\'s weight.',
    hypotheses,
    literature: literature.slice(-12),
    literature_new: fresh,
    literature_error: litError,
    disciplines_applied: disciplines,
  };

  writeFileSync(outPath, JSON.stringify(doc, null, 1) + '\n');
  console.log(JSON.stringify({ ts: nowIso, agent: 'ophelia-supervisor', verdict: v.verdict, notes: evidence.n, new_papers: fresh.length }));
}

if (process.argv[1] && process.argv[1].endsWith('ophelia-supervisor.js')) main();
