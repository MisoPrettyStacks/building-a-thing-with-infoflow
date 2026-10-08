// Sophie's supervisor cycle — implements SOPHIE_CHARTER.md (v1.0.0).
//
// Once per cycle (weekly via workflow) Sophie:
//   1. scans the literature (internet: arXiv) for relevant science,
//   2. maintains her hypothesis ledger (statuses change only on evidence),
//   3. summarizes the experimental evidence from the lab notebook,
//   4. renders one honest line per discipline from the actual numbers,
//   5. issues her standing scientific verdict: HOLD / APPLY_CANDIDATE / WITHDRAW.
//
// The verdict is deterministic given its inputs. It never changes a forecast
// weight directly: APPLY_CANDIDATE only *nominates* the session-seasonality
// member for the runner's champion/challenger gates; WITHDRAW recommends
// weight 0. Internet text can propose hypotheses — it can never move weights.
//
// Usage: node scripts/sophie-supervisor.js --data ./data-branch
// Writes: <data>/sophie_supervisor.json

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseSophieLogLines, isDecisiveSophie } from '../lib/sophienote.js';

export const CHARTER_VERSION = '1.0.0';
export const HISTORY_CAP = 200;    // notes examined per cycle
export const MIN_HISTORY = 50;     // below this: HOLD, always
export const APPLY_MIN_N = 100;
export const APPLY_DECISIVE_MIN = 0.40;
export const WITHDRAW_DECISIVE_MAX = 0.15;
export const OOS_MIN_N = 200;      // scored forecasts needed for an OOS verdict
export const SKILL_MIN_N = 30;     // scored 24h reads needed for a skill read

const QUERIES = [
  'all:intraday+AND+all:seasonality+AND+all:cryptocurrency',
  'all:time.of.day+AND+all:effect+AND+all:bitcoin',
  'all:crypto+AND+all:trading+AND+all:session+AND+all:returns',
  'all:intraday+AND+all:return+AND+all:predictability',
  'all:overnight+AND+all:return+AND+all:cryptocurrency',
  'all:market+AND+all:microstructure+AND+all:intraday+AND+all:crypto',
];

async function arxivSearch(q) {
  const url = 'https://export.arxiv.org/api/query?search_query=' + encodeURIComponent(q) +
    '&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending';
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'building-a-thing-with-agents/sophie-supervisor' } });
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
export function computeEvidence(notes, scoreboardSession) {
  const hist = (Array.isArray(notes) ? notes : []).slice(-HISTORY_CAP);
  const n = hist.length;
  let decisive = 0, blind = 0, warming = 0, decisiveCycles = 0;
  for (const note of hist) {
    const c = note && note.computed;
    if (!c) { blind++; continue; }
    if (c.degraded) { blind++; continue; }
    if (c.warming_up) { warming++; continue; }
    if (c.decisive) { decisive++; decisiveCycles++; }
  }
  const sb = scoreboardSession || {};
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
    decisive_cycles: decisiveCycles,
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
      why: `Real out-of-sample edge (member Brier ${ev.member_brier.toFixed(5)} vs baseline ${ev.base_brier.toFixed(5)}, n=${ev.member_n}) and the seasonal rhythm actually speaks (${(ev.decisive_frac * 100).toFixed(1)}% of cycles decisive). I nominate the session-seasonality member for weight adoption — the champion/challenger gates still decide.`,
    };
  }
  if (ev.n >= APPLY_MIN_N && !ev.oos_edge && ev.decisive_frac < WITHDRAW_DECISIVE_MAX) {
    return { verdict: 'WITHDRAW', why: `No out-of-sample edge and the rhythm rarely speaks (decisive only ${(ev.decisive_frac * 100).toFixed(1)}% of cycles). A rhythm that rarely speaks and never beats the baseline is not a rhythm — I recommend weight 0 and the ledger records the refutation.` };
  }
  const bits = [];
  if (ev.n < APPLY_MIN_N) bits.push(`history still short (${ev.n}/${APPLY_MIN_N})`);
  if (!ev.oos_edge) bits.push(ev.member_n >= OOS_MIN_N ? 'no out-of-sample edge on the scoreboard' : `scoreboard still warming up (n=${ev.member_n}/${OOS_MIN_N})`);
  if (!(ev.decisive_frac >= APPLY_DECISIVE_MIN)) bits.push(`decisive reads ${(ev.decisive_frac * 100).toFixed(1)}% — below the ${(APPLY_DECISIVE_MIN * 100).toFixed(0)}% bar`);
  if (ev.blind_frac > 0.2) bits.push(`data blind ${(ev.blind_frac * 100).toFixed(1)}% of cycles — I check the instruments before trusting the readings`);
  return { verdict: 'HOLD', why: `The case is not made in either direction: ${bits.join('; ')}. I keep the watch open and keep gathering evidence.` };
}

