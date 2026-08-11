// Throwaway: live-test draft generation through the real prompt builder + Claude.
// Run: npx tsx scripts/dev/test-draft.ts
import { readFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { buildDraftPrompt, type DraftContext } from '../../src/lib/ai/prompts'

// minimal .env.local loader
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}

const ctx: DraftContext = {
  operatorName: 'Alex',
  contactName: 'Sam Patel',
  draftType: 'followup',
  relationshipSummary: 'Founder I met at a fintech meetup; building a payments startup, non-technical.',
  history: [
    { date: '2026-04-10', type: 'meeting', summary: 'Coffee — he is scoping a marketplace build, worried about hiring devs wrong. I mentioned I take on one full build at a time.' },
    { date: '2026-04-10', type: 'note', summary: 'He asked me to send a one-pager on how I scoped the Atlas project.' },
  ],
  userVoice: { descriptor: 'Warm, direct, concise. Lowercase-casual but competent. No corporate filler.' },
}

async function main() {
  const { system, user } = buildDraftPrompt(ctx)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: user }],
  })
  const text = res.content.filter((b) => b.type === 'text').map((b: { text: string }) => b.text).join('')
  console.log('\n===== GENERATED DRAFT =====\n')
  console.log(text.trim())
  console.log('\n===========================\n')
  console.log('tokens:', res.usage.input_tokens, 'in /', res.usage.output_tokens, 'out')
}
main()
