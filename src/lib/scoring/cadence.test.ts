import { describe, it, expect } from 'vitest'
import { resolveCadenceDays, isGoingCold, overdueRatio } from './cadence'

const day = (n: number) => new Date(2026, 0, 1 + n)

describe('resolveCadenceDays', () => {
  it('falls back to tier default', () => {
    expect(resolveCadenceDays({ tier: 'close' })).toBe(30)
    expect(resolveCadenceDays({ tier: 'inner_circle' })).toBe(14)
  })
  it('person override wins over everything', () => {
    expect(
      resolveCadenceDays({
        tier: 'cold',
        personOverrideDays: 7,
        initiativeDefaultDays: 90,
      })
    ).toBe(7)
  })
  it('initiative default beats tier but loses to overrides', () => {
    expect(resolveCadenceDays({ tier: 'cold', initiativeDefaultDays: 45 })).toBe(45)
  })
})

describe('isGoingCold', () => {
  it('is true when never touched', () => {
    expect(isGoingCold(null, 30, day(0))).toBe(true)
  })
  it('is false within cadence', () => {
    expect(isGoingCold(day(0), 30, day(20))).toBe(false)
  })
  it('is true past cadence', () => {
    expect(isGoingCold(day(0), 30, day(31))).toBe(true)
  })
})

describe('overdueRatio', () => {
  it('is 1.0 exactly at cadence', () => {
    expect(overdueRatio(day(0), 30, day(30))).toBeCloseTo(1, 6)
  })
  it('caps at the provided cap', () => {
    expect(overdueRatio(day(0), 30, day(3650))).toBe(3)
  })
  it('returns cap for never-touched', () => {
    expect(overdueRatio(null, 30, day(0))).toBe(3)
  })
})
