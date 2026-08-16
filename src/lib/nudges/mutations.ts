import type { SupabaseClient } from '@supabase/supabase-js'
import { applyInteraction } from '@/lib/scoring/engagement'
import { snoozeUntil } from '@/lib/nudges/queue'

// Queue mutations — the same semantics as the digest one-tap links
// (src/app/api/a/[action]/route.ts), but for the in-app queue: the caller
// passes an RLS-scoped client, and every statement still filters by
// operator_id explicitly (defense in depth, house style).

export type NudgeRef = { operatorId: string; nudgeId: string }

async function loadPending(sb: SupabaseClient, ref: NudgeRef) {
  const { data } = await sb
    .from('nudge')
    .select('id, person_id, status')
    .eq('id', ref.nudgeId)
    .eq('operator_id', ref.operatorId)
    .in('status', ['pending', 'snoozed'])
    .maybeSingle()
  return data
}

/**
 * Mark a nudge done = "I did the touch": log an outbound interaction, fold it
 * into the engagement counter, reset last_touch_at, resolve the nudge.
 */
export async function markNudgeDone(
  sb: SupabaseClient,
  ref: NudgeRef,
  now: Date = new Date()
): Promise<boolean> {
  const nudge = await loadPending(sb, ref)
  if (!nudge) return false

  const { error: intErr } = await sb.from('interaction').insert({
    operator_id: ref.operatorId,
    person_id: nudge.person_id,
    type: 'note',
    direction: 'outbound',
    occurred_at: now.toISOString(),
    summary: 'Logged touch (nudge queue)',
    source: 'manual',
  })
  if (intErr) throw new Error(`log interaction: ${intErr.message}`)

  const { data: rel } = await sb
    .from('operator_relationship')
    .select('engagement_score, engagement_updated_at')
    .eq('operator_id', ref.operatorId)
    .eq('person_id', nudge.person_id)
    .maybeSingle()
  if (rel) {
    const engagement = applyInteraction({
      current: rel.engagement_score,
      updatedAt: new Date(rel.engagement_updated_at),
      occurredAt: now,
      type: 'note',
    })
    const { error: relErr } = await sb
      .from('operator_relationship')
      .update({
        engagement_score: engagement,
        engagement_updated_at: now.toISOString(),
        last_touch_at: now.toISOString(),
      })
      .eq('operator_id', ref.operatorId)
      .eq('person_id', nudge.person_id)
    if (relErr) throw new Error(`update relationship: ${relErr.message}`)
  }

  const { error: nErr } = await sb
    .from('nudge')
    .update({ status: 'done', resolved_at: now.toISOString() })
    .eq('id', ref.nudgeId)
    .eq('operator_id', ref.operatorId)
  if (nErr) throw new Error(`resolve nudge: ${nErr.message}`)
  return true
}

/** Snooze a nudge — it resurfaces after the standard window. */
export async function snoozeNudge(
  sb: SupabaseClient,
  ref: NudgeRef,
  now: Date = new Date()
): Promise<boolean> {
  const nudge = await loadPending(sb, ref)
  if (!nudge) return false
  const { error } = await sb
    .from('nudge')
    .update({ status: 'snoozed', snoozed_until: snoozeUntil(now).toISOString() })
    .eq('id', ref.nudgeId)
    .eq('operator_id', ref.operatorId)
  if (error) throw new Error(`snooze nudge: ${error.message}`)
  return true
}
