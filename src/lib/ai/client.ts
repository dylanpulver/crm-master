import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import { buildDraftPrompt, type DraftContext } from '@/lib/ai/prompts'

// Claude client + draft generation. Server-only. Draft-by-default: this returns
// text for human review; it never sends anything.

export const MODELS = {
  draft: 'claude-opus-4-8', // short, voice-sensitive, quality-critical
  brief: 'claude-sonnet-4-6', // synthesis over history
  extract: 'claude-haiku-4-5', // transcript → structured intel
} as const

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!env.anthropicKey) throw new Error('ANTHROPIC_API_KEY not set')
  _client ??= new Anthropic({ apiKey: env.anthropicKey })
  return _client
}

/** Generate a draft message from relationship context. Returns plain text. */
export async function generateDraft(ctx: DraftContext): Promise<string> {
  const { system, user } = buildDraftPrompt(ctx)
  const res = await client().messages.create({
    model: MODELS.draft,
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: user }],
  })
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}
