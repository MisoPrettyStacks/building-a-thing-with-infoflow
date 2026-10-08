// Camille's calendar-effect signal — reports the live state of the legacy
// escrow tilt (lib/calendar.js). The tilt is deterministic: it needs no
// feed, so there is nothing to warm up and nothing to go stale. The only
// failure mode is a broken clock or an unexpected throw.
//
// Reads:
//   tilt         bearish tilt magnitude (subtracted from P(up)); 0 outside
//                the 1st-7th tilt window
//   daysSince    whole days since the 1st of the month (UTC); 0 = the 1st
//   relock       fraction of the 1B XRP re-locked; the historical average
//                when the actual figure is unknown
//   bias         always 0 — Camille reports the member's state; the tilt
//                itself lives in the engine and is gated by escrowWeight
//
// A "decisive" read is tilt > 0: the month is inside the 1st-7th window.
// NEVER throws: on any failure it returns a degraded placeholder so the
// runner keeps going.

import { escrowTilt, daysSinceEscrow, ESCROW_HISTORICAL_RELOCK } from '../lib/calendar.js';

function degraded() {
  return { bias: 0, degraded: true, warmingUp: false };
}

export async function fetchSignal({ t, bars, btcBars, dir, getJson, xrpl }) {
  try {
    if (!Number.isFinite(t) || t <= 0) return degraded(); // no honest clock, no read
    const relock = ESCROW_HISTORICAL_RELOCK;
    const daysSince = daysSinceEscrow(t);
    const tilt = escrowTilt(t, relock);
    if (!Number.isFinite(daysSince) || !Number.isFinite(tilt)) return degraded();
    return {
      bias: 0,
      degraded: false,
      warmingUp: false,
      tilt,
      daysSince,
      days_since_escrow: daysSince, // legacy key: renderCalendar() reads summary.calendar.days_since_escrow
      relock,
      decisive: tilt > 0,
    };
  } catch {
    return degraded();
  }
}
