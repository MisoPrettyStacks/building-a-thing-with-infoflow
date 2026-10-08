// Masha's supervisor cycle — implements MASHA_CHARTER.md (v1.0.0).
//
// Once per cycle (weekly via workflow) Masha:
//   1. scans the literature (internet: arXiv) for relevant science,
//   2. maintains her hypothesis ledger (statuses change only on evidence),
//   3. summarizes the experimental evidence from the lab notebook,
//   4. renders one honest line per discipline from the actual numbers,
//   5. issues her standing scientific verdict: HOLD / APPLY_CANDIDATE / WITHDRAW.
//
// The verdict is deterministic given its inputs. It never changes a forecast
// weight directly: APPLY_CANDIDATE only *nominates* the information-flow
// member for the runner's champion/challenger gates; WITHDRAW recommends
// weight 0. Internet text can propose hypotheses — it can never move weights.
//
// Usage: node scripts/masha-supervisor.js --data ./data-branch
// Writes: <data>/masha_supervisor.json

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const CHARTER_VERSION = '1.0.0';
export const Z_BAR = 2;            // significance bar (matches LAB_Z_THRESHOLD)
export const NOISE_PE = 0.85;      // noise-regime bar (matches LAB_NOISE_PE)
export const HISTORY_CAP = 200;    // notes examined per cycle
export const MIN_HISTORY = 50;     // below this: HOLD, always
export const APPLY_MIN_N = 100;
export const APPLY_SIG_FRAC = 0.60;
export const APPLY_NOISE_MAX = 0.50;
export const WITHDRAW_SIG_FRAC = 0.20;
export const WITHDRAW_NOISE_MIN = 0.80;
export const OOS_MIN_N = 200;      // scored forecasts needed for an OOS verdict

const QUERIES = [
  'all:cryptocurrency+AND+all:predictability',
  'all:bitcoin+AND+all:high-frequency+AND+all:forecast',
  'all:order+flow+AND+all:cryptocurrency',
  'all:calibration+AND+all:probabilistic+AND+all:forecast',
  'all:transfer+entropy+AND+all:financial+markets',
  'all:information+flow+AND+all:bitcoin',
  'all:cryptocurrency+AND+all:cross+sectional+AND+all:return+predictability',
];

async function arxivSearch(q) {
  const url = 'https://export.arxiv.org/api/query?search_query=' + encodeURIComponent(q) +
    '&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending';
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'building-a-thing-with-agents/masha-supervisor' } });
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
  let sig = 0, noisy = 0, insufficient = 0, noisySig = 0, cleanSig = 0, nNoisy = 0, nClean = 0;
  let netSum = 0, netN = 0;
  for (const note of hist) {
    const c = note && note.computed;
    if (!c || !Number.isFinite(c.z_btc_xrp)) { insufficient++; continue; }
    const isSig = c.z_btc_xrp > Z_BAR && c.net > 0;
    const isNoisy = !!c.noisy;
    if (isSig) sig++;
    if (isNoisy) { noisy++; nNoisy++; if (isSig) noisySig++; }
    else { nClean++; if (isSig) cleanSig++; }
    if (Number.isFinite(c.net)) { netSum += c.net; netN++; }
  }
  const sb = scoreboard || {};
  const mem = sb.members || {};
  const memberBrier = Number.isFinite(mem.infoflow) ? mem.infoflow : null;
  const ensembleBrier = Number.isFinite(sb.brier) ? sb.brier : null;
  const memberN = Number.isFinite(mem.infoflow_n) ? mem.infoflow_n : 0;
  const oosEdge = memberBrier != null && ensembleBrier != null && memberN >= OOS_MIN_N && memberBrier < ensembleBrier;
  return {
    n,
    insufficient_frac: n ? insufficient / n : 1,
    sig_frac: n ? sig / n : 0,
    noise_frac: n ? noisy / n : 0,
    noisy_sig_rate: nNoisy ? noisySig / nNoisy : null,
    clean_sig_rate: nClean ? cleanSig / nClean : null,
    mean_net: netN ? netSum / netN : null,
    member_brier: memberBrier, ensemble_brier: ensembleBrier, member_n: memberN,
    oos_edge: oosEdge,
  };
}

