// Sasha's supervisor cycle — implements SASHA_CHARTER.md (v1.0.0).
//
// Once per cycle (weekly via workflow) Sasha:
//   1. scans the literature (internet: arXiv) for relevant science,
//   2. maintains her hypothesis ledger (statuses change only on evidence),
//   3. summarizes the experimental evidence from the lab notebook,
//   4. renders one honest line per discipline from the actual numbers,
//   5. issues her standing scientific verdict: HOLD / APPLY_CANDIDATE / WITHDRAW.
//
// The verdict is deterministic given its inputs. It never changes a forecast
// weight directly: APPLY_CANDIDATE only *nominates* the sentiment member
// for the runner's champion/challenger gates; WITHDRAW recommends weight 0.
// Internet text can propose hypotheses — it can never move weights.
// In this lab the skeptical standard is higher and HOLD is the expected
// long-run answer: that is honest, and the charter says so.
//
// Usage: node scripts/sasha-supervisor.js --data ./data-branch
// Writes: <data>/sasha_supervisor.json

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseSashaLogLines, isDecisiveSasha } from '../lib/sashanote.js';

export const CHARTER_VERSION = '1.0.0';
export const HISTORY_CAP = 200;    // notes examined per cycle
export const MIN_HISTORY = 50;     // below this: HOLD, always
export const APPLY_MIN_N = 100;
export const APPLY_DECISIVE_MIN = 0.40;
export const WITHDRAW_DECISIVE_MAX = 0.15;
export const OOS_MIN_N = 200;      // scored forecasts needed for an OOS verdict
export const SKILL_MIN_N = 30;     // scored 24h reads needed for a skill read

const QUERIES = [
  'all:social+AND+all:sentiment+AND+all:cryptocurrency+AND+all:returns',
  'all:twitter+AND+all:sentiment+AND+all:bitcoin+AND+all:price',
  'all:reddit+AND+all:sentiment+AND+all:cryptocurrency',
  'all:social+AND+all:media+AND+all:predictability+AND+all:asset+AND+all:returns',
  'all:investor+AND+all:sentiment+AND+all:short-horizon+AND+all:returns',
  'all:lexicon+AND+all:sentiment+AND+all:financial+AND+all:text',
];

async function arxivSearch(q) {
  const url = 'https://export.arxiv.org/api/query?search_query=' + encodeURIComponent(q) +
    '&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending';
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'building-a-thing-with-agents/sasha-supervisor' } });
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

/** Normalize summary.windows.all.sentiment to a uniform scoreboard shape. */
export function normalizeSentimentScoreboard(sb) {
  if (!sb) return null;
  return {
    n: Number.isFinite(sb.n) ? sb.n : 0,
    brierMember: Number.isFinite(sb.brierSentiment) ? sb.brierSentiment : null,
    brierBase: Number.isFinite(sb.brierBase) ? sb.brierBase : null,
    skill24h: sb.skill24h || null,
  };
}

/** Pure: evidence summary from lab notes + scoreboard. */
export function computeEvidence(notes, sb) {
  const hist = (Array.isArray(notes) ? notes : []).slice(-HISTORY_CAP);
  const n = hist.length;
  let decisive = 0, blind = 0, warming = 0, strongMood = 0;
  for (const note of hist) {
    const c = note && note.computed;
    if (!c) { blind++; continue; }
    if (c.degraded) { blind++; continue; }
    if (c.warming_up) { warming++; continue; }
    if (c.decisive) { decisive++; strongMood++; }
  }
  const s = sb || {};
  const memberBrier = Number.isFinite(s.brierMember) ? s.brierMember : null;
  const baseBrier = Number.isFinite(s.brierBase) ? s.brierBase : null;
  const memberN = Number.isFinite(s.n) ? s.n : 0;
  const oosEdge = memberBrier != null && baseBrier != null && memberN >= OOS_MIN_N && memberBrier < baseBrier;
  const sk = s.skill24h || null;
  const skill = sk && Number.isFinite(sk.hitRate) && sk.n >= SKILL_MIN_N
    ? { hit_rate: sk.hitRate, n: sk.n, beats_baseline: sk.hitRate > sk.baseline }
    : null;
  return {
    n,
    blind_frac: n ? blind / n : 1,
    warming_frac: n ? warming / n : 0,
    decisive_frac: n ? decisive / n : 0,
    strong_mood_cycles: strongMood,
    member_brier: memberBrier, base_brier: baseBrier, member_n: memberN,
    oos_edge: oosEdge,
    skill24h: skill,
  };
}

