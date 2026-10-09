// Miso's supervisor cycle — implements MISO_CHARTER.md (v1.0.0).
//
// Miso's method is not published — not here, not anywhere. What this
// supervisor audits is the *record*: her logged guesses and how they
// scored. It never asks how a guess was made and it never changes a
// forecast weight directly: APPLY_CANDIDATE only nominates her member
// for the runner's champion/challenger gates; WITHDRAW recommends 0.
//
// Usage: node scripts/miso-supervisor.js --data ./data-branch
// Writes: <data>/miso_supervisor.json

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseMisoLogLines, isDecisiveMiso } from '../lib/misonote.js';

export const CHARTER_VERSION = '1.0.0';
export const HISTORY_CAP = 200;
export const MIN_HISTORY = 50;
export const APPLY_MIN_N = 100;
export const APPLY_DECISIVE_MIN = 0.40;
export const WITHDRAW_DECISIVE_MAX = 0.15;
export const OOS_MIN_N = 200;
export const SKILL_MIN_N = 30;

const QUERIES = [
  'all:forecast+AND+all:calibration+AND+all:Brier+score',
  'all:prediction+AND+all:accuracy+AND+all:evaluation',
  'all:short+horizon+AND+all:directional+AND+all:forecasting',
  'all:probability+AND+all:forecast+AND+all:scoring+rules',
];

async function arxivSearch(q) {
  const url = 'https://export.arxiv.org/api/query?search_query=' + encodeURIComponent(q) +
    '&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending';
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'building-a-thing-with-infoflow/miso-supervisor' } });
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

/** Pure: evidence summary from the guesses log + scoreboard. */
export function computeEvidence(notes, scoreboardGuesses) {
  const hist = (Array.isArray(notes) ? notes : []).slice(-HISTORY_CAP);
  const n = hist.length;
  let decisive = 0, guessed = 0, blind = 0, warming = 0, above = 0;
  for (const note of hist) {
    const c = note && note.computed;
    if (!c) { blind++; continue; }
    if (c.degraded) { blind++; continue; }
    if (c.warming_up) { warming++; continue; }
    if (c.guess) guessed++;
    if (c.guess === 'above') above++;
    if (c.decisive) decisive++;
  }
  const sb = scoreboardGuesses || {};
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
    guessed_frac: n ? guessed / n : 0,
    above_frac: guessed ? above / guessed : 0,
    member_brier: memberBrier, base_brier: baseBrier, member_n: memberN,
    oos_edge: oosEdge,
    skill24h: skill,
  };
}

/** Pure: deterministic verdict from the record alone. */
export function decideVerdict(ev) {
  if (ev.n < MIN_HISTORY) {
    return { verdict: 'HOLD', why: `Only ${ev.n} log entries on record (need >= ${MIN_HISTORY}) — not enough history for any verdict. She keeps guessing.` };
  }
  if (ev.n >= APPLY_MIN_N && ev.oos_edge && ev.decisive_frac >= APPLY_DECISIVE_MIN) {
    return {
      verdict: 'APPLY_CANDIDATE',
      why: `Real out-of-sample edge on the public record (member Brier ${ev.member_brier.toFixed(5)} vs baseline ${ev.base_brier.toFixed(5)}, n=${ev.member_n}) and the guesses actually lean (${(ev.decisive_frac * 100).toFixed(1)}% of cycles decisive). The record nominates her member for weight adoption — the champion/challenger gates still decide.`,
    };
  }
  if (ev.n >= APPLY_MIN_N && !ev.oos_edge && ev.decisive_frac < WITHDRAW_DECISIVE_MAX) {
    return { verdict: 'WITHDRAW', why: `No out-of-sample edge and the guesses rarely lean (decisive only ${(ev.decisive_frac * 100).toFixed(1)}% of cycles). A record that never beats the baseline does not earn a weight — I recommend 0 and the ledger records the result.` };
  }
  const bits = [];
  if (ev.n < APPLY_MIN_N) bits.push(`history still short (${ev.n}/${APPLY_MIN_N})`);
  if (!ev.oos_edge) bits.push(ev.member_n >= OOS_MIN_N ? 'no out-of-sample edge on the scoreboard' : `scoreboard still warming up (n=${ev.member_n}/${OOS_MIN_N})`);
  if (!(ev.decisive_frac >= APPLY_DECISIVE_MIN)) bits.push(`decisive guesses ${(ev.decisive_frac * 100).toFixed(1)}% — below the ${(APPLY_DECISIVE_MIN * 100).toFixed(0)}% bar`);
  if (ev.blind_frac > 0.2) bits.push(`screen dark ${(ev.blind_frac * 100).toFixed(1)}% of cycles — the record checks availability before trusting readings`);
  return { verdict: 'HOLD', why: `The case is not made in either direction: ${bits.join('; ')}. The guesses continue and so does the scoring.` };
}