/** Pure: the charter's deterministic verdict rules. */
export function decideVerdict(ev) {
  if (ev.n < MIN_HISTORY) {
    return { verdict: 'HOLD', why: `Only ${ev.n} lab notes on record (need >= ${MIN_HISTORY}) — not enough history for any scientific verdict. I keep gathering evidence.` };
  }
  if (ev.n >= APPLY_MIN_N && ev.sig_frac >= APPLY_SIG_FRAC && ev.oos_edge && ev.noise_frac < APPLY_NOISE_MAX) {
    return {
      verdict: 'APPLY_CANDIDATE',
      why: `Persistent significance (${(ev.sig_frac * 100).toFixed(1)}% of ${ev.n} cycles, z > ${Z_BAR}) plus real out-of-sample edge (member Brier ${ev.member_brier.toFixed(5)} vs ensemble ${ev.ensemble_brier.toFixed(5)}, n=${ev.member_n}) in an ordered regime (noise ${(ev.noise_frac * 100).toFixed(1)}%). I nominate information flow for weight adoption — the champion/challenger gates still decide.`,
    };
  }
  if (ev.n >= APPLY_MIN_N && ((ev.sig_frac < WITHDRAW_SIG_FRAC && !ev.oos_edge) || ev.noise_frac >= WITHDRAW_NOISE_MIN)) {
    const bits = [];
    if (ev.sig_frac < WITHDRAW_SIG_FRAC && !ev.oos_edge) bits.push(`significant only ${(ev.sig_frac * 100).toFixed(1)}% of cycles with no out-of-sample edge`);
    if (ev.noise_frac >= WITHDRAW_NOISE_MIN) bits.push(`noise-dominated ${(ev.noise_frac * 100).toFixed(1)}% of the time`);
    return { verdict: 'WITHDRAW', why: `Sustained absence of evidence: ${bits.join('; ')}. A refuted hypothesis is a successful experiment — I recommend weight 0 and the ledger records the refutation.` };
  }
  const bits = [];
  if (ev.n < APPLY_MIN_N) bits.push(`history still short (${ev.n}/${APPLY_MIN_N})`);
  if (!(ev.sig_frac >= APPLY_SIG_FRAC)) bits.push(`significance ${(ev.sig_frac * 100).toFixed(1)}% is below the ${(APPLY_SIG_FRAC * 100).toFixed(0)}% bar`);
  if (!ev.oos_edge) bits.push(ev.member_n >= OOS_MIN_N ? 'no out-of-sample edge on the scoreboard' : `scoreboard still warming up (n=${ev.member_n}/${OOS_MIN_N})`);
  if (!(ev.noise_frac < APPLY_NOISE_MAX)) bits.push(`noise regime ${(ev.noise_frac * 100).toFixed(1)}% of the time`);
  return { verdict: 'HOLD', why: `The case is not made in either direction: ${bits.join('; ')}. I keep the experiment open and keep gathering evidence.` };
}