/** Pure: the charter's deterministic verdict rules. */
export function decideVerdict(ev) {
  if (ev.n < MIN_HISTORY) {
    return { verdict: 'HOLD', why: `Only ${ev.n} lab notes on record (need >= ${MIN_HISTORY}) — not enough history for any scientific verdict. I keep reading the crowd, skeptically.` };
  }
  if (ev.n >= APPLY_MIN_N && ev.oos_edge && ev.decisive_frac >= APPLY_DECISIVE_MIN) {
    return {
      verdict: 'APPLY_CANDIDATE',
      why: `Real out-of-sample edge (member Brier ${ev.member_brier.toFixed(5)} vs baseline ${ev.base_brier.toFixed(5)}, n=${ev.member_n}) and the mood actually speaks (${(ev.decisive_frac * 100).toFixed(1)}% of cycles decisive). I nominate the sentiment member for weight adoption — the champion/challenger gates still decide. Against my own skeptical standard, this one cleared the bar.`,
    };
  }
  if (ev.n >= APPLY_MIN_N && !ev.oos_edge && ev.decisive_frac < WITHDRAW_DECISIVE_MAX) {
    return { verdict: 'WITHDRAW', why: `No out-of-sample edge and the mood rarely speaks (decisive only ${(ev.decisive_frac * 100).toFixed(1)}% of cycles). A signal that rarely speaks and never beats the baseline is not a signal — I recommend weight 0 and the ledger records the refutation. In this lab, a negative result was always the likely outcome.` };
  }
  const bits = [];
  if (ev.n < APPLY_MIN_N) bits.push(`history still short (${ev.n}/${APPLY_MIN_N})`);
  if (!ev.oos_edge) bits.push(ev.member_n >= OOS_MIN_N ? 'no out-of-sample edge on the scoreboard' : `scoreboard still warming up (n=${ev.member_n}/${OOS_MIN_N})`);
  if (!(ev.decisive_frac >= APPLY_DECISIVE_MIN)) bits.push(`decisive reads ${(ev.decisive_frac * 100).toFixed(1)}% — below the ${(APPLY_DECISIVE_MIN * 100).toFixed(0)}% bar`);
  if (ev.blind_frac > 0.2) bits.push(`feed blind ${(ev.blind_frac * 100).toFixed(1)}% of cycles — I check the instruments before trusting the readings`);
  return { verdict: 'HOLD', why: `The case is not made in either direction: ${bits.join('; ')}. I keep reading the crowd and keep gathering evidence. In this lab, HOLD is the honest default — a noisy social signal stays here until the evidence genuinely moves it.` };
}

