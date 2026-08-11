import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateGoingColdNudges } from '@/lib/jobs/nudges'
import { generateDraft } from '@/lib/ai/client'
import { signAction } from '@/lib/crypto/actionLinks'
import { sendDigest } from '@/lib/email/digest'
import type { DigestNudge } from '@/emails/DailyDigest'
import type { HistoryItem } from '@/lib/ai/prompts'

// Orchestrates the daily digest: generate nudges → draft the top ones →
// sign one-tap action links → send the email. Draft-by-default (nothing is sent
// to contacts; the digest just shows drafts for one-tap approval).

type NudgeRow = {
  id: string
  person_id: string
  reason: string | null
  priority: number
  person: { full_name: string } | { full_name: string }[] | null
}

const name = (p: NudgeRow['person']) =>
  !p ? 'Unknown' : Array.isArray(p) ? (p[0]?.full_name ?? 'Unknown') : p.full_name

async function fetchHistory(sb: SupabaseClient, personId: string): Promise<HistoryItem[]> {
  const { data } = await sb
    .from('interaction')
    .select('occurred_at, type, summary')
    .eq('person_id', personId)
    .order('occurred_at', { ascending: false })
    .limit(8)
  return (data ?? []).map((i) => ({
    date: String(i.occurred_at).slice(0, 10),
    type: i.type,
    summary: i.summary ?? '',
  }))
}

export async function runDailyDigest(
  sb: SupabaseClient,
  operatorId: string,
  opts: { to: string; operatorName: string; appUrl: string; now?: Date; draftTop?: number }
): Promise<{ sent: boolean; nudgeCount: number; emailId?: string }> {
  const now = opts.now ?? new Date()
  const draftTop = opts.draftTop ?? 3
  const today = now.toISOString().slice(0, 10)

  await generateGoingColdNudges(sb, operatorId, { now })

  const { data, error } = await sb
    .from('nudge')
    .select('id, person_id, reason, priority, person:person_id(full_name)')
    .eq('operator_id', operatorId)
    .eq('type', 'going_cold')
    .eq('surface_date', today)
    .eq('status', 'pending')
    .order('priority', { ascending: false })
  if (error) throw new Error(`fetch nudges: ${error.message}`)
  const nudges = (data ?? []) as NudgeRow[]
  if (nudges.length === 0) return { sent: false, nudgeCount: 0 }

  const digestNudges: DigestNudge[] = []
  for (let i = 0; i < nudges.length; i++) {
    const n = nudges[i]
    const personName = name(n.person)
    const sign = (action: 'snooze' | 'log_touch' | 'approve_send') =>
      `${opts.appUrl}/api/a/${action}?t=${signAction({ action, nudgeId: n.id, operatorId })}`

    let draftPreview: string | undefined
    let approveUrl: string | undefined
    if (i < draftTop) {
      const history = await fetchHistory(sb, n.person_id)
      const body = await generateDraft({
        operatorName: opts.operatorName,
        contactName: personName,
        draftType: 'followup',
        history,
      })
      // persist the draft
      const { data: d } = await sb
        .from('draft')
        .insert({
          operator_id: operatorId,
          person_id: n.person_id,
          nudge_id: n.id,
          channel_type: 'email',
          body,
          draft_type: 'followup',
        })
        .select('id')
        .single()
      if (d) await sb.from('nudge').update({ draft_id: d.id }).eq('id', n.id)
      draftPreview = body.length > 220 ? body.slice(0, 220) + '…' : body
      approveUrl = sign('approve_send')
    }

    digestNudges.push({
      personName,
      reason: n.reason ?? 'Going cold',
      lastTouchLabel: '',
      draftPreview,
      approveUrl,
      snoozeUrl: sign('snooze'),
      logTouchUrl: sign('log_touch'),
    })
  }

  const { id } = await sendDigest(opts.to, {
    operatorName: opts.operatorName,
    dateLabel: now.toDateString().slice(0, 10),
    nudges: digestNudges,
    appUrl: opts.appUrl,
  })

  return { sent: true, nudgeCount: nudges.length, emailId: id }
}
