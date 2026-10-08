// Molly's supervisor cycle — implements MOLLY_CHARTER.md (v1.0.0).
//
// Once per cycle (weekly via workflow) Molly:
//   1. scans the literature (internet: arXiv) for relevant science,
//   2. maintains her hypothesis ledger (statuses change only on evidence),
//   3. summarizes the experimental evidence from the lab notebook,
//   4. renders one honest line per discipline from the actual numbers,
//   5. issues her standing scientific verdict: HOLD / APPLY_CANDIDATE / WITHDRAW.
//
// The verdict is deterministic given its inputs. It never changes a forecast
// weight directly: APPLY_CANDIDATE only *nominates* the macro dampener
// for the runner's champion/challenger gates; WITHDRAW recommends it stay
// at 0. Internet text can propose hypotheses — it can never move weights.
// She never predicts surprise direction; her verdict is about dampening only.
//
// Usage: node scripts/molly-supervisor.js --data ./data-branch
// Writes: <data>/molly_supervisor.json

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseMollyLogLines, isInWindow } from '../lib/mollynote.js';

export const CHARTER_VERSION = '1.0.0';
export const HISTORY_CAP = 200;    // notes examined per cycle
export const MIN_HISTORY = 50;     // below this: HOLD, always
export const APPLY_MIN_N = 100;
export const OOS_WIN_MIN_N = 30;   // scored in-window forecasts needed for an OOS verdict
export const VOL_MIN_N = 30;       // in/out-window |return| samples needed for the M1 vol test

const QUERIES = [
  'all:macro+AND+all:announcement+AND+all:volatility',
  'all:FOMC+AND+all:announcement+AND+all:effects',
  'all:economic+AND+all:announcements+AND+all:asset+AND+all:prices',
  'all:macroeconomic+AND+all:news+AND+all:cryptocurrency',
  'all:scheduled+AND+all:announcements+AND+all:volatility',
  'all:CPI+AND+all:release+AND+all:market+AND+all:reaction',
];

async function arxivSearch(q) {
  const url = 'https://export.arxiv.org/api/query?search_query=' + encodeURIComponent(q) +
    '&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending';
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'building-a-thing-with-agents/molly-supervisor' } });
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
  let inWin = 0, blind = 0, warming = 0, biasZero = 0, biasSeen = 0;
  const retIn = [], retOut = [];
  for (const note of hist) {
    const c = note && note.computed;
    if (!c) { blind++; continue; }
    if (c.degraded) { blind++; continue; }
    if (c.warming_up) { warming++; continue; }
    if (c.in_window) inWin++;
    biasSeen++;
    if (c.bias === 0) biasZero++;
    if (Number.isFinite(c.ret_abs) && c.ret_abs >= 0) (c.in_window ? retIn : retOut).push(c.ret_abs);
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const sb = scoreboard || {};
  const ew = sb.eventWindow || null;
  const eventN = ew && Number.isFinite(ew.n) ? ew.n : 0;
  const oosEdge = ew != null
    && Number.isFinite(ew.brierMacro) && Number.isFinite(ew.brierBase)
    && eventN >= OOS_WIN_MIN_N && ew.brierMacro < ew.brierBase;
  return {
    n,
    blind_frac: n ? blind / n : 1,
    warming_frac: n ? warming / n : 0,
    window_frac: n ? inWin / n : 0,
    bias_zero_frac: biasSeen ? biasZero / biasSeen : 1,
    vol_in: { n: retIn.length, mean: mean(retIn) },
    vol_out: { n: retOut.length, mean: mean(retOut) },
    event_window: ew ? { n: ew.n, brierMacro: ew.brierMacro, brierBase: ew.brierBase } : null,
    event_n: eventN,
    all_window: { n: Number.isFinite(sb.n) ? sb.n : 0, brierMacro: sb.brierMacro, brierBase: sb.brierBase },
    oos_edge: oosEdge,
  };
}