function seedHypotheses() {
  return [
    { id: 'SS1', claim: 'Reddit mood swings ahead of XRP 15-min windows tilt the subsequent direction.', prediction: 'decisive mood reads align with window direction more often than chance', test: '15-min directional skill vs 0.50 baseline', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'SS2', claim: 'The sentiment member beats the baseline forecast out-of-sample on Brier score.', prediction: 'member Brier < baseline Brier over n ≥ 200 scored forecasts', test: 'live scoreboard comparison', status: 'open', status_why: 'scoreboard warming up', updated_at: null },
    { id: 'SS3', claim: 'The mood actually expresses itself often enough to matter — not a once-a-month curiosity.', prediction: 'decisive_frac ≥ 0.40 over rolling history once n ≥ 100', test: 'decisive-read rate from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'SS4', claim: 'Reddit mood is not systematically gamed: decisive reads are not just brigaded threads.', prediction: 'decisive reads are not clustered in single-subreddit pile-ons', test: 'per-subreddit source breakdown of decisive reads from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
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
    set('SS2', ev.oos_edge ? 'supported' : 'refuted',
      `member ${ev.member_brier?.toFixed(5)} vs baseline ${ev.base_brier?.toFixed(5)}, n=${ev.member_n}`);
  }
  if (ev.skill24h) {
    set('SS1', ev.skill24h.beats_baseline ? 'supported' : 'refuted',
      `24h hit rate=${(ev.skill24h.hit_rate * 100).toFixed(1)}% vs 50% baseline, n=${ev.skill24h.n}`);
  }
  if (ev.n >= APPLY_MIN_N) {
    set('SS3', ev.decisive_frac >= APPLY_DECISIVE_MIN ? 'supported' : (ev.decisive_frac < WITHDRAW_DECISIVE_MAX ? 'refuted' : 'open'),
      `decisive_frac=${ev.decisive_frac.toFixed(3)} over n=${ev.n}`);
  }
  return hyps;
}

/** Pure: one honest line per discipline, rendered from the numbers. */
export function buildDisciplines(ev, verdict) {
  const pct = (x) => (x * 100).toFixed(1) + '%';
  return [
    { discipline: 'behavioral_finance', assessment: ev.decisive_frac >= 0.4 ? `The crowd is actually emoting: ${pct(ev.decisive_frac)} of cycles carry a decisive mood read, ${ev.strong_mood_cycles} strong-mood cycles on record. I note the direction — and I note that sentiment predicts attention more reliably than direction.` : `The crowd is mostly murmuring (${pct(ev.decisive_frac)} decisive). Excitement is not information: by the time Reddit is euphoric, the move has usually already happened.` },
    { discipline: 'social_data_science', assessment: `Coverage: two subreddits' newest posts per cycle, word counts against a pre-registered frozen list. The list cannot read sarcasm, cannot spot a bot, cannot tell 'great example of fraud' from 'great'. I report what it measures — title mood — and nothing more.` },
    { discipline: 'statistician', assessment: `decisive_frac=${pct(ev.decisive_frac)} over n=${ev.n}; ${ev.oos_edge ? `out-of-sample edge confirmed (Brier ${ev.member_brier.toFixed(5)} < ${ev.base_brier.toFixed(5)}, n=${ev.member_n})` : ev.member_n >= OOS_MIN_N ? 'no out-of-sample edge — the scoreboard overrules the rumor desk' : `scoreboard still warming up (n=${ev.member_n}/${OOS_MIN_N})`}. I am this lab's designated skeptic: one pre-registered specification, no peeking, no re-tuning. Wide error bars are sized, not hidden.` },
    { discipline: 'risk_manager', assessment: verdict === 'APPLY_CANDIDATE' ? 'False-discovery risk is priced: nomination only — the champion/challenger gates still decide, and the mood effect stays deliberately tiny, moving in small tested steps.' : verdict === 'WITHDRAW' ? 'A signal that rarely speaks and never beats the baseline is not a signal — the risk-managed move is to withdraw, not to keep a dead hypothesis on life support.' : 'When in doubt I vote HOLD: adopting noise corrupts every forecast it touches, and in the noisiest lab on the page, doubt is the default position.' },
    { discipline: 'data_engineer', assessment: ev.blind_frac > 0.2 ? `Instrument flag: Reddit blind ${pct(ev.blind_frac)} of cycles — a rate limit looks like a calm crowd unless you check liveness, and I check.` : `Pipeline healthy: Reddit reachable ${pct(1 - ev.blind_frac)} of cycles; lexicon frozen and versioned, never tuned on outcomes; same post set reproduces the same numbers.` },
    { discipline: 'trader', assessment: 'Social mood is the most crowded signal in crypto — everyone reads the same threads, so any edge is arbed out or was never there. The "XRP army" is a permanent feature of the sample, not information. That is why no APPLY verdict of mine ever skips out-of-sample proof.' },
    { discipline: 'intelligence_analyst', assessment: `Known: ${pct(ev.decisive_frac)} decisive mood reads over ${ev.n} cycles. Unknown: whether any read is real mood vs brigading; whether the crowd leads or lags. Confidence: ${verdict === 'HOLD' ? 'low — the honest answer in a noisy lab' : 'moderate — evidence-backed, still falsifiable'}.` },
    { discipline: 'research_scientist', assessment: 'Hypothesis ledger updated — statuses changed only where the evidence moved them; nothing was buried and nothing was accepted without a test.' },
    { discipline: 'principal_investigator', assessment: `I sign this verdict: ${verdict}. It is defensible from the record below, and I will reverse it the moment the evidence does.` },
  ];
}

function plainVerdict(v, ev) {
  if (v.verdict === 'APPLY_CANDIDATE') return `Sasha's verdict: against her own skeptical standard, the evidence supports giving social mood a trial in the forecast model. The sentiment member has beaten the baseline out-of-sample over ${ev.member_n} scored forecasts. Her nomination now goes to formal testing — strict statistical gates still have the final say.`;
  if (v.verdict === 'WITHDRAW') return `Sasha's verdict: the evidence says Reddit mood carries no usable signal. She recommends removing it from the model entirely — a negative result, published honestly, and in this lab the likely outcome all along.`;
  return `Sasha's verdict: hold and keep watching. The crowd's mood evidence so far is neither strong enough to apply nor weak enough to withdraw — and in the noisiest lab on the page, HOLD is the honest default.`;
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
    const lp = path.join(dataDir, 'sasha-log.jsonl');
    if (existsSync(lp)) notes = parseSashaLogLines(readFileSync(lp, 'utf8'));
  } catch { notes = []; }
  if (!notes.length) notes = (summary && summary.sentiment && Array.isArray(summary.sentiment.log)) ? summary.sentiment.log : [];
  const scoreboardSentiment = summary && summary.windows && summary.windows.all && summary.windows.all.sentiment
    ? normalizeSentimentScoreboard(summary.windows.all.sentiment) : null;

  let prev = null;
  const outPath = path.join(dataDir, 'sasha_supervisor.json');
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
  const evidence = computeEvidence(notes, scoreboardSentiment);
  const v = decideVerdict(evidence);
  const hypotheses = updateHypotheses(prev && prev.hypotheses, evidence, nowIso);
  const disciplines = buildDisciplines(evidence, v.verdict);

  const doc = {
    agent: 'sasha',
    title: 'Principal Investigator, Sentiment Lab',
    charter_version: CHARTER_VERSION,
    charter: 'SASHA_CHARTER.md',
    updated_at: nowIso,
    verdict: v.verdict,
    verdict_why: v.why,
    verdict_plain: plainVerdict(v, evidence),
    evidence,
    model_gates: 'APPLY_CANDIDATE nominates only. Adoption requires the runner\'s champion/challenger gates: held-out Brier improvement ≥ 2e-4, positive in both halves, family-wise α=0.05 with Bonferroni correction, ≥24h between adoptions. WITHDRAW recommends sentimentWeight 0. This file never changes a weight directly.',
    hypotheses,
    literature: literature.slice(-12),
    literature_new: fresh,
    literature_error: litError,
    disciplines_applied: disciplines,
  };

  writeFileSync(outPath, JSON.stringify(doc, null, 1) + '\n');
  console.log(JSON.stringify({ ts: nowIso, agent: 'sasha-supervisor', verdict: v.verdict, notes: evidence.n, new_papers: fresh.length }));
}

if (process.argv[1] && process.argv[1].endsWith('sasha-supervisor.js')) main();
