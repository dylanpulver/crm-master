'use server'

import { refresh } from 'next/cache'
import { revalidatePath } from 'next/cache'
import { requireOperator } from '@/lib/dal'
import { createServerSupabase } from '@/lib/supabase/server'
import { markNudgeDone, snoozeNudge } from '@/lib/nudges/mutations'

// Server Actions for the nudge queue. Auth happens here (DAL) on every call —
// actions are reachable via direct POST, never trust the form alone.
// Mutations run on the RLS-scoped client (operator can only touch own rows).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveAction(formData: FormData, kind: 'done' | 'snooze') {
  const user = await requireOperator()
  const nudgeId = formData.get('nudgeId')
  if (typeof nudgeId !== 'string' || !UUID_RE.test(nudgeId)) return

  const supabase = await createServerSupabase()
  const ref = { operatorId: user.id, nudgeId }
  if (kind === 'done') await markNudgeDone(supabase, ref)
  else await snoozeNudge(supabase, ref)

  revalidatePath('/') // dashboard "nudges pending" count
  refresh()
}

export async function doneAction(formData: FormData) {
  await resolveAction(formData, 'done')
}

export async function snoozeAction(formData: FormData) {
  await resolveAction(formData, 'snooze')
}