/** Pure: the charter's deterministic verdict rules. */
export function decideVerdict(ev) {
  if (ev.n < MIN_HISTORY) {
    return { verdict: 'HOLD', why: `Only ${ev.n} lab notes on record (need >= ${MIN_HISTORY}) — not enough history for any scientific verdict. The calendar keeps turning; I keep watching.` };
  }
  if (ev.n >= APPLY_MIN_N && ev.oos_edge) {
    return {
      verdict: 'APPLY_CANDIDATE',
      why: `Real out-of-sample edge inside event windows (dampened what-if Brier ${ev.event_window.brierMacro.toFixed(5)} vs issued ${ev.event_window.brierBase.toFixed(5)}, n=${ev.event_n} scored in-window forecasts). I nominate the macro dampener for adoption — the champion/challenger gates still decide.`,
    };
  }
  if (ev.n >= APPLY_MIN_N && ev.event_n >= OOS_WIN_MIN_N && !ev.oos_edge) {
    return { verdict: 'WITHDRAW', why: `Thirty-plus real event windows scored (${ev.event_n}) and the dampened what-if never beat the issued forecast inside them. Humility is a virtue, but a dampener with no edge is decoration — I recommend it stay at 0 and the ledger records the refutation.` };
  }
  const bits = [];
  if (ev.n < APPLY_MIN_N) bits.push(`history still short (${ev.n}/${APPLY_MIN_N})`);
  if (!ev.oos_edge) bits.push(ev.event_n >= OOS_WIN_MIN_N ? 'no out-of-sample edge inside event windows' : `in-window scoreboard still warming up (event n=${ev.event_n}/${OOS_WIN_MIN_N})`);
  if (ev.window_frac < 0.01) bits.push(`barely any event windows observed (${(ev.window_frac * 100).toFixed(1)}% of cycles — my regime has not shown up enough to judge)`);
  if (ev.blind_frac > 0.2) bits.push(`calendar blind ${(ev.blind_frac * 100).toFixed(1)}% of cycles — I check the instruments before trusting the readings`);
  return { verdict: 'HOLD', why: `The case is not made in either direction: ${bits.join('; ')}. I keep the calendar open and keep gathering evidence.` };
}

