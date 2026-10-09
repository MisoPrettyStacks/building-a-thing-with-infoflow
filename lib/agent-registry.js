// Registry of the second-generation lab agents (Opal → Nia).
//
// Each entry wires one PI into the runner's per-cycle loop: her signal fetcher,
// her note builder, her log/supervisor filenames, and her scoreboard keys.
// The runner iterates AGENT_DEFS so all ten agents get identical treatment:
// best-effort signal fetch (never crashes the cycle), permanent notebook append,
// summary.json embed, and a standing verdict read that gates her lab's parameter.
import { fetchSignal as fetchOpalSignal } from './signal-opal.js';
import { fetchSignal as fetchVioletSignal } from './signal-violet.js';
import { fetchSignal as fetchDaisySignal } from './signal-daisy.js';
import { fetchSignal as fetchNoraSignal } from './signal-nora.js';
import { fetchSignal as fetchSophieSignal } from './signal-sophie.js';
import { fetchSignal as fetchCoraSignal } from './signal-cora.js';
import { fetchSignal as fetchCherrySignal } from './signal-cherry.js';
import { fetchSignal as fetchSageSignal } from './signal-sage.js';
import { fetchSignal as fetchSashaSignal } from './signal-sasha.js';
import { fetchSignal as fetchNiaSignal } from './signal-nia.js';
import { fetchSignal as fetchOpheliaSignal } from './signal-ophelia.js';
import { fetchSignal as fetchCamilleSignal } from './signal-camille.js';
import { fetchSignal as fetchMollySignal } from './signal-molly.js';
import { fetchSignal as fetchReahSignal } from './signal-reah.js';
import { fetchSignal as fetchClaraSignal } from './signal-clara.js';
import { fetchSignal as fetchLenaSignal } from './signal-lena.js';
import { fetchSignal as fetchMisoSignal } from './signal-miso.js';

import { buildOpalNote, OPAL_PAGE_WINDOW, parseOpalLogLines, formatOpalLogLine } from './opalnote.js';
import { buildVioletNote, VIOLET_PAGE_WINDOW, parseVioletLogLines, formatVioletLogLine } from './violetnote.js';
import { buildDaisyNote, DAISY_PAGE_WINDOW, parseDaisyLogLines, formatDaisyLogLine } from './daisynote.js';
import { buildNoraNote, NORA_PAGE_WINDOW, parseNoraLogLines, formatNoraLogLine } from './noranote.js';
import { buildSophieNote, SOPHIE_PAGE_WINDOW, parseSophieLogLines, formatSophieLogLine } from './sophienote.js';
import { buildCoraNote, CORA_PAGE_WINDOW, parseCoraLogLines, formatCoraLogLine } from './coranote.js';
import { buildCherryNote, CHERRY_PAGE_WINDOW, parseCherryLogLines, formatCherryLogLine } from './cherrynote.js';
import { buildSageNote, SAGE_PAGE_WINDOW, parseSageLogLines, formatSageLogLine } from './sagenote.js';
import { buildSashaNote, SASHA_PAGE_WINDOW, parseSashaLogLines, formatSashaLogLine } from './sashanote.js';
import { buildNiaNote, NIA_PAGE_WINDOW, parseNiaLogLines, formatNiaLogLine } from './nianote.js';
import { buildOpheliaNote, OPHELIA_PAGE_WINDOW, parseOpheliaLogLines, formatOpheliaLogLine } from './ophelianote.js';
import { buildCamilleNote, CAMILLE_PAGE_WINDOW, parseCamilleLogLines, formatCamilleLogLine } from './camillenote.js';
import { buildMollyNote, MOLLY_PAGE_WINDOW, parseMollyLogLines, formatMollyLogLine } from './mollynote.js';
import { buildReahNote, REAH_PAGE_WINDOW, parseReahLogLines, formatReahLogLine } from './reahnote.js';
import { buildClaraNote, CLARA_PAGE_WINDOW, parseClaraLogLines, formatClaraLogLine } from './claranote.js';
import { buildLenaNote, LENA_PAGE_WINDOW, parseLenaLogLines, formatLenaLogLine } from './lenanote.js';
import { buildMisoNote, MISO_PAGE_WINDOW, parseMisoLogLines, formatMisoLogLine } from './misonote.js';

