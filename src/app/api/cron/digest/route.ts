import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase/server'
import { runDailyDigest } from '@/lib/jobs/digest'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Nightly digest. Protected by CRON_SECRET. Runs for every operator that has
// relationships; sends to the operator's email (or DIGEST_TO for test accounts).
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!env.cronSecret || auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sb = createServiceSupabase()
  const { data: rels, error } = await sb.from('operator_relationship').select('operator_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const operatorIds = [...new Set((rels ?? []).map((r) => r.operator_id as string))]
  const results: unknown[] = []

  for (const operatorId of operatorIds) {
    const { data: u } = await sb.auth.admin.getUserById(operatorId)
    const email = u.user?.email ?? ''
    const to = email && !email.endsWith('.local') ? email : env.digestTo
    if (!to) {
      results.push({ operatorId, skipped: 'no recipient' })
      continue
    }
    const r = await runDailyDigest(sb, operatorId, {
      to,
      operatorName: (u.user?.user_metadata?.name as string) ?? 'there',
      appUrl: env.appUrl,
    })
    results.push({ operatorId, to, ...r })
  }

  return NextResponse.json({ ok: true, operators: operatorIds.length, results })
}
