import { describe, it, expect } from 'vitest'
import { buildDraftPrompt, type DraftContext } from './prompts'

const base: DraftContext = {
  operatorName: 'Alex',
  contactName: 'Sam Lee',
  draftType: 'followup',
  history: [{ date: '2026-05-01', type: 'meeting', summary: 'Discussed payments integration' }],
}

describe('buildDraftPrompt', () => {
  it('bakes in anti-slop rules and sign-off', () => {
    const { system } = buildDraftPrompt(base)
    expect(system).toContain('Under 150 words')
    expect(system).toContain('Sign off as Alex')
    expect(system.toLowerCase()).toContain('hope this finds you well')
  })

  it('includes history and the type instruction', () => {
    const { user } = buildDraftPrompt(base)
    expect(user).toContain('Sam Lee')
    expect(user).toContain('payments integration')
    expect(user).toContain('follow-up')
  })

  it('handles empty history gracefully', () => {
    const { user } = buildDraftPrompt({ ...base, history: [] })
    expect(user).toContain('no recorded history')
  })

  it('leads with the milestone for milestone_update', () => {
    const { user } = buildDraftPrompt({
      ...base,
      draftType: 'milestone_update',
      milestone: 'Closed first enterprise customer',
    })
    expect(user).toContain('Closed first enterprise customer')
  })

  it('injects proposed windows for propose_times', () => {
    const { user } = buildDraftPrompt({
      ...base,
      draftType: 'propose_times',
      proposedTimes: ['Tue 9-11am ET / 6-8am PT'],
    })
    expect(user).toContain('Tue 9-11am ET / 6-8am PT')
  })

  it('includes recipient style notes when present', () => {
    const { system } = buildDraftPrompt({
      ...base,
      recipientStyleNotes: ['shortens openers', 'drops exclamation points'],
    })
    expect(system).toContain('shortens openers')
  })
})
