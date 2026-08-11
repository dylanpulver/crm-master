// Cadence resolution — closeness drives the DESIRED touch frequency.
// Layered precedence (first defined wins):
//   person override > initiative-member override > initiative default > tier default
// Engagement is the measured state; the gap past cadence fires a going-cold nudge.

import { TIER_CADENCE_DAYS, type ClosenessTier } from '@/lib/domain/types'
import { daysBetween } from '@/lib/scoring/engagement'

export type CadenceInputs = {
  tier: ClosenessTier
  personOverrideDays?: number | null
  initiativeMemberOverrideDays?: number | null
  initiativeDefaultDays?: number | null
}

/** Resolve the effective target cadence (days) for a contact. */
export function resolveCadenceDays(i: CadenceInputs): number {
  return (
    i.personOverrideDays ??
    i.initiativeMemberOverrideDays ??
    i.initiativeDefaultDays ??
    TIER_CADENCE_DAYS[i.tier]
  )
}

/** True when elapsed-since-last-touch exceeds the target cadence. */
export function isGoingCold(lastTouchAt: Date | null, cadenceDays: number, now: Date): boolean {
  if (lastTouchAt === null) return true // never touched → due
  return daysBetween(lastTouchAt, now) > cadenceDays
}

/**
 * How far past cadence a contact is, capped (so an ancient contact can't
 * permanently dominate the queue). 1.0 = exactly at cadence.
 */
export function overdueRatio(
  lastTouchAt: Date | null,
  cadenceDays: number,
  now: Date,
  cap = 3
): number {
  if (cadenceDays <= 0) return cap
  if (lastTouchAt === null) return cap
  return Math.min(daysBetween(lastTouchAt, now) / cadenceDays, cap)
}
