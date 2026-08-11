import { describe, it, expect } from 'vitest'
import { normalizeEmail, isRoleAddress } from './email'
import { normalizePhone } from './phone'

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  John@Example.COM ')).toBe('john@example.com')
  })
  it('strips gmail dots and +tags', () => {
    expect(normalizeEmail('j.o.h.n+newsletter@gmail.com')).toBe('john@gmail.com')
  })
  it('canonicalises googlemail.com → gmail.com', () => {
    expect(normalizeEmail('john@googlemail.com')).toBe('john@gmail.com')
  })
  it('does NOT strip dots for non-gmail providers', () => {
    expect(normalizeEmail('a.b@outlook.com')).toBe('a.b@outlook.com')
  })
})

describe('isRoleAddress', () => {
  it('flags no-reply and role inboxes', () => {
    expect(isRoleAddress('no-reply@stripe.com')).toBe(true)
    expect(isRoleAddress('notifications@github.com')).toBe(true)
    expect(isRoleAddress('info@acme.com')).toBe(true)
  })
  it('passes real people', () => {
    expect(isRoleAddress('alex@acme.com')).toBe(false)
  })
})

describe('normalizePhone', () => {
  it('produces E.164 for a North American number', () => {
    expect(normalizePhone('(415) 555-0123', 'US')).toBe('+14155550123')
  })
  it('normalises a CA number with country default', () => {
    expect(normalizePhone('416-555-0199')).toBe('+14165550199')
  })
  it('falls back to digits when unparseable', () => {
    expect(normalizePhone('12345')).toBe('12345')
  })
})