export const AGENT_DEFS = [
  {
    name: 'opal', Name: 'Opal', lab: 'Order-Book Depth Lab', color: '#14b8a6',
    key: 'orderbook', weightKey: 'orderbookWeight', brierKey: 'brierOrderbook',
    logFile: 'opal-log.jsonl', supFile: 'opal_supervisor.json',
    fetchSignal: fetchOpalSignal, buildNote: buildOpalNote,
    pageWindow: OPAL_PAGE_WINDOW, parseLogLines: parseOpalLogLines, formatLogLine: formatOpalLogLine,
    dampener: false,
  },
  {
    name: 'violet', Name: 'Violet', lab: 'Volatility Regime Lab', color: '#a855f7',
    key: 'volatility', weightKey: 'volDamp', brierKey: 'brierVol',
    logFile: 'violet-log.jsonl', supFile: 'violet_supervisor.json',
    fetchSignal: fetchVioletSignal, buildNote: buildVioletNote,
    pageWindow: VIOLET_PAGE_WINDOW, parseLogLines: parseVioletLogLines, formatLogLine: formatVioletLogLine,
    dampener: true, // Violet gates a confidence dampener, not a directional bias
  },
  {
    name: 'daisy', Name: 'Daisy', lab: 'Derivatives Lab', color: '#e8edf3',
    key: 'deriv', weightKey: 'derivWeight', brierKey: 'brierDeriv',
    logFile: 'daisy-log.jsonl', supFile: 'daisy_supervisor.json',
    fetchSignal: fetchDaisySignal, buildNote: buildDaisyNote,
    pageWindow: DAISY_PAGE_WINDOW, parseLogLines: parseDaisyLogLines, formatLogLine: formatDaisyLogLine,
    dampener: false,
  },
  {
    name: 'nora', Name: 'Nora', lab: 'Network Health Lab', color: '#10b981',
    key: 'network', weightKey: 'networkWeight', brierKey: 'brierNetwork',
    logFile: 'nora-log.jsonl', supFile: 'nora_supervisor.json',
    fetchSignal: fetchNoraSignal, buildNote: buildNoraNote,
    pageWindow: NORA_PAGE_WINDOW, parseLogLines: parseNoraLogLines, formatLogLine: formatNoraLogLine,
    dampener: false,
  },
  {
    name: 'sophie', Name: 'Sophie', lab: 'Session Seasonality Lab', color: '#fb7185',
    key: 'session', weightKey: 'sessionWeight', brierKey: 'brierSession',
    logFile: 'sophie-log.jsonl', supFile: 'sophie_supervisor.json',
    fetchSignal: fetchSophieSignal, buildNote: buildSophieNote,
    pageWindow: SOPHIE_PAGE_WINDOW, parseLogLines: parseSophieLogLines, formatLogLine: formatSophieLogLine,
    dampener: false,
  },
  {
    name: 'cora', Name: 'Cora', lab: 'Cross-Asset Momentum Lab', color: '#38bdf8',
    key: 'xasset', weightKey: 'xassetWeight', brierKey: 'brierXasset',
    logFile: 'cora-log.jsonl', supFile: 'cora_supervisor.json',
    fetchSignal: fetchCoraSignal, buildNote: buildCoraNote,
    pageWindow: CORA_PAGE_WINDOW, parseLogLines: parseCoraLogLines, formatLogLine: formatCoraLogLine,
    dampener: false,
  },
  {
    name: 'cherry', Name: 'Cherry', lab: 'Correlation Regime Lab', color: '#dc2645',
    key: 'corr', weightKey: 'corrWeight', brierKey: 'brierCorr',
    logFile: 'cherry-log.jsonl', supFile: 'cherry_supervisor.json',
    fetchSignal: fetchCherrySignal, buildNote: buildCherryNote,
    pageWindow: CHERRY_PAGE_WINDOW, parseLogLines: parseCherryLogLines, formatLogLine: formatCherryLogLine,
    dampener: false,
  },
  {
    name: 'sage', Name: 'Sage', lab: 'Stablecoin Flow Lab', color: '#8aa888',
    key: 'stable', weightKey: 'stableWeight', brierKey: 'brierStable',
    logFile: 'sage-log.jsonl', supFile: 'sage_supervisor.json',
    fetchSignal: fetchSageSignal, buildNote: buildSageNote,
    pageWindow: SAGE_PAGE_WINDOW, parseLogLines: parseSageLogLines, formatLogLine: formatSageLogLine,
    dampener: false,
  },
  {
    name: 'sasha', Name: 'Sasha', lab: 'Sentiment Lab', color: '#b49ae0',
    key: 'sentiment', weightKey: 'sentimentWeight', brierKey: 'brierSentiment',
    logFile: 'sasha-log.jsonl', supFile: 'sasha_supervisor.json',
    fetchSignal: fetchSashaSignal, buildNote: buildSashaNote,
    pageWindow: SASHA_PAGE_WINDOW, parseLogLines: parseSashaLogLines, formatLogLine: formatSashaLogLine,
    dampener: false,
  },
  {
    name: 'nia', Name: 'Nia', lab: 'News Catalyst Lab', color: '#fb923c',
    key: 'news', weightKey: 'newsWeight', brierKey: 'brierNews',
    logFile: 'nia-log.jsonl', supFile: 'nia_supervisor.json',
    fetchSignal: fetchNiaSignal, buildNote: buildNiaNote,
    pageWindow: NIA_PAGE_WINDOW, parseLogLines: parseNiaLogLines, formatLogLine: formatNiaLogLine,
    dampener: false,
  },
  {
    name: 'ophelia', Name: 'Ophelia', lab: 'On-Chain Flows Lab', color: '#8b5a2b',
    key: 'flowhealth', weightKey: 'flowHealthWeight', brierKey: 'brierFlowHealth',
    logFile: 'ophelia-log.jsonl', supFile: 'ophelia_supervisor.json',
    fetchSignal: fetchOpheliaSignal, buildNote: buildOpheliaNote,
    pageWindow: OPHELIA_PAGE_WINDOW, parseLogLines: parseOpheliaLogLines, formatLogLine: formatOpheliaLogLine,
    dampener: false,
  },
  {
    name: 'camille', Name: 'Camille', lab: 'Calendar Effect Lab', color: '#1e3a5f',
    key: 'calendar', weightKey: 'escrowWeight', brierKey: 'brierEscrow',
    logFile: 'camille-log.jsonl', supFile: 'camille_supervisor.json',
    fetchSignal: fetchCamilleSignal, buildNote: buildCamilleNote,
    pageWindow: CAMILLE_PAGE_WINDOW, parseLogLines: parseCamilleLogLines, formatLogLine: formatCamilleLogLine,
    dampener: false, scoreboardKey: 'escrow',
  },
  {
    name: 'molly', Name: 'Molly', lab: 'Macro Events Lab', color: '#7b2d43',
    key: 'macroev', weightKey: 'macroDamp', brierKey: 'brierMacro',
    logFile: 'molly-log.jsonl', supFile: 'molly_supervisor.json',
    fetchSignal: fetchMollySignal, buildNote: buildMollyNote,
    pageWindow: MOLLY_PAGE_WINDOW, parseLogLines: parseMollyLogLines, formatLogLine: formatMollyLogLine,
    dampener: true, scoreboardKey: 'macro',
  },
  {
    name: 'reah', Name: 'Reah', lab: 'Mean Reversion Lab', color: '#f59e0b',
    key: 'reversion', weightKey: 'reversionWeight', brierKey: 'brierReversion',
    logFile: 'reah-log.jsonl', supFile: 'reah_supervisor.json',
    fetchSignal: fetchReahSignal, buildNote: buildReahNote,
    pageWindow: REAH_PAGE_WINDOW, parseLogLines: parseReahLogLines, formatLogLine: formatReahLogLine,
    dampener: false,
  },
  {
    name: 'clara', Name: 'Clara', lab: 'Quarter-Hour Boundary Lab', color: '#818cf8',
    key: 'boundary', weightKey: 'boundaryWeight', brierKey: 'brierBoundary',
    logFile: 'clara-log.jsonl', supFile: 'clara_supervisor.json',
    fetchSignal: fetchClaraSignal, buildNote: buildClaraNote,
    pageWindow: CLARA_PAGE_WINDOW, parseLogLines: parseClaraLogLines, formatLogLine: formatClaraLogLine,
    dampener: false,
  },
  {
    name: 'lena', Name: 'Lena', lab: 'Venue Lead-Lag Lab', color: '#e879f9',
    key: 'leadlag', weightKey: 'leadlagWeight', brierKey: 'brierLeadlag',
    logFile: 'lena-log.jsonl', supFile: 'lena_supervisor.json',
    fetchSignal: fetchLenaSignal, buildNote: buildLenaNote,
    pageWindow: LENA_PAGE_WINDOW, parseLogLines: parseLenaLogLines, formatLogLine: formatLenaLogLine,
    dampener: false,
  },
  {
    name: 'miso', Name: 'Miso', lab: "Miso's Guesses", color: '#4cc9f0',
    key: 'guesses', weightKey: 'misoWeight', brierKey: 'brierMiso',
    logFile: 'miso-log.jsonl', supFile: 'miso_supervisor.json',
    fetchSignal: fetchMisoSignal, buildNote: buildMisoNote,
    pageWindow: MISO_PAGE_WINDOW, parseLogLines: parseMisoLogLines, formatLogLine: formatMisoLogLine,
    dampener: false,
  },
];

/** Normalize a scoreboard slice for note builders and supervisors. */
export function normalizeScoreboard(sb, brierKey) {
  if (!sb) return null;
  return {
    n: sb.n || 0,
    brierMember: sb[brierKey] ?? null,
    brierBase: sb.brierBase ?? null,
    skill24h: sb.skill24h || null,
    // windowed evidence passes through for members whose edge only exists
    // inside a window (Camille's tilt window, Molly's event windows)
    tiltWindow: sb.tiltWindow || null,
    eventWindow: sb.eventWindow || null,
    // Opal's multi-horizon decay block (5m vs 15m directional hit rates)
    horizons: sb.horizons || null,
  };
}
