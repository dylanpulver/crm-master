import { describe, it, expect } from 'vitest'
import {
  daysBetween,
  decayFactor,
  reciprocityMultiplier,
  decayEngagement,
  applyInteraction,
  normalizedWarmth,
} from './engagement'

const day = (n: number) => new Date(2026, 0, 1 + n)

describe('decayFactor', () => {
  it('halves at one half-life', () => {
    expect(decayFactor(60, 60)).toBeCloseTo(0.5, 6)
  })
  it('quarters at two half-lives', () => {
    expect(decayFactor(120, 60)).toBeCloseTo(0.25, 6)
  })
  it('is 1 at zero elapsed', () => {
    expect(decayFactor(0)).toBe(1)
  })
})

describe('daysBetween', () => {
  it('never goes negative', () => {
    expect(daysBetween(day(5), day(0))).toBe(0)
  })
  it('counts whole days', () => {
    expect(daysBetween(day(0), day(3))).toBeCloseTo(3, 6)
  })
})

describe('reciprocityMultiplier', () => {
  it('is 1.0 when balanced', () => {
    expect(reciprocityMultiplier(5, 5)).toBe(1)
  })
  it('is 0.5 when fully one-sided', () => {
    expect(reciprocityMultiplier(0, 9)).toBe(0.5)
  })
  it('is between for partial', () => {
    expect(reciprocityMultiplier(2, 4)).toBeCloseTo(0.75, 6)
  })
})

describe('applyInteraction + decayEngagement', () => {
  it('adds full weight to a fresh contact', () => {
    const e = applyInteraction({
      current: 0,
      updatedAt: day(0),
      occurredAt: day(0),
      type: 'meeting',
    })
    expect(e).toBe(8)
  })
  it('decays prior value then adds new weight', () => {
    const e = applyInteraction({
      current: 8,
      updatedAt: day(0),
      occurredAt: day(60),
      type: 'email',
      halfLifeDays: 60,
    })
    expect(e).toBeCloseTo(4 + 4, 6) // 8 decayed by half = 4, + email weight 4
  })
  it('reciprocity scales the contribution', () => {
    const e = applyInteraction({
      current: 0,
      updatedAt: day(0),
      occurredAt: day(0),
      type: 'meeting',
      reciprocity: 0.5,
    })
    expect(e).toBe(4)
  })
  it('decayEngagement halves over a half-life', () => {
    expect(decayEngagement(10, day(0), day(60), 60)).toBeCloseTo(5, 6)
  })
})

describe('normalizedWarmth', () => {
  it('is 0 at zero engagement', () => {
    expect(normalizedWarmth(0)).toBe(0)
  })
  it('approaches 1 as engagement grows', () => {
    expect(normalizedWarmth(1000)).toBeGreaterThan(0.98)
  })
  it('is 0.5 at engagement == K', () => {
    expect(normalizedWarmth(10, 10)).toBeCloseTo(0.5, 6)
  })
})
