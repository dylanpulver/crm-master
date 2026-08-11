// Verify approve_send: GET must NOT mutate (renders confirm); POST mutates.
// Run: npx tsx scripts/dev/test-approve.ts <port>
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}
const port = process.argv[2] ?? '3000'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})
const sign = (p: object) => {
  const full = { ...p, exp: Math.floor(Date.now() / 1000) + 3600 }
  const body = Buffer.from(JSON.stringify(full)).toString('base64url')
  const sig = createHmac('sha256', process.env.ACTION_LINK_SECRET!).update(body).digest('base64url')
  return `${body}.${sig}`
}

async function main() {
  const { data: list } = await sb.auth.admin.listUsers()
  const operatorId = list.users.find((u) => u.email === 'alex+test@crm-master.local')!.id
  const { data: nudge } = await sb
    .from('nudge').select('id').eq('operator_id', operatorId).eq('status', 'pending')
    .order('priority', { ascending: false }).limit(1).single()
  const token = sign({ action: 'approve_send', nudgeId: nudge!.id, operatorId })
  const url = `http://localhost:${port}/api/a/approve_send?t=${token}`

  const get = await fetch(url)
  const getBody = await get.text()
  const { data: afterGet } = await sb.from('nudge').select('status').eq('id', nudge!.id).single()
  console.log('GET status:', get.status, '| has confirm form:', getBody.includes('Confirm'), '| nudge after GET:', afterGet?.status)

  const post = await fetch(url, { method: 'POST' })
  const { data: afterPost } = await sb.from('nudge').select('status').eq('id', nudge!.id).single()
  console.log('POST status:', post.status, '| nudge after POST:', afterPost?.status)

  console.log(
    afterGet?.status === 'pending' && afterPost?.status === 'done'
      ? '\n✅ SECURE: GET did not mutate; POST did.'
      : '\n❌ FAIL'
  )
}
main().catch((e) => { console.error(e); process.exit(1) })
