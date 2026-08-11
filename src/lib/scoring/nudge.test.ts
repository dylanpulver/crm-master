import { describe, it, expect } from 'vitest'
import { expectedWarmth, goingColdPriority, byPriorityDesc } from './nudge'

describe('expectedWarmth', () => {
  it('maps closeness 0..100 → 0..1', () => {
    expect(expectedWarmth(0)).toBe(0)
    expect(expectedWarmth(50)).toBe(0.5)
    expect(expectedWarmth(100)).toBe(1)
  })
})

describe('goingColdPriority', () => {
  it('is zero when engagement meets expectation', () => {
    // high engagement → normalizedWarmth ~1 ≥ expected → no deficit
    expect(goingColdPriority({ closeness: 50, engagement: 1000, overdueRatio: 2 })).toBe(0)
  })
  it('is positive when a close contact has gone cold', () => {
    expect(goingColdPriority({ closeness: 90, engagement: 0, overdueRatio: 2 })).toBeGreaterThan(0)
  })
  it('ranks a close cold contact above a distant cold one', () => {
    const close = goingColdPriority({ closeness: 90, engagement: 0, overdueRatio: 2 })
    const distant = goingColdPriority({ closeness: 20, engagement: 0, overdueRatio: 2 })
    expect(close).toBeGreaterThan(distant)
  })
  it('overdue boost increases priority', () => {
    const less = goingColdPriority({ closeness: 70, engagement: 0, overdueRatio: 0 })
    const more = goingColdPriority({ closeness: 70, engagement: 0, overdueRatio: 3 })
    expect(more).toBeGreaterThan(less)
  })
})

describe('byPriorityDesc', () => {
  it('sorts highest priority first', () => {
    const items = [
      { priority: 1, overdueRatio: 1 },
      { priority: 5, overdueRatio: 1 },
      { priority: 3, overdueRatio: 1 },
    ]
    expect([...items].sort(byPriorityDesc).map((i) => i.priority)).toEqual([5, 3, 1])
  })
  it('breaks ties by overdueRatio', () => {
    const items = [
      { priority: 2, overdueRatio: 1 },
      { priority: 2, overdueRatio: 3 },
    ]
    expect([...items].sort(byPriorityDesc)[0].overdueRatio).toBe(3)
  })
})
