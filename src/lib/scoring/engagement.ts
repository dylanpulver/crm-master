// Engagement — the "front-of-mind" axis. A time-decayed counter of weighted,
// reciprocity-adjusted interactions. O(1) updates (no history replay):
//
//   on interaction:  e' = e · 2^(-Δdays/H) + (w · r)
//   decay only:      e' = e · 2^(-Δdays/H)
//
// where H = half-life, w = interaction depth weight, r = reciprocity multiplier.
// This is mathematically identical to the full decayed sum (an EMA), so we only
// ever store (engagement_score, engagement_updated_at).

import {
  ENGAGEMENT,
  INTERACTION_WEIGHT,
  MS_PER_DAY,
  type InteractionType,
} from '@/lib/domain/types'

/** Days between two instants (fractional, never negative). */
export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / MS_PER_DAY)
}

/** Decay factor over `days` for the configured half-life. */
export function decayFactor(days: number, halfLifeDays: number = ENGAGEMENT.HALF_LIFE_DAYS): number {
  return Math.pow(2, -days / halfLifeDays)
}

/**
 * Reciprocity multiplier ∈ [0.5, 1.0]. One-sided exchanges (all-you or all-them)
 * score 0.5; balanced exchanges score 1.0. Penalises broadcast/unanswered touches.
 */
export function reciprocityMultiplier(inbound: number, outbound: number): number {
  const lo = Math.min(inbound, outbound)
  const hi = Math.max(inbound, outbound, 1)
  return 0.5 + 0.5 * (lo / hi)
}

/** Decay an existing engagement value to `now` without adding an interaction. */
export function decayEngagement(
  current: number,
  updatedAt: Date,
  now: Date,
  halfLifeDays: number = ENGAGEMENT.HALF_LIFE_DAYS
): number {
  return current * decayFactor(daysBetween(updatedAt, now), halfLifeDays)
}

/**
 * Fold a new interaction into the engagement counter. Decays the prior value to
 * the interaction time, then adds the weighted, reciprocity-adjusted contribution.
 */
export function applyInteraction(params: {
  current: number
  updatedAt: Date
  occurredAt: Date
  type: InteractionType
  reciprocity?: number
  halfLifeDays?: number
}): number {
  const { current, updatedAt, occurredAt, type } = params
  const halfLifeDays = params.halfLifeDays ?? ENGAGEMENT.HALF_LIFE_DAYS
  const r = params.reciprocity ?? 1
  const decayed = current * decayFactor(daysBetween(updatedAt, occurredAt), halfLifeDays)
  return decayed + INTERACTION_WEIGHT[type] * r
}

/** Saturating squash of raw engagement into a 0..1 "warmth" for display/ranking. */
export function normalizedWarmth(engagement: number, k: number = ENGAGEMENT.SATURATION_K): number {
  if (engagement <= 0) return 0
  return engagement / (engagement + k)
}