function seedHypotheses() {
  return [
    { id: 'MI1', claim: 'Miso\'s guesses beat the baseline forecast out-of-sample on Brier score.', prediction: 'member Brier < baseline Brier over n ≥ 200 scored forecasts', test: 'live scoreboard comparison', status: 'open', status_why: 'scoreboard warming up', updated_at: null },
    { id: 'MI2', claim: 'Her directional record beats chance — when she guesses above or below, she is right more often than a coin.', prediction: '24h direction hit rate > 0.50 baseline', test: '24h directional skill vs 0.50 baseline', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'MI3', claim: 'She guesses often enough to matter — not a once-a-quarter curiosity.', prediction: 'decisive_frac ≥ 0.40 over rolling history once n ≥ 100', test: 'decisive-guess rate from the log', status: 'open', status_why: 'awaiting history', updated_at: null },
  ];
}

export function updateHypotheses(prev, ev, nowIso) {
  const hyps = (Array.isArray(prev) && prev.length ? prev : seedHypotheses()).map((h) => ({ ...h }));
  const set = (id, status, why) => {
    const h = hyps.find((x) => x.id === id);
    if (!h) return;
    if (h.status !== status) { h.status = status; h.status_why = why; h.updated_at = nowIso; }
  };
  if (ev.member_n >= OOS_MIN_N) {
    set('MI1', ev.oos_edge ? 'supported' : 'refuted',
      `member ${ev.member_brier?.toFixed(5)} vs baseline ${ev.base_brier?.toFixed(5)}, n=${ev.member_n}`);
  }
  if (ev.skill24h) {
    set('MI2', ev.skill24h.beats_baseline ? 'supported' : 'refuted',
      `24h hit rate=${(ev.skill24h.hit_rate * 100).toFixed(1)}% vs 50% baseline, n=${ev.skill24h.n}`);
  }
  if (ev.n >= APPLY_MIN_N) {
    set('MI3', ev.decisive_frac >= APPLY_DECISIVE_MIN ? 'supported' : (ev.decisive_frac < WITHDRAW_DECISIVE_MAX ? 'refuted' : 'open'),
      `decisive_frac=${ev.decisive_frac.toFixed(3)} over n=${ev.n}`);
  }
  return hyps;
}

export function buildDisciplines(ev, verdict) {
  const pct = (x) => (x * 100).toFixed(1) + '%';
  return [
    { discipline: 'statistician', assessment: `The audit reads only the record: she guessed ${pct(ev.guessed_frac)} of cycles, decisively ${pct(ev.decisive_frac)}, above ${pct(ev.above_frac)} of her guesses. A guess is an estimate with error bars — the scoreboard, not the story, decides what it is worth.` },
    { discipline: 'quantitative_finance', assessment: ev.oos_edge ? `Out-of-sample edge on the public record. Whatever she does at that desk, the graded output beats the baseline — and only the graded output was ever claimed.` : `No edge to explain — and none will be invented. The record is the claim.` },
    { discipline: 'mathematician', assessment: `Brier scoring is proper: it rewards honest probabilities and punishes bluster, above or below. Her grades are computed identically to every other member's — no special arithmetic for a secret method.` },
    { discipline: 'risk_manager', assessment: verdict === 'APPLY_CANDIDATE' ? 'False-discovery risk is priced: nomination only — the champion/challenger gates (Brier ≥ 2e-4, both halves positive, Bonferroni α) still decide, and the ladder moves in small tested steps.' : verdict === 'WITHDRAW' ? 'A record that rarely leans and never beats the baseline earns weight 0 — secrecy is not a shield from the scoreboard.' : 'When in doubt the record votes HOLD: adopting noise corrupts every forecast it touches.' },
    { discipline: 'data_engineer', assessment: ev.blind_frac > 0.2 ? `Availability flag: her screen was dark ${pct(ev.blind_frac)} of cycles — the record marks those cycles blind rather than letting silence pose as a guess.` : `Pipeline healthy: guesses logged before resolution, every cycle, same format as every other lab.` },
    { discipline: 'trader', assessment: 'A posted record with a stated price and time, graded in public, is worth more than a published recipe nobody verifies. She posts the calls and the grades; the desk stays hers.' },
    { discipline: 'intelligence_analyst', assessment: `Known: guessed ${pct(ev.guessed_frac)} of cycles, decisive ${pct(ev.decisive_frac)}. Unknown: everything about the method — by design. Confidence in the record: ${verdict === 'HOLD' ? 'low — the honest answer' : 'moderate — evidence-backed, still falsifiable'}.` },
    { discipline: 'research_scientist', assessment: 'Hypothesis ledger updated — statuses changed only where the evidence moved them; the method was never part of the evidence and never needed to be.' },
    { discipline: 'principal_investigator', assessment: `I sign this verdict: ${verdict}. It is defensible from the public record below, and I will reverse it the moment the record does.` },
  ];
}

