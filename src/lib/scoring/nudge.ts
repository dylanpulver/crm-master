// Nudge ranking — where the two axes combine, and ONLY here.
// A high-closeness contact going quiet outranks a low-closeness one going quiet:
//
//   deficit  = max(expectedWarmth(closeness) − normalizedEngagement, 0)
//   priority = closeness · deficit · overdueBoost
//
// expectedWarmth maps closeness 0..100 → 0..1 (how warm this *should* be).

import { normalizedWarmth } from '@/lib/scoring/engagement'

export type GoingColdInputs = {
  /** 0..100 closeness score. */
  closeness: number
  /** Raw engagement counter value. */
  engagement: number
  /** Overdue ratio (1.0 = at cadence, capped). */
  overdueRatio: number
}

export function expectedWarmth(closeness: number): number {
  return Math.min(1, Math.max(0, closeness / 100))
}

/**
 * Priority score for a going-cold nudge. Higher = surface sooner.
 * Zero when engagement already meets the closeness-implied expectation.
 */
export function goingColdPriority(i: GoingColdInputs): number {
  const deficit = Math.max(expectedWarmth(i.closeness) - normalizedWarmth(i.engagement), 0)
  // Modest boost for how far past cadence (overdueRatio ∈ [0,cap]); never zero out deficit.
  const overdueBoost = 0.5 + 0.5 * Math.min(i.overdueRatio / 3, 1)
  return i.closeness * deficit * overdueBoost
}

/** Stable descending sort by priority (ties broken by overdueRatio). */
export function byPriorityDesc(
  a: { priority: number; overdueRatio: number },
  b: { priority: number; overdueRatio: number }
): number {
  if (b.priority !== a.priority) return b.priority - a.priority
  return b.overdueRatio - a.overdueRatio
}
