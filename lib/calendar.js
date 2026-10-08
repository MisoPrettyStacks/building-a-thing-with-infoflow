// Calendar effects for the XRP model. Pure functions, no I/O.
//
// Ripple releases 1B XRP from escrow on the 1st of each month and re-locks
// 60-90% of it back within days; net new supply is ~100-300M. The release is
// fully predictable, so the price impact is small (historical 7-day swings
// roughly -3.1% to +1.7%), but the re-lock ratio is genuine information:
// a lower re-lock leaves more XRP out, a higher re-lock less.
// We model it as a tiny bearish tilt on P(up): strongest on the 1st, decaying
// linearly to zero by the 7th, scaled by the re-lock surprise.

export const ESCROW_MAX_TILT = 0.01;        // max P(up) reduction, on the 1st
export const ESCROW_DECAY_DAYS = 7;         // linear decay to 0 by the 7th
export const ESCROW_HISTORICAL_RELOCK = 0.75; // midpoint of the typical 60-90% range

/** Whole days since the 1st of the month (UTC). 0 = the 1st. */
export function daysSinceEscrow(tSec) {
  return new Date(tSec * 1000).getUTCDate() - 1;
}

/**
 * Bearish tilt magnitude (>= 0) to subtract from P(up).
 * relock: fraction of the 1B XRP that Ripple re-locked (0.6-0.9 typical).
 * Lower re-lock => more XRP stays out => stronger tilt.
 * Defaults to the historical average when the figure is unknown.
 */
export function escrowTilt(tSec, relock = ESCROW_HISTORICAL_RELOCK) {
  const d = daysSinceEscrow(tSec);
  if (d < 0 || d >= ESCROW_DECAY_DAYS) return 0;
  const base = ESCROW_MAX_TILT * (1 - d / (ESCROW_DECAY_DAYS - 1));
  const scale = (1 - relock) / (1 - ESCROW_HISTORICAL_RELOCK);
  return Math.max(0, base * Math.max(0, scale));
}
