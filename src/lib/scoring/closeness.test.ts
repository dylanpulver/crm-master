import { describe, it, expect } from 'vitest'
import { seedCloseness, tierForScore } from './closeness'

describe('seedCloseness', () => {
  it('scores a stranger near zero', () => {
    const r = seedCloseness({ outCount: 0, inCount: 0, meetingCount: 0 })
    expect(r.score).toBeLessThan(10)
    expect(r.confidence).toBe(0)
  })
  it('scores a frequent, reciprocal, recently-met contact high', () => {
    const r = seedCloseness({
      outCount: 80,
      inCount: 70,
      daysSinceLastContact: 5,
      directRatio: 0.9,
      meetingCount: 12,
    })
    expect(r.score).toBeGreaterThan(60)
    expect(r.confidence).toBeGreaterThan(0.5)
  })
  it('penalises one-sided broadcast contact', () => {
    const oneSided = seedCloseness({ outCount: 0, inCount: 60, meetingCount: 0 })
    const mutual = seedCloseness({ outCount: 30, inCount: 30, meetingCount: 0 })
    expect(mutual.score).toBeGreaterThan(oneSided.score)
  })
  it('returns scores within 0..100', () => {
    const r = seedCloseness({
      outCount: 9999,
      inCount: 9999,
      daysSinceLastContact: 0,
      directRatio: 1,
      meetingCount: 9999,
    })
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.score).toBeGreaterThanOrEqual(0)
  })
})

describe('tierForScore', () => {
  it('maps boundaries correctly', () => {
    expect(tierForScore(95)).toBe('inner_circle')
    expect(tierForScore(80)).toBe('inner_circle')
    expect(tierForScore(79)).toBe('close')
    expect(tierForScore(60)).toBe('close')
    expect(tierForScore(40)).toBe('known')
    expect(tierForScore(20)).toBe('acquaintance')
    expect(tierForScore(0)).toBe('cold')
  })
})
