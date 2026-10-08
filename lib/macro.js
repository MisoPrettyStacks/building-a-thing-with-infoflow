// Macro event calendar: volatility-regime flag around scheduled US macro releases.
// Pure functions, no I/O (isomorphic: runs in Node and in the browser).
//
// Rationale: FRED-style data *levels* are monthly/quarterly step functions (useless at
// 15-minute horizons), but the *release events* are scheduled, public, and reliably spike
// volatility. The surprise direction is a coin flip, so the model responds with humility:
// inside an event window it shrinks P(up) toward 0.5 and widens the forecast cone.
// This is a *confidence* adjustment, never a directional bet.

export const MACRO_T1_WINDOW_MIN = 60; // tier-1 event window: +/- minutes
export const MACRO_T2_WINDOW_MIN = 30; // tier-2 event window: +/- minutes
export const MACRO_T1_SHRINK = 0.85;  // tier-1: multiply P(up)-0.5 deviation by this
export const MACRO_T2_SHRINK = 0.92;  // tier-2: weaker version of the same

/** US Eastern offset in minutes for a calendar date (DST: 2nd Sun Mar - 1st Sun Nov). */
export function etOffsetMinutes(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // 2nd Sunday of March
  const mar1 = new Date(Date.UTC(y, 2, 1));
  const dstStart = 1 + ((7 - mar1.getUTCDay()) % 7) + 7;
  // 1st Sunday of November
  const nov1 = new Date(Date.UTC(y, 10, 1));
  const dstEnd = 1 + ((7 - nov1.getUTCDay()) % 7);
  const day = dt.getUTCDate(), mon = dt.getUTCMonth() + 1;
  const isDST = mon > 3 && mon < 11
    || (mon === 3 && day >= dstStart)
    || (mon === 11 && day < dstEnd);
  return isDST ? -240 : -300; // EDT = UTC-4, EST = UTC-5
}

/** Convert {date, time_et} to a UTC epoch-seconds timestamp. */
export function eventUtcSec(ev) {
  const [hh, mm] = ev.time_et.split(':').map(Number);
  const [y, mo, d] = ev.date.split('-').map(Number);
  return Date.UTC(y, mo - 1, d, hh, mm) / 1000 - etOffsetMinutes(ev.date) * 60;
}

/** Parse the raw JSON calendar into a sorted array with UTC timestamps. */
export function parseCalendar(raw) {
  const events = (raw.events || raw).map((e) => ({ ...e, t: eventUtcSec(e) }));
  events.sort((a, b) => a.t - b.t);
  return events;
}

const windowFor = (tier) => (tier === 1 ? MACRO_T1_WINDOW_MIN : MACRO_T2_WINDOW_MIN);
const shrinkFor = (tier) => (tier === 1 ? MACRO_T1_SHRINK : MACRO_T2_SHRINK);

/**
 * Proximity of tSec to the nearest scheduled release.
 * Returns { active, tier, shrink, minutesToEvent, event }.
 * - active: inside a +/- window (tier-1: 60min, tier-2: 30min)
 * - shrink: the deviation multiplier that applies inside the window (1.0 outside)
 * - minutesToEvent: signed minutes to the nearest release (negative = already released)
 * Tier-1 takes precedence when both tiers are in-window.
 */
export function macroProximity(tSec, events) {
  let best = null;
  for (const e of events) {
    const dtMin = (e.t - tSec) / 60;
    const w = windowFor(e.tier);
    const inWin = Math.abs(dtMin) <= w;
    const cand = { active: inWin, tier: e.tier, shrink: inWin ? shrinkFor(e.tier) : 1.0, minutesToEvent: dtMin, event: e.event, date: e.date, time_et: e.time_et };
    if (!best) { best = cand; continue; }
    // prefer: in-window over out-of-window, tier-1 over tier-2, then nearest
    const rank = (c) => (c.active ? 0 : 2) + (c.tier === 1 ? 0 : 1);
    if (rank(cand) < rank(best) || (rank(cand) === rank(best) && Math.abs(dtMin) < Math.abs(best.minutesToEvent))) best = cand;
    if (e.t - tSec > 120 * 60 && best.active) break; // past the relevant horizon
  }
  return best || { active: false, tier: 0, shrink: 1.0, minutesToEvent: Infinity, event: null };
}

/** Next n upcoming releases at/after tSec. */
export function nextEvents(tSec, events, n = 3) {
  return events.filter((e) => e.t >= tSec - 60).slice(0, n).map((e) => ({
    event: e.event, tier: e.tier, date: e.date, time_et: e.time_et, t: e.t,
    minutes_until: Math.round((e.t - tSec) / 60),
  }));
}

/** Cone-band widening multiplier for an active window (inverse of the shrink). */
export function coneWiden(tier) {
  return tier === 1 ? 1 / MACRO_T1_SHRINK : tier === 2 ? 1 / MACRO_T2_SHRINK : 1.0;
}