function plainVerdict(v, ev) {
  if (v.verdict === 'APPLY_CANDIDATE') return `Miso's verdict: her guesses have beaten the baseline out-of-sample over ${ev.member_n} scored forecasts. The record nominates her for a trial in the forecast model — strict statistical gates still have the final say. How she does it remains, as ever, unpublished.`;
  if (v.verdict === 'WITHDRAW') return `Miso's verdict: the record says the guesses carry no usable signal. She recommends removing them from the model — a negative result, published as honestly as the guesses were.`;
  return `Miso's verdict: hold and keep guessing. Her record so far is neither strong enough to apply nor weak enough to withdraw — the scoreboard keeps grading.`;
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
  let notes = [];
  try {
    const lp = path.join(dataDir, 'miso-log.jsonl');
    if (existsSync(lp)) notes = parseMisoLogLines(readFileSync(lp, 'utf8'));
  } catch { notes = []; }
  if (!notes.length) notes = (summary && summary.miso && Array.isArray(summary.miso.log)) ? summary.miso.log : [];
  const scoreboardRaw = summary && summary.windows && summary.windows.all && summary.windows.all.guesses
    ? summary.windows.all.guesses : null;
  const scoreboardGuesses = scoreboardRaw
    ? { n: scoreboardRaw.n, brierMember: scoreboardRaw.brierMiso, brierBase: scoreboardRaw.brierBase, skill24h: scoreboardRaw.skill24h }
    : null;

  let prev = null;
  const outPath = path.join(dataDir, 'miso_supervisor.json');
  try { prev = JSON.parse(readFileSync(outPath, 'utf8')); } catch { prev = null; }

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

  const evidence = computeEvidence(notes, scoreboardGuesses);
  const v = decideVerdict(evidence);
  const hypotheses = updateHypotheses(prev && prev.hypotheses, evidence, nowIso);
  const disciplines = buildDisciplines(evidence, v.verdict);

  const doc = {
    agent: 'miso',
    title: 'Miso — guesses, graded in public. Method unpublished.',
    charter_version: CHARTER_VERSION,
    charter: 'MISO_CHARTER.md',
    updated_at: nowIso,
    verdict: v.verdict,
    verdict_why: v.why,
    verdict_plain: plainVerdict(v, evidence),
    evidence,
    model_gates: 'APPLY_CANDIDATE nominates only. Adoption requires the runner\'s champion/challenger gates: held-out Brier improvement ≥ 2e-4, positive in both halves, family-wise α=0.05 with Bonferroni correction, ≥24h between adoptions. WITHDRAW recommends misoWeight 0. This file never changes a weight directly.',
    hypotheses,
    literature: literature.slice(-12),
    literature_new: fresh,
    literature_error: litError,
    disciplines_applied: disciplines,
  };

  writeFileSync(outPath, JSON.stringify(doc, null, 1) + '\n');
  console.log(JSON.stringify({ ts: nowIso, agent: 'miso-supervisor', verdict: v.verdict, notes: evidence.n, new_papers: fresh.length }));
}

if (process.argv[1] && process.argv[1].endsWith('miso-supervisor.js')) main();
