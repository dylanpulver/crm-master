// Closeness — the "depth of bond" axis. Manual + seeded, does NOT decay.
// Seeded at cold-start from communication-metadata aggregates, then user-editable.

import {
  CLOSENESS_TIERS,
  SEED_REFERENCE,
  SEED_WEIGHTS,
  TIER_SCORE_FLOOR,
  type ClosenessTier,
} from '@/lib/domain/types'

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Aggregates derived from Gmail/Calendar metadata (never bodies). */
export type SeedSignals = {
  outCount: number
  inCount: number
  /** Days since last contact; undefined = never/unknown. */
  daysSinceLastContact?: number
  /** Fraction of messages where the contact was a direct (To) recipient, 0..1. */
  directRatio?: number
  meetingCount: number
}

/** Result of seeding: a 0..100 closeness score + a confidence in that estimate. */
export type SeedResult = { score: number; confidence: number }

/**
 * Compute an initial closeness score (0..100) from interaction metadata.
 * Components are each normalised to 0..1 and combined by SEED_WEIGHTS.
 */
export function seedCloseness(s: SeedSignals): SeedResult {
  const total = s.outCount + s.inCount

  const frequency = clamp01(Math.log1p(total) / SEED_REFERENCE.FREQUENCY)
  const recency =
    s.daysSinceLastContact === undefined
      ? 0
      : Math.exp(-s.daysSinceLastContact / SEED_REFERENCE.RECENCY_DAYS)
  const reciprocity =
    total === 0 ? 0 : Math.min(s.outCount, s.inCount) / Math.max(s.outCount, s.inCount, 1)
  const directness = clamp01(s.directRatio ?? 0)
  const meetings = clamp01(Math.log1p(s.meetingCount) / SEED_REFERENCE.MEETINGS)

  const combined =
    SEED_WEIGHTS.frequency * frequency +
    SEED_WEIGHTS.recency * recency +
    SEED_WEIGHTS.reciprocity * reciprocity +
    SEED_WEIGHTS.directness * directness +
    SEED_WEIGHTS.meetings * meetings

  // Confidence scales with how much signal exists (more touches + meetings = surer).
  const confidence = clamp01(Math.log1p(total + s.meetingCount * 3) / SEED_REFERENCE.FREQUENCY)

  return { score: Math.round(clamp01(combined) * 100), confidence: Number(confidence.toFixed(2)) }
}

/** Map a 0..100 closeness score to its tier. */
export function tierForScore(score: number): ClosenessTier {
  for (const tier of CLOSENESS_TIERS) {
    if (score >= TIER_SCORE_FLOOR[tier]) return tier
  }
  return 'cold'
}
