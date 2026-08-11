import type { SupabaseClient } from '@supabase/supabase-js'
import { decayEngagement } from '@/lib/scoring/engagement'
import { resolveCadenceDays, isGoingCold, overdueRatio } from '@/lib/scoring/cadence'
import { goingColdPriority, byPriorityDesc } from '@/lib/scoring/nudge'
import type { ClosenessTier } from '@/lib/domain/types'

// Going-cold nudge generation. Idempotent per (operator, day): clears today's
// pending going_cold nudges then writes the freshly-ranked top N.

type RelRow = {
  person_id: string
  closeness_score: number
  closeness_tier: ClosenessTier
  engagement_score: number
  engagement_updated_at: string
  last_touch_at: string | null
  cadence_override_days: number | null
  person: { full_name: string } | { full_name: string }[] | null
}

export type GeneratedNudge = {
  personId: string
  personName: string
  priority: number
  overdueRatio: number
  cadenceDays: number
  daysSinceTouch: number | null
}

function personName(p: RelRow['person']): string {
  if (!p) return 'Unknown'
  return Array.isArray(p) ? (p[0]?.full_name ?? 'Unknown') : p.full_name
}

export async function generateGoingColdNudges(
  supabase: SupabaseClient,
  operatorId: string,
  opts: { now?: Date; limit?: number } = {}
): Promise<GeneratedNudge[]> {
  const now = opts.now ?? new Date()
  const limit = opts.limit ?? 5
  const today = now.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('operator_relationship')
    .select(
      'person_id, closeness_score, closeness_tier, engagement_score, engagement_updated_at, last_touch_at, cadence_override_days, person:person_id(full_name)'
    )
    .eq('operator_id', operatorId)
  if (error) throw new Error(`fetch relationships: ${error.message}`)

  const candidates = (data as RelRow[])
    .map((r) => {
      const lastTouch = r.last_touch_at ? new Date(r.last_touch_at) : null
      const cadenceDays = resolveCadenceDays({
        tier: r.closeness_tier,
        personOverrideDays: r.cadence_override_days,
      })
      if (!isGoingCold(lastTouch, cadenceDays, now)) return null
      const engagement = decayEngagement(
        r.engagement_score,
        new Date(r.engagement_updated_at),
        now
      )
      const odr = overdueRatio(lastTouch, cadenceDays, now)
      const priority = goingColdPriority({
        closeness: r.closeness_score,
        engagement,
        overdueRatio: odr,
      })
      if (priority <= 0) return null
      return {
        personId: r.person_id,
        personName: personName(r.person),
        priority,
        overdueRatio: odr,
        cadenceDays,
        daysSinceTouch: lastTouch
          ? Math.floor((now.getTime() - lastTouch.getTime()) / 86_400_000)
          : null,
      } satisfies GeneratedNudge
    })
    .filter((x): x is GeneratedNudge => x !== null)
    .sort(byPriorityDesc)
    .slice(0, limit)

  // Idempotent regen: clear today's pending going_cold, then insert fresh.
  await supabase
    .from('nudge')
    .delete()
    .eq('operator_id', operatorId)
    .eq('type', 'going_cold')
    .eq('surface_date', today)
    .eq('status', 'pending')

  if (candidates.length > 0) {
    const rows = candidates.map((c) => ({
      operator_id: operatorId,
      person_id: c.personId,
      type: 'going_cold',
      title: `Reconnect with ${c.personName}`,
      reason:
        c.daysSinceTouch === null
          ? 'No logged contact yet'
          : `${c.daysSinceTouch}d quiet (cadence ${c.cadenceDays}d)`,
      suggested_action: 'Send a warm follow-up',
      suggested_channel: 'email',
      priority: c.priority,
      surface_date: today,
      status: 'pending',
    }))
    const { error: insErr } = await supabase.from('nudge').insert(rows)
    if (insErr) throw new Error(`insert nudges: ${insErr.message}`)
  }

  return candidates
}
