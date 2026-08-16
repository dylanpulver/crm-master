import { describe, it, expect } from 'vitest'
import { snoozeUntil, whyNow, currentWarmth, warmthLabel, previewDraft, SNOOZE_DAYS } from './queue'

const DAY = 86_400_000
const NOW = new Date('2026-08-12T12:00:00Z')

describe('snoozeUntil', () => {
  it('defaults to the standard snooze window', () => {
    expect(snoozeUntil(NOW).getTime()).toBe(NOW.getTime() + SNOOZE_DAYS * DAY)
  })
  it('accepts a custom window', () => {
    expect(snoozeUntil(NOW, 7).getTime()).toBe(NOW.getTime() + 7 * DAY)
  })
})

describe('whyNow', () => {
  it('formats days since last touch with cadence', () => {
    const lastTouch = new Date(NOW.getTime() - 41 * DAY)
    expect(whyNow(lastTouch, 14, NOW)).toBe('41 days since last touch · cadence 14d')
  })
  it('uses singular for one day', () => {
    const lastTouch = new Date(NOW.getTime() - 1 * DAY)
    expect(whyNow(lastTouch, 14, NOW)).toBe('1 day since last touch · cadence 14d')
  })
  it('handles never-touched contacts', () => {
    expect(whyNow(null, 60, NOW)).toBe('No logged contact yet · cadence 60d')
  })
  it('floors partial days', () => {
    const lastTouch = new Date(NOW.getTime() - 41.9 * DAY)
    expect(whyNow(lastTouch, 14, NOW)).toBe('41 days since last touch · cadence 14d')
  })
})

describe('currentWarmth', () => {
  it('is zero for zero engagement', () => {
    expect(currentWarmth(0, NOW, NOW)).toBe(0)
  })
  it('is in (0,1) for positive engagement', () => {
    const w = currentWarmth(10, NOW, NOW)
    expect(w).toBeGreaterThan(0)
    expect(w).toBeLessThan(1)
  })
  it('decays over time', () => {
    const past = new Date(NOW.getTime() - 90 * DAY)
    expect(currentWarmth(10, past, NOW)).toBeLessThan(currentWarmth(10, NOW, NOW))
  })
})

describe('warmthLabel', () => {
  it('buckets the range', () => {
    expect(warmthLabel(0)).toBe('cold')
    expect(warmthLabel(0.05)).toBe('cold')
    expect(warmthLabel(0.2)).toBe('cool')
    expect(warmthLabel(0.5)).toBe('warm')
    expect(warmthLabel(0.9)).toBe('hot')
  })
})

describe('previewDraft', () => {
  it('returns short bodies unchanged', () => {
    expect(previewDraft('Hey Sam, long time!')).toBe('Hey Sam, long time!')
  })
  it('truncates long bodies with an ellipsis', () => {
    const long = 'a'.repeat(300)
    const out = previewDraft(long)
    expect(out.length).toBe(221)
    expect(out.endsWith('…')).toBe(true)
  })
  it('trims surrounding whitespace', () => {
    expect(previewDraft('  hi  ')).toBe('hi')
  })
})