function seedHypotheses() {
  return [
    { id: 'SO1', claim: 'Specific UTC hours carry a persistent mean-return tilt in XRP 5-minute candles — the market has a daily heartbeat.', prediction: 'hourly mean log-returns keep their sign across rolling trailing windows', test: 'sign stability of hourly means, out-of-sample windows only', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'SO2', claim: 'The session-seasonality member beats the baseline forecast out-of-sample on Brier score.', prediction: 'member Brier < baseline Brier over n ≥ 200 scored forecasts', test: 'live scoreboard comparison', status: 'open', status_why: 'scoreboard warming up', updated_at: null },
    { id: 'SO3', claim: 'The tilt concentrates in real session hours (Asia/Europe/US) and fades in off-hours — not 24 equal hours.', prediction: 'decisive reads cluster in session hours vs quiet hours', test: 'decisive rate by hour from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
    { id: 'SO4', claim: 'The seasonal rhythm expresses itself often enough to matter — not a once-a-quarter curiosity.', prediction: 'decisive_frac ≥ 0.40 over rolling history once n ≥ 100', test: 'decisive-read rate from lab notes', status: 'open', status_why: 'awaiting history', updated_at: null },
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
    set('SO2', ev.oos_edge ? 'supported' : 'refuted',
      `member ${ev.member_brier?.toFixed(5)} vs baseline ${ev.base_brier?.toFixed(5)}, n=${ev.member_n}`);
  }
  if (ev.skill24h) {
    set('SO1', ev.skill24h.beats_baseline ? 'supported' : 'refuted',
      `24h hit rate=${(ev.skill24h.hit_rate * 100).toFixed(1)}% vs 50% baseline, n=${ev.skill24h.n}`);
  }
  if (ev.n >= APPLY_MIN_N) {
    set('SO4', ev.decisive_frac >= APPLY_DECISIVE_MIN ? 'supported' : (ev.decisive_frac < WITHDRAW_DECISIVE_MAX ? 'refuted' : 'open'),
      `decisive_frac=${ev.decisive_frac.toFixed(3)} over n=${ev.n}`);
  }
  return hyps;
}

/** Pure: one honest line per discipline, rendered from the numbers. */
export function buildDisciplines(ev, verdict) {
  const pct = (x) => (x * 100).toFixed(1) + '%';
  return [
    { discipline: 'market_microstructure', assessment: ev.decisive_frac >= 0.4 ? `The rhythm is talking: ${pct(ev.decisive_frac)} of cycles carry a decisive seasonal read, with ${ev.decisive_cycles} expressive cycles on record. Liquidity arrives in session waves — Asia, Europe, US — and the tilt follows the participants.` : `The clock is mostly quiet (${pct(ev.decisive_frac)} decisive). I do not mistake a few lucky hours for a market rhythm, and I do not narrate silence.` },
    { discipline: 'behavioral_finance', assessment: `Intraday rhythms are partly psychology — traders anchor on session opens, square up at closes, react to the news their own timezone is awake for. But a behavioral story is never evidence on its own: the pattern has to survive the scoreboard.` },
    { discipline: 'statistician', assessment: `decisive_frac=${pct(ev.decisive_frac)} over n=${ev.n}; ${ev.oos_edge ? `out-of-sample edge confirmed (Brier ${ev.member_brier.toFixed(5)} < ${ev.base_brier.toFixed(5)}, n=${ev.member_n})` : ev.member_n >= OOS_MIN_N ? 'no out-of-sample edge — the scoreboard overrules the clock bench' : `scoreboard still warming up (n=${ev.member_n}/${OOS_MIN_N})`}. Twenty-four hours are twenty-four chances to fool yourself — any hour-by-hour pattern gets multiple-comparison scrutiny before I believe it, and seasonal tilts are tiny by nature.` },
    { discipline: 'data_engineer', assessment: ev.blind_frac > 0.2 ? `Instrument flag: bar history unreadable ${pct(ev.blind_frac)} of cycles — a gap in candles is not a quiet market, and I check which is which.` : `Pipeline healthy: closed 5-minute bars available ${pct(1 - ev.blind_frac)} of cycles; seven-day history gate enforced before any read; same bars reproduce the same numbers.` },
    { discipline: 'trader', assessment: 'A time-of-day pattern is not a trade signal — even a real seasonal tilt is small, noisy, and may already be priced in by the very participants who make it. That is why no APPLY verdict of mine ever skips out-of-sample proof.' },
    { discipline: 'intelligence_analyst', assessment: `Known: ${pct(ev.decisive_frac)} decisive reads over ${ev.n} cycles. Unknown: whether the rhythm drifts as volatility regimes change. Confidence: ${verdict === 'HOLD' ? 'low — the honest answer' : 'moderate — evidence-backed, still falsifiable'}.` },
    { discipline: 'research_scientist', assessment: 'Hypothesis ledger updated — statuses changed only where the evidence moved them; nothing was buried and nothing was accepted without a test.' },
    { discipline: 'principal_investigator', assessment: `I sign this verdict: ${verdict}. It is defensible from the record below, and I will reverse it the moment the evidence does.` },
  ];
}

function plainVerdict(v, ev) {
  if (v.verdict === 'APPLY_CANDIDATE') return `Sophie's verdict: the evidence supports giving session seasonality a trial in the forecast model. The clock's rhythms have beaten the baseline out-of-sample over ${ev.member_n} scored forecasts. Her nomination now goes to formal testing — strict statistical gates still have the final say.`;
  if (v.verdict === 'WITHDRAW') return `Sophie's verdict: the evidence says session seasonality carries no usable signal. She recommends removing it from the model entirely — a negative result, published honestly.`;
  return `Sophie's verdict: hold and keep watching. The clock's evidence so far is neither strong enough to apply nor weak enough to withdraw — the watch stays open.`;
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
    const lp = path.join(dataDir, 'sophie-log.jsonl');
    if (existsSync(lp)) notes = parseSophieLogLines(readFileSync(lp, 'utf8'));
  } catch { notes = []; }
  if (!notes.length) notes = (summary && summary.sophie && Array.isArray(summary.sophie.log)) ? summary.sophie.log : [];
  const scoreboardSession = summary && summary.windows && summary.windows.all && summary.windows.all.session
    ? {
        n: summary.windows.all.session.n,
        brierMember: summary.windows.all.session.brierSession,
        brierBase: summary.windows.all.session.brierBase,
        skill24h: summary.windows.all.session.skill24h,
      }
    : null;

  let prev = null;
  const outPath = path.join(dataDir, 'sophie_supervisor.json');
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
  const evidence = computeEvidence(notes, scoreboardSession);
  const v = decideVerdict(evidence);
  const hypotheses = updateHypotheses(prev && prev.hypotheses, evidence, nowIso);
  const disciplines = buildDisciplines(evidence, v.verdict);

  const doc = {
    agent: 'sophie',
    title: 'Principal Investigator, Session Seasonality Lab',
    charter_version: CHARTER_VERSION,
    charter: 'SOPHIE_CHARTER.md',
    updated_at: nowIso,
    verdict: v.verdict,
    verdict_why: v.why,
    verdict_plain: plainVerdict(v, evidence),
    evidence,
    model_gates: 'APPLY_CANDIDATE nominates only. Adoption requires the runner\'s champion/challenger gates: held-out Brier improvement ≥ 2e-4, positive in both halves, family-wise α=0.05 with Bonferroni correction, ≥24h between adoptions. WITHDRAW recommends sessionWeight 0. This file never changes a weight directly.',
    hypotheses,
    literature: literature.slice(-12),
    literature_new: fresh,
    literature_error: litError,
    disciplines_applied: disciplines,
  };

  writeFileSync(outPath, JSON.stringify(doc, null, 1) + '\n');
  console.log(JSON.stringify({ ts: nowIso, agent: 'sophie-supervisor', verdict: v.verdict, notes: evidence.n, new_papers: fresh.length }));
}

if (process.argv[1] && process.argv[1].endsWith('sophie-supervisor.js')) main();
