// Nudge-queue display helpers — pure functions the /nudges page renders from.
// No I/O: the page fetches rows, these turn them into what the operator sees.

import { decayEngagement, normalizedWarmth, daysBetween } from '@/lib/scoring/engagement'

export const SNOOZE_DAYS = 3

/** When a snoozed nudge resurfaces (matches the digest one-tap snooze). */
export function snoozeUntil(now: Date, days: number = SNOOZE_DAYS): Date {
  return new Date(now.getTime() + days * 86_400_000)
}

/**
 * "Why now" line for a nudge row, derived live from the relationship
 * (fresher than the reason snapshotted at generation time).
 * e.g. "41 days since last touch · cadence 14d"
 */
export function whyNow(lastTouchAt: Date | null, cadenceDays: number, now: Date): string {
  if (lastTouchAt === null) return `No logged contact yet · cadence ${cadenceDays}d`
  const days = Math.floor(daysBetween(lastTouchAt, now))
  const label = days === 1 ? '1 day' : `${days} days`
  return `${label} since last touch · cadence ${cadenceDays}d`
}

/**
 * Current warmth ∈ [0,1] for display: decay the stored engagement counter to
 * `now`, then squash with the standard saturation curve.
 */
export function currentWarmth(
  engagementScore: number,
  engagementUpdatedAt: Date,
  now: Date
): number {
  return normalizedWarmth(decayEngagement(engagementScore, engagementUpdatedAt, now))
}

/** Coarse warmth bucket for the indicator label. */
export function warmthLabel(warmth: number): 'cold' | 'cool' | 'warm' | 'hot' {
  if (warmth >= 0.66) return 'hot'
  if (warmth >= 0.33) return 'warm'
  if (warmth > 0.05) return 'cool'
  return 'cold'
}

/** Truncate an AI draft body for the row preview. */
export function previewDraft(body: string, max = 220): string {
  const oneLine = body.trim()
  return oneLine.length > max ? oneLine.slice(0, max).trimEnd() + '…' : oneLine
}
