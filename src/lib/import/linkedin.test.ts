import { describe, it, expect } from 'vitest'
import { parseCsvLine, parseLinkedinCsv } from './linkedin'

describe('parseCsvLine', () => {
  it('splits simple fields', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })
  it('honors quoted commas', () => {
    expect(parseCsvLine('"Doe, Jane",CEO,"Acme, Inc"')).toEqual(['Doe, Jane', 'CEO', 'Acme, Inc'])
  })
  it('handles escaped quotes', () => {
    expect(parseCsvLine('"she said ""hi""",x')).toEqual(['she said "hi"', 'x'])
  })
})

const SAMPLE = `Notes:
"When exporting your connection data, you may notice..."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Jane,Doe,https://linkedin.com/in/janedoe,jane@acme.com,"Acme, Inc",CEO,01 Jan 2024
John,Smith,https://linkedin.com/in/johnsmith,,Beta LLC,Founder,15 Mar 2023
,,,,,,
NoLast,,https://linkedin.com/in/nolast,,,,
`

describe('parseLinkedinCsv', () => {
  it('skips the notes preamble and parses rows', () => {
    const rows = parseLinkedinCsv(SAMPLE)
    expect(rows).toHaveLength(3)
  })
  it('maps fields correctly', () => {
    const [jane] = parseLinkedinCsv(SAMPLE)
    expect(jane.fullName).toBe('Jane Doe')
    expect(jane.email).toBe('jane@acme.com')
    expect(jane.company).toBe('Acme, Inc')
    expect(jane.position).toBe('CEO')
  })
  it('handles missing email', () => {
    const john = parseLinkedinCsv(SAMPLE)[1]
    expect(john.email).toBeUndefined()
  })
  it('drops nameless rows but keeps first-name-only', () => {
    const rows = parseLinkedinCsv(SAMPLE)
    expect(rows.some((r) => r.fullName === 'NoLast')).toBe(true)
    expect(rows.every((r) => r.fullName !== '')).toBe(true)
  })
  it('returns empty for a file with no header', () => {
    expect(parseLinkedinCsv('garbage\nno header here')).toEqual([])
  })
})