function seedHypotheses() {
  return [
    { id: 'H1', claim: 'BTC→XRP transfer entropy is persistently significant (z > 2, net > 0) in ordinary market regimes.', prediction: 'sig_frac ≥ 0.60 over rolling history once n ≥ 100', test: 'lab-notebook significance rate', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'H2', claim: 'Significant information flow translates to out-of-sample skill: the infoflow member beats the ensemble on Brier score.', prediction: 'member Brier < ensemble Brier over n ≥ 200 scored forecasts', test: 'live scoreboard comparison', status: 'open', status_why: 'scoreboard warming up', updated_at: null },
    { id: 'H3', claim: 'Noise regimes (permutation entropy > 0.85) suppress measurable information flow.', prediction: 'significance rate in noisy cycles well below the rate in clean cycles', test: 'conditional significance rates from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'H4', claim: 'The coupling is directional: BTC leads XRP (net flow > 0 on average).', prediction: 'mean net TE > 0 over history', test: 'mean net flow from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
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
    set('H1', ev.sig_frac >= APPLY_SIG_FRAC ? 'supported' : (ev.sig_frac < WITHDRAW_SIG_FRAC ? 'refuted' : 'open'),
      `sig_frac=${ev.sig_frac.toFixed(3)} over n=${ev.n}`);
    if (ev.mean_net != null) set('H4', ev.mean_net > 0 ? 'supported' : 'refuted', `mean net=${ev.mean_net.toFixed(4)} nats`);
  }
  if (ev.member_n >= OOS_MIN_N) {
    set('H2', ev.oos_edge ? 'supported' : 'refuted',
      `member ${ev.member_brier?.toFixed(5)} vs ensemble ${ev.ensemble_brier?.toFixed(5)}, n=${ev.member_n}`);
  }
  if (ev.noisy_sig_rate != null && ev.clean_sig_rate != null && ev.n >= APPLY_MIN_N) {
    set('H3', ev.noisy_sig_rate < 0.5 * ev.clean_sig_rate ? 'supported' : 'open',
      `noisy sig rate=${ev.noisy_sig_rate.toFixed(3)} vs clean=${ev.clean_sig_rate.toFixed(3)}`);
  }
  return hyps;
}

/** Pure: one honest line per discipline, rendered from the numbers. */
export function buildDisciplines(ev, verdict) {
  const pct = (x) => (x * 100).toFixed(1) + '%';
  return [
    { discipline: 'physicist', assessment: ev.noise_frac >= 0.5 ? `Noise-dominated regime (${pct(ev.noise_frac)} of cycles) — in a disordered medium no structure can propagate, so weak flow is expected, not suspicious.` : `Ordered enough to listen (${pct(ev.noise_frac)} noisy) — if coupling exists, this is the regime where it shows.` },
    { discipline: 'mathematician', assessment: `Estimator fixed and reported with every number: 3 quantile bins, 1-step histories, 50 shuffle surrogates, z > ${Z_BAR} bar. Change the estimator and the number changes — so the estimator is part of the result.` },
    { discipline: 'economist', assessment: ev.sig_frac >= 0.5 ? `Persistent BTC→XRP flow is consistent with BTC as the dominant price-discovery venue; the mechanism is plausible, not just the statistic.` : `No persistent flow to explain — I will not invent an economic story for a statistic that is not there.` },
    { discipline: 'information_theorist', assessment: ev.mean_net != null ? `Mean net flow ${ev.mean_net >= 0 ? '+' : ''}${ev.mean_net.toFixed(4)} nats (BTC→XRP minus XRP→BTC). By the data-processing inequality I cannot manufacture information by re-binning — only reveal or destroy it.` : 'No flow measured yet — nothing to decompose.' },
    { discipline: 'statistician', assessment: `sig_frac=${pct(ev.sig_frac)} over n=${ev.n}; ${ev.oos_edge ? `out-of-sample edge confirmed (Brier ${ev.member_brier.toFixed(5)} < ${ev.ensemble_brier.toFixed(5)}, n=${ev.member_n})` : ev.member_n >= OOS_MIN_N ? 'no out-of-sample edge — the scoreboard overrules the lab bench' : `scoreboard still warming up (n=${ev.member_n}/${OOS_MIN_N}) — a backtest is a hypothesis, never evidence`}.` },
    { discipline: 'risk_manager', assessment: verdict === 'APPLY_CANDIDATE' ? 'False-discovery risk is priced: nomination only — the champion/challenger gates (Brier ≥ 2e-4, both halves positive, Bonferroni α) still decide, and the ladder moves in small tested steps.' : verdict === 'WITHDRAW' ? 'Sustained negative evidence — the risk-managed move is to withdraw, not to keep a dead hypothesis on life support.' : 'When in doubt I vote HOLD: adopting noise corrupts every forecast it touches, and that is the costliest error I can make.' },
    { discipline: 'computational_scientist', assessment: ev.insufficient_frac > 0.2 ? `Data-quality flag: ${pct(ev.insufficient_frac)} of cycles had too few aligned bars to measure honestly — I check the instruments before trusting the readings.` : `Pipeline healthy: ${pct(1 - ev.insufficient_frac)} of cycles produced honest measurements; same inputs reproduce the same outputs.` },
    { discipline: 'trader', assessment: 'Statistical significance is not tradability — spreads, fees and latency eat edges this lab cannot see. That is why no APPLY verdict of mine ever skips out-of-sample proof.' },
    { discipline: 'intelligence_analyst', assessment: `Known: ${pct(ev.sig_frac)} significance over ${ev.n} cycles. Unknown: whether the effect survives the next regime. Confidence: ${verdict === 'HOLD' ? 'low — the honest answer' : 'moderate — evidence-backed, still falsifiable'}.` },
    { discipline: 'research_scientist', assessment: 'Hypothesis ledger updated — statuses changed only where the evidence moved them; nothing was buried and nothing was accepted without a test.' },
    { discipline: 'principal_investigator', assessment: `I sign this verdict: ${verdict}. It is defensible from the record below, and I will reverse it the moment the evidence does.` },
  ];
}

function plainVerdict(v, ev) {
  if (v.verdict === 'APPLY_CANDIDATE') return `Masha's verdict: the evidence supports giving information flow a trial in the forecast model. BTC→XRP flow has been significant in ${(ev.sig_frac * 100).toFixed(0)}% of recent measurements and the signal has beaten the ensemble out-of-sample. Her nomination now goes to formal testing — strict statistical gates still have the final say.`;
  if (v.verdict === 'WITHDRAW') return `Masha's verdict: the evidence says this effect is absent or dead. She recommends removing information flow from the model entirely — a negative result, published honestly.`;
  return `Masha's verdict: hold and keep experimenting. The evidence so far is neither strong enough to apply nor weak enough to withdraw — the experiment stays open.`;
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
  const notes = (summary && summary.masha && Array.isArray(summary.masha.log)) ? summary.masha.log : [];
  const scoreboard = summary && summary.windows && summary.windows.all ? summary.windows.all : null;

  let prev = null;
  const outPath = path.join(dataDir, 'masha_supervisor.json');
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
    agent: 'masha',
    title: 'Principal Investigator, Information Flow Lab',
    charter_version: CHARTER_VERSION,
    charter: 'MASHA_CHARTER.md',
    updated_at: nowIso,
    verdict: v.verdict,
    verdict_why: v.why,
    verdict_plain: plainVerdict(v, evidence),
    evidence,
    model_gates: 'APPLY_CANDIDATE nominates only. Adoption requires the runner\'s champion/challenger gates: held-out Brier improvement ≥ 2e-4, positive in both halves, family-wise α=0.05 with Bonferroni correction, ≥24h between adoptions. WITHDRAW recommends infoflowWeight 0. This file never changes a weight directly.',
    hypotheses,
    literature: literature.slice(-12),
    literature_new: fresh,
    literature_error: litError,
    disciplines_applied: disciplines,
  };

  writeFileSync(outPath, JSON.stringify(doc, null, 1) + '\n');
  console.log(JSON.stringify({ ts: nowIso, agent: 'masha-supervisor', verdict: v.verdict, notes: evidence.n, new_papers: fresh.length }));
}

if (process.argv[1] && process.argv[1].endsWith('masha-supervisor.js')) main();