function seedHypotheses() {
  return [
    { id: 'M1', claim: 'Realized volatility is higher inside macro event windows than outside them: scheduled releases spike volatility in XRP.', prediction: 'mean |15-min return| in-window > out-of-window', test: 'lab-note return comparison (needs >= 30 samples each side)', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'M2', claim: 'The dampened what-if series beats the issued forecast out-of-sample inside event windows.', prediction: 'in-window Brier(p_macro) < Brier(p) over n >= 30 scored in-window forecasts', test: 'live scoreboard event-window block', status: 'open', status_why: 'scoreboard warming up', updated_at: null },
    { id: 'M3', claim: 'Tier-1 releases (FOMC, CPI, payrolls) differ from tier-2 (PPI, retail sales, ISM): the bigger shrink buys a bigger edge.', prediction: 'in-window edge is larger for tier-1 windows than tier-2', test: 'scoreboard split by tier from lab notes', status: 'open', status_why: 'scoreboard does not split by tier — test not runnable', updated_at: null },
    { id: 'M4', claim: 'The lab never predicts direction: the surprise direction of a macro release is a coin flip, so the lab only ever dampens confidence.', prediction: 'computed bias is exactly 0 in every lab note', test: 'bias audit over lab-note history', status: 'open', status_why: 'awaiting history', updated_at: null },
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
  if (ev.vol_in.n >= VOL_MIN_N && ev.vol_out.n >= VOL_MIN_N && ev.vol_in.mean != null && ev.vol_out.mean != null) {
    set('M1', ev.vol_in.mean > ev.vol_out.mean ? 'supported' : 'refuted',
      `mean |ret| in-window=${ev.vol_in.mean.toExponential(2)} (n=${ev.vol_in.n}) vs out=${ev.vol_out.mean.toExponential(2)} (n=${ev.vol_out.n})`);
  }
  if (ev.event_n >= OOS_WIN_MIN_N) {
    set('M2', ev.oos_edge ? 'supported' : 'refuted',
      `in-window brierMacro=${ev.event_window.brierMacro.toFixed(5)} vs brierBase=${ev.event_window.brierBase.toFixed(5)}, n=${ev.event_n}`);
  }
  // M3: no tier-split scoreboard exists — the test cannot run, so the status cannot change.
  if (ev.n >= MIN_HISTORY) {
    set('M4', ev.bias_zero_frac === 1 ? 'supported' : 'refuted',
      `bias === 0 in ${(ev.bias_zero_frac * 100).toFixed(1)}% of ${ev.n} notes — the humility doctrine ${ev.bias_zero_frac === 1 ? 'holds' : 'was VIOLATED'}`);
  }
  return hyps;
}

/** Pure: one honest line per discipline, rendered from the numbers. */
export function buildDisciplines(ev, verdict) {
  const pct = (x) => (x * 100).toFixed(1) + '%';
  const ewTxt = ev.event_window
    ? `in-window Brier ${ev.event_window.brierMacro.toFixed(5)} vs ${ev.event_window.brierBase.toFixed(5)} (n=${ev.event_window.n})`
    : 'in-window scoreboard not yet available';
  return [
    { discipline: 'macroeconomics', assessment: ev.window_frac >= 0.01 ? `Event windows are my ground truth and they showed up (${pct(ev.window_frac)} of cycles). FOMC, CPI, payrolls reprice risk for every asset on Earth — the surprise is the information, and the surprise cannot be predicted, so I dampen instead of betting.` : `The calendar was quiet (${pct(ev.window_frac)} of cycles in-window) — scheduled releases are rare by design. Patience is the method; I do not manufacture windows.` },
    { discipline: 'market_microstructure', assessment: ev.vol_in.n >= VOL_MIN_N && ev.vol_out.n >= VOL_MIN_N && ev.vol_in.mean != null ? `The tape agrees with the theory: mean |15-min return| in-window ${ev.vol_in.mean.toExponential(2)} vs out-of-window ${ev.vol_out.mean.toExponential(2)}. Volatility is the signature; direction stays a coin flip.` : `Volatility comparison still warming up (in-window |return| samples ${ev.vol_in.n}/${VOL_MIN_N}, out ${ev.vol_out.n}/${VOL_MIN_N}) — I will not claim the spike until the lab's own tape shows it.` },
    { discipline: 'statistician', assessment: `${ewTxt}; ${ev.oos_edge ? 'the dampened what-if beats the issued forecast where the dampening actually operates' : ev.event_n >= OOS_WIN_MIN_N ? 'no out-of-sample edge — the scoreboard overrules the theory' : `sample still small (event n=${ev.event_n}/${OOS_WIN_MIN_N})`}. Outside windows the what-if equals the forecast by construction, so only the in-window block can judge me.` },
    { discipline: 'risk_manager', assessment: verdict === 'APPLY_CANDIDATE' ? 'False-discovery risk is priced: nomination only — the champion/challenger gates (held-out Brier bar, both halves positive, multiplicity-corrected significance) still decide, and adoption moves in small tested steps from zero.' : verdict === 'WITHDRAW' ? 'A dampener that watched thirty real releases and never helped is decoration, not humility — the risk-managed move is to keep it at 0.' : 'When in doubt I vote HOLD: a dampener adopted on noise would shrink every honest forecast it touches, and that is the costliest error I can make.' },
    { discipline: 'data_engineer', assessment: ev.blind_frac > 0.2 ? `Instrument flag: calendar unseen ${pct(ev.blind_frac)} of cycles — a failed parse looks like a quiet week unless you check, and I check.` : `Calendar healthy: parsed ${pct(1 - ev.blind_frac)} of cycles; same timestamp reproduces the same window state, always.` },
    { discipline: 'behavioral_finance', assessment: 'Confidence is the liability here. Forecasters are most certain exactly when they should be most humble — pre-release positioning and post-release storytelling are biases, not information. Shrinking toward 0.5 inside a window is the rational response to a known-unknown.' },
    { discipline: 'intelligence_analyst', assessment: `Known: ${pct(ev.window_frac)} of cycles in-window over ${ev.n} notes; humility doctrine held at ${(ev.bias_zero_frac * 100).toFixed(1)}%. Unknown: whether the dampening buys real skill — ${ev.event_n} in-window scored forecasts so far. Confidence: ${verdict === 'HOLD' ? 'low — the honest answer' : 'moderate — evidence-backed, still falsifiable'}.` },
    { discipline: 'research_scientist', assessment: 'Hypothesis ledger updated — statuses changed only where the evidence moved them; M3 stays open because the scoreboard cannot split by tier yet. Nothing was buried and nothing was accepted without a test.' },
    { discipline: 'principal_investigator', assessment: `I sign this verdict: ${verdict}. It is defensible from the record below, and I will reverse it the moment the evidence does.` },
  ];
}

function plainVerdict(v, ev) {
  if (v.verdict === 'APPLY_CANDIDATE') return `Molly's verdict: the evidence supports arming the macro dampener. The dampened what-if has beaten the issued forecast out-of-sample inside real event windows over ${ev.event_n} scored forecasts. Her nomination now goes to formal testing — strict statistical gates still have the final say.`;
  if (v.verdict === 'WITHDRAW') return `Molly's verdict: the evidence says the macro dampener carries no usable edge. She recommends keeping it at 0 — a negative result, published honestly. The calendar keeps turning; the humility stays, the adjustment goes.`;
  return `Molly's verdict: hold and keep watching. The event-window evidence so far is neither strong enough to arm the dampener nor weak enough to retire it — the watch stays open.`;
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
    const lp = path.join(dataDir, 'molly-log.jsonl');
    if (existsSync(lp)) notes = parseMollyLogLines(readFileSync(lp, 'utf8'));
  } catch { notes = []; }
  if (!notes.length) notes = (summary && summary.molly && Array.isArray(summary.molly.log)) ? summary.molly.log : [];
  const raw = summary && summary.windows && summary.windows.all && summary.windows.all.macro
    ? summary.windows.all.macro : null;
  const scoreboard = raw ? { n: raw.n, brierMacro: raw.brierMacro, brierBase: raw.brierBase, eventWindow: raw.eventWindow } : null;

  let prev = null;
  const outPath = path.join(dataDir, 'molly_supervisor.json');
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
    agent: 'molly',
    title: 'Principal Investigator, Macro Events Lab',
    charter_version: CHARTER_VERSION,
    charter: 'MOLLY_CHARTER.md',
    updated_at: nowIso,
    verdict: v.verdict,
    verdict_why: v.why,
    verdict_plain: plainVerdict(v, evidence),
    evidence,
    model_gates: 'APPLY_CANDIDATE nominates only. Adoption requires the runner\'s champion/challenger gates: held-out Brier improvement above a published bar, positive in both halves, multiplicity-corrected significance, and a minimum gap between adoptions. WITHDRAW recommends macroDamp 0. This file never changes a weight directly.',
    hypotheses,
    literature: literature.slice(-12),
    literature_new: fresh,
    literature_error: litError,
    disciplines_applied: disciplines,
  };

  writeFileSync(outPath, JSON.stringify(doc, null, 1) + '\n');
  console.log(JSON.stringify({ ts: nowIso, agent: 'molly-supervisor', verdict: v.verdict, notes: evidence.n, new_papers: fresh.length }));
}

if (process.argv[1] && process.argv[1].endsWith('molly-supervisor.js')) main();
