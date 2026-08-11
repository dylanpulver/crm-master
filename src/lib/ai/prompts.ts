// Draft-message prompt assembly. Pure string building — no API calls here.
// Grounded in the contact's real relationship history (SQL-retrieved, no vectors).
// Anti-slop constraints + the user's voice are baked into the system prompt.
// See docs/ARCHITECTURE.md §5 and docs/METHODOLOGY.md (style patterns).

export type DraftType =
  | 'followup'
  | 'checkin'
  | 'intro'
  | 'birthday'
  | 'milestone_update'
  | 'propose_times'

export type HistoryItem = {
  date: string // ISO
  type: string // meeting | email | note | ...
  summary: string
}

export type UserVoice = {
  /** Distilled descriptor of the operator's writing style. */
  descriptor?: string
  /** A few representative past messages the operator actually sent. */
  exemplars?: string[]
}

export type DraftContext = {
  operatorName: string
  contactName: string
  draftType: DraftType
  relationshipSummary?: string
  history: HistoryItem[]
  userVoice?: UserVoice
  /** Edit-diffs: how the operator changed prior drafts to THIS contact. */
  recipientStyleNotes?: string[]
  /** For milestone_update. */
  milestone?: string
  /** For propose_times. */
  proposedTimes?: string[]
}

export type DraftPrompt = { system: string; user: string }

const SLOP_BANS = [
  'no "I hope this finds you well" / "I wanted to reach out" / "just checking in"',
  'no buzzword value-props ("we help companies...", "leverage", "synergy", "circle back")',
  'no em-dash-heavy cadence, no tricolon openers, no "As a [role], you..."',
  'no flattery, no fake urgency',
].join('\n- ')

const TYPE_INSTRUCTION: Record<DraftType, string> = {
  followup:
    'Write a follow-up referencing your last real conversation. Include ONE specific detail from the history so it reads as attention, not a template.',
  checkin:
    'Write a light but purposeful check-in. Reference one relevant thing in their world. No ask required beyond reconnecting.',
  intro:
    'Write a short intro explaining who you are and why this is relevant to them. One specific reason, one soft ask.',
  birthday: 'Write a brief, warm, personal birthday note. No business ask.',
  milestone_update:
    'Reconnect using the milestone as the hook. Lead with the news, then a light, relevant next step. This is a warm re-touch, not a pitch.',
  propose_times:
    'Confirm interest and propose 3-4 specific meeting windows. Include dual timezones (ET/PT) on each.',
}

export function buildDraftSystemPrompt(ctx: DraftContext): string {
  const parts: string[] = [
    `You draft short, personal outreach messages for ${ctx.operatorName}. You write in ${ctx.operatorName}'s own voice — these are real messages to real relationships, not marketing.`,
    '',
    'Hard rules:',
    `- ${SLOP_BANS}`,
    '- Under 150 words. Plain text. Conversational.',
    '- Ground every specific claim in the provided history. If it is not in the history, do not assert it.',
    '- Exactly one concrete ask or next step.',
    `- Sign off as ${ctx.operatorName}.`,
    '- Output ONLY the message (with a Subject line if it is an email). No preamble, no commentary.',
  ]
  if (ctx.userVoice?.descriptor) {
    parts.push('', `Voice of ${ctx.operatorName}: ${ctx.userVoice.descriptor}`)
  }
  if (ctx.userVoice?.exemplars?.length) {
    parts.push('', 'Examples of how they actually write:', ...ctx.userVoice.exemplars.map((e) => `"""${e}"""`))
  }
  if (ctx.recipientStyleNotes?.length) {
    parts.push(
      '',
      `How ${ctx.operatorName} adjusts drafts for ${ctx.contactName} (match this):`,
      ...ctx.recipientStyleNotes.map((n) => `- ${n}`)
    )
  }
  return parts.join('\n')
}

export function buildDraftUserPrompt(ctx: DraftContext): string {
  const lines: string[] = [`Contact: ${ctx.contactName}`]
  if (ctx.relationshipSummary) lines.push(`Relationship: ${ctx.relationshipSummary}`)

  lines.push('', 'History (most recent first):')
  if (ctx.history.length === 0) {
    lines.push('(no recorded history — keep it light and low-assumption)')
  } else {
    for (const h of ctx.history) lines.push(`- [${h.date}] ${h.type}: ${h.summary}`)
  }

  if (ctx.draftType === 'milestone_update' && ctx.milestone) {
    lines.push('', `Milestone to lead with: ${ctx.milestone}`)
  }
  if (ctx.draftType === 'propose_times' && ctx.proposedTimes?.length) {
    lines.push('', 'Propose these windows:', ...ctx.proposedTimes.map((t) => `- ${t}`))
  }

  lines.push('', TYPE_INSTRUCTION[ctx.draftType])
  return lines.join('\n')
}

export function buildDraftPrompt(ctx: DraftContext): DraftPrompt {
  return { system: buildDraftSystemPrompt(ctx), user: buildDraftUserPrompt(ctx) }
}
