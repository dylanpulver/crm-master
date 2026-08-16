import Link from 'next/link'
import { requireOperator } from '@/lib/dal'
import { createServerSupabase } from '@/lib/supabase/server'
import { resolveCadenceDays } from '@/lib/scoring/cadence'
import { whyNow, currentWarmth, warmthLabel, previewDraft } from '@/lib/nudges/queue'
import type { ClosenessTier } from '@/lib/domain/types'
import { doneAction, snoozeAction } from './actions'

export const dynamic = 'force-dynamic'

// The daily surface: ranked pending nudges (plus snoozes that have expired),
// each with why-now, live warmth, the AI draft if one exists, and one-tap
// done / snooze wired to Server Actions.

type One<T> = T | T[] | null
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

type RelRow = {
  closeness_tier: ClosenessTier
  engagement_score: number
  engagement_updated_at: string
  last_touch_at: string | null
  cadence_override_days: number | null
}

type NudgeRow = {
  id: string
  status: string
  priority: number
  suggested_action: string | null
  person: One<{
    full_name: string
    current_company: string | null
    current_title: string | null
    operator_relationship: One<RelRow>
  }>
  drafts: { body: string; status: string; created_at: string }[] | null
}

const WARMTH_COLOR: Record<ReturnType<typeof warmthLabel>, string> = {
  cold: '#4b5163',
  cool: '#6e78ff',
  warm: '#f0a35e',
  hot: '#f0655e',
}

function Warmth({ value }: { value: number }) {
  const label = warmthLabel(value)
  return (
    <div className="flex items-center gap-2 shrink-0" title={`warmth ${(value * 100).toFixed(0)}%`}>
      <div className="w-14 h-1.5 rounded-full bg-[#2a2e3a] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(value * 100, 4)}%`, backgroundColor: WARMTH_COLOR[label] }}
        />
      </div>
      <span className="text-[10px] uppercase tracking-wide text-[#9aa0ad]">{label}</span>
    </div>
  )
}

function Actions({ nudgeId, top }: { nudgeId: string; top: boolean }) {
  return (
    <form className="flex gap-2">
      <input type="hidden" name="nudgeId" value={nudgeId} />
      <button
        formAction={doneAction}
        className={`rounded-lg text-xs font-semibold px-3 py-1.5 ${
          top ? 'bg-[#6e78ff] text-white' : 'bg-[#232633] text-[#e7e9ee] hover:bg-[#6e78ff]'
        }`}
      >
        Done
      </button>
      <button
        formAction={snoozeAction}
        className="rounded-lg text-xs font-semibold px-3 py-1.5 border border-[#2a2e3a] text-[#9aa0ad] hover:text-white"
      >
        Snooze 3d
      </button>
    </form>
  )
}

export default async function NudgesPage() {
  const user = await requireOperator()
  const supabase = await createServerSupabase()
  const now = new Date()

  const { data, error } = await supabase
    .from('nudge')
    .select(
      `id, status, priority, suggested_action,
       person:person_id(full_name, current_company, current_title,
         operator_relationship(closeness_tier, engagement_score, engagement_updated_at, last_touch_at, cadence_override_days)),
       drafts:draft!nudge_id(body, status, created_at)`
    )
    .eq('operator_id', user.id)
    .or(`status.eq.pending,and(status.eq.snoozed,snoozed_until.lte.${now.toISOString()})`)
    .order('priority', { ascending: false })
  if (error) throw new Error(`fetch nudges: ${error.message}`)
  const nudges = (data ?? []) as unknown as NudgeRow[]

  return (
    <main className="min-h-screen bg-[#0b0c10] text-[#e7e9ee] px-4 py-10">
      <div className="max-w-xl mx-auto">
        <Link href="/" className="text-xs text-[#9aa0ad] hover:text-white">
          ← back
        </Link>
        <div className="flex items-baseline justify-between mt-4 mb-1">
          <h1 className="text-xl font-bold">Nudge queue</h1>
          <span className="text-xs text-[#9aa0ad]">
            {nudges.length} pending
          </span>
        </div>
        <p className="text-sm text-[#9aa0ad] mb-6">Who to warm up today, ranked.</p>

        {nudges.length === 0 ? (
          <div className="bg-[#15171e] rounded-xl p-8 text-center">
            <div className="text-2xl mb-2">✓</div>
            <p className="text-sm text-[#9aa0ad]">
              Queue clear — nothing going cold right now.
            </p>
          </div>
        ) : (
          <ol className="space-y-3">
            {nudges.map((n, i) => {
              const person = one(n.person)
              const rel = person ? one(person.operator_relationship) : null
              const top = i === 0
              const cadenceDays = rel
                ? resolveCadenceDays({
                    tier: rel.closeness_tier,
                    personOverrideDays: rel.cadence_override_days,
                  })
                : null
              const why =
                rel && cadenceDays !== null
                  ? whyNow(rel.last_touch_at ? new Date(rel.last_touch_at) : null, cadenceDays, now)
                  : null
              const warmth = rel
                ? currentWarmth(rel.engagement_score, new Date(rel.engagement_updated_at), now)
                : 0
              const draft = (n.drafts ?? [])
                .filter((d) => d.status !== 'discarded')
                .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
              const roleLine = person
                ? [person.current_title, person.current_company].filter(Boolean).join(' · ')
                : ''

              return (
                <li
                  key={n.id}
                  className={`bg-[#15171e] rounded-xl ${
                    top ? 'p-5 ring-1 ring-[#6e78ff]/50' : 'p-4'
                  }`}
                >
                  {top ? (
                    <div className="text-[10px] uppercase tracking-widest text-[#6e78ff] font-semibold mb-2">
                      Top nudge
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`font-semibold truncate ${top ? 'text-lg' : 'text-sm'}`}>
                        {person?.full_name ?? 'Unknown'}
                      </div>
                      {roleLine ? (
                        <div className="text-xs text-[#9aa0ad] truncate">{roleLine}</div>
                      ) : null}
                    </div>
                    <Warmth value={warmth} />
                  </div>

                  {why ? <p className="text-xs text-[#9aa0ad] mt-2">{why}</p> : null}
                  {top && n.suggested_action ? (
                    <p className="text-xs text-[#e7e9ee] mt-1">{n.suggested_action}</p>
                  ) : null}

                  {draft ? (
                    <p
                      className={`text-xs text-[#9aa0ad] italic border-l-2 border-[#2a2e3a] pl-3 mt-3 ${
                        top ? '' : 'line-clamp-2'
                      }`}
                    >
                      {previewDraft(draft.body)}
                    </p>
                  ) : null}

                  <div className="mt-3">
                    <Actions nudgeId={n.id} top={top} />
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </main>
  )
}
