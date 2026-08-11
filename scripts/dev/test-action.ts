// Verify the signed-action route: sign a real link, fire it, confirm the DB mutated.
// Run: npx tsx scripts/dev/test-action.ts [port]
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}
const port = process.argv[2] ?? '3002'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

function signAction(payload: object, ttl = 3600) {
  const full = { ...payload, exp: Math.floor(Date.now() / 1000) + ttl }
  const body = Buffer.from(JSON.stringify(full)).toString('base64url')
  const sig = createHmac('sha256', process.env.ACTION_LINK_SECRET!).update(body).digest('base64url')
  return `${body}.${sig}`
}

async function main() {
  const { data: list } = await sb.auth.admin.listUsers()
  const operatorId = list.users.find((u) => u.email === 'alex+test@crm-master.local')!.id

  const { data: nudge } = await sb
    .from('nudge')
    .select('id, person_id, person:person_id(full_name)')
    .eq('operator_id', operatorId)
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .limit(1)
    .single()
  if (!nudge) throw new Error('no pending nudge to act on')
  const personName = (nudge.person as { full_name: string }).full_name
  console.log('acting on nudge for:', personName)

  const token = signAction({ action: 'log_touch', nudgeId: nudge.id, operatorId })
  const res = await fetch(`http://localhost:${port}/api/a/log_touch?t=${token}`)
  console.log('action route status:', res.status)

  // verify mutations
  const { data: after } = await sb.from('nudge').select('status, resolved_at').eq('id', nudge.id).single()
  const { count: interactions } = await sb
    .from('interaction')
    .select('*', { count: 'exact', head: true })
    .eq('person_id', nudge.person_id)
  const { data: rel } = await sb
    .from('operator_relationship')
    .select('last_touch_at, engagement_score')
    .eq('operator_id', operatorId)
    .eq('person_id', nudge.person_id)
    .single()
  console.log('nudge status →', after?.status)
  console.log('interactions logged →', interactions)
  console.log('relationship last_touch →', rel?.last_touch_at, '| engagement →', rel?.engagement_score)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
