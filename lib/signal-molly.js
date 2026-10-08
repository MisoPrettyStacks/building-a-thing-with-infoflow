// Molly's macro-events signal — one per-cycle read of the live
// scheduled US macro release calendar. Best-effort: NEVER throws; on any
// failure it returns a degraded placeholder so the runner keeps going.
//
// Reads:
//   active        inside an event window (+/-60 min tier-1, +/-30 min tier-2)
//   tier          1 (FOMC, CPI, payrolls) or 2 (PPI, retail sales, ISM); 0 outside
//   event/date/time_et/minutesToEvent  the nearest release
//   nextRelease/nextTier  the next upcoming release and its tier
//   windowMinutes the window width for the active tier (0 outside)
//   lastRetAbs    |log return| of the latest 15-min bar (for the lab's vol study)
//   bias          ALWAYS 0 — Molly never predicts surprise direction, only dampens
//
// The calendar is hardcoded from official sources; there is no feed to break.
// A "useful" cycle is one inside an event window; everything else is quiet.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCalendar, macroProximity, nextEvents,
  MACRO_T1_WINDOW_MIN, MACRO_T2_WINDOW_MIN,
} from './macro.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAL_PATH = join(REPO_ROOT, 'data', 'macro-calendar.json');

let calCache = null;
function loadCalendar() {
  if (calCache) return calCache;
  calCache = parseCalendar(JSON.parse(readFileSync(CAL_PATH, 'utf8')));
  return calCache;
}

function degraded() {
  return { bias: 0, degraded: true, warmingUp: false };
}

/** |log return| of the latest 15-min bar — Molly's raw material for M1. */
function lastRetAbs(bars) {
  try {
    if (!Array.isArray(bars) || bars.length < 2) return null;
    const closes = bars.map((b) => (b && (b.c ?? b.close ?? b[4]))).filter((x) => Number.isFinite(x) && x > 0);
    if (closes.length < 2) return null;
    const r = Math.log(closes[closes.length - 1] / closes[closes.length - 2]);
    return Number.isFinite(r) ? Math.abs(r) : null;
  } catch { return null; }
}

export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl }) {
  try {
    const cal = loadCalendar();
    if (!Array.isArray(cal) || !cal.length) return degraded();
    const tSec = typeof t === 'number' && isFinite(t)
      ? (t > 1e12 ? Math.floor(t / 1000) : Math.floor(t))
      : Math.floor(Date.now() / 1000);
    const prox = macroProximity(tSec, cal);
    const upcoming = nextEvents(tSec, cal, 1);
    const next = upcoming.length ? upcoming[0] : null;
    return {
      bias: 0, // humility doctrine: direction is a coin flip, never predicted
      degraded: false,
      warmingUp: false,
      active: !!prox.active,
      tier: prox.tier || 0,
      event: prox.event || null,
      date: prox.date || null,
      time_et: prox.time_et || null,
      minutesToEvent: Number.isFinite(prox.minutesToEvent) ? prox.minutesToEvent : null,
      shrink: prox.shrink || 1.0,
      windowMinutes: prox.active ? (prox.tier === 1 ? MACRO_T1_WINDOW_MIN : MACRO_T2_WINDOW_MIN) : 0,
      nextRelease: next,
      nextTier: next ? next.tier : 0,
      calendarEvents: cal.length,
      lastRetAbs: lastRetAbs(bars),
      computedAt: new Date().toISOString(),
    };
  } catch {
    return degraded();
  }
}
