// Domain types + tunable constants for the scoring core.
// Pure data — no I/O. Single source of truth for weights/thresholds so the
// formulas stay calibratable in one place (see docs/ARCHITECTURE.md §2).

export type InteractionType =
  | 'call'
  | 'meeting'
  | 'message'
  | 'dm'
  | 'email'
  | 'linkedin_like'
  | 'profile_view'
  | 'birthday_msg'
  | 'note'

export type Direction = 'inbound' | 'outbound'

export type ClosenessTier = 'inner_circle' | 'close' | 'known' | 'acquaintance' | 'cold'

/** Engagement decayed-counter tuning. */
export const ENGAGEMENT = {
  /** Half-life in days. Calibrate by sweeping {30,45,60,90}. */
  HALF_LIFE_DAYS: 60,
  /** Saturation constant for display warmth = e/(e+K). */
  SATURATION_K: 10,
} as const

/** Per-interaction depth weight `w` (meeting/call >> message >> reaction). */
export const INTERACTION_WEIGHT: Readonly<Record<InteractionType, number>> = {
  meeting: 8,
  call: 8,
  email: 4,
  message: 4,
  dm: 2,
  note: 1,
  linkedin_like: 1,
  profile_view: 1,
  birthday_msg: 1,
}

/** Closeness tiers, ordered strongest → weakest. */
export const CLOSENESS_TIERS: readonly ClosenessTier[] = [
  'inner_circle',
  'close',
  'known',
  'acquaintance',
  'cold',
] as const

/** Lower score bound (inclusive) that qualifies for each tier. */
export const TIER_SCORE_FLOOR: Readonly<Record<ClosenessTier, number>> = {
  inner_circle: 80,
  close: 60,
  known: 40,
  acquaintance: 20,
  cold: 0,
}

/** Default target touch cadence per tier (days). Closeness drives desired frequency. */
export const TIER_CADENCE_DAYS: Readonly<Record<ClosenessTier, number>> = {
  inner_circle: 14,
  close: 30,
  known: 60,
  acquaintance: 120,
  cold: 240,
}

/** Closeness-seed weights (sum to 1). From metadata aggregates at cold-start. */
export const SEED_WEIGHTS = {
  frequency: 0.3,
  recency: 0.25,
  reciprocity: 0.2,
  directness: 0.1,
  meetings: 0.15,
} as const

/** Reference scales used to normalise unbounded seed inputs into 0..1. */
export const SEED_REFERENCE = {
  /** log1p(total messages) at which "frequency" saturates to 1. */
  FREQUENCY: Math.log1p(200),
  /** log1p(meeting count) at which "meetings" saturates to 1. */
  MEETINGS: Math.log1p(50),
  /** Recency decay constant (days) for exp(-days/RECENCY). */
  RECENCY_DAYS: 180,
} as const

export const MS_PER_DAY = 86_400_000
