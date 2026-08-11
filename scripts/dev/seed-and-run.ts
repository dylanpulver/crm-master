// Live test: seed a test operator + contacts, run the going-cold nudge job.
// Run: npx tsx scripts/dev/seed-and-run.ts
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { generateGoingColdNudges } from '../../src/lib/jobs/nudges'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const TEST_EMAIL = 'alex+test@crm-master.local'
const DAY = 86_400_000

async function ensureOperator(): Promise<string> {
  const { data: list } = await sb.auth.admin.listUsers()
  const existing = list.users.find((u) => u.email === TEST_EMAIL)
  if (existing) return existing.id
  const { data, error } = await sb.auth.admin.createUser({
    email: TEST_EMAIL,
    email_confirm: true,
    password: 'test-' + Math.random().toString(36).slice(2),
  })
  if (error) throw error
  return data.user.id
}

const seed = (now: number) => [
  { name: 'Sam Patel', closeness: 90, tier: 'inner_circle', touchDaysAgo: 34 },
  { name: 'Dana Cole', closeness: 45, tier: 'known', touchDaysAgo: 71 },
  { name: 'Jordan Webb', closeness: 70, tier: 'close', touchDaysAgo: 5 }, // within cadence → no nudge
  { name: 'Alex Kim', closeness: 25, tier: 'acquaintance', touchDaysAgo: 200 },
  { name: 'Robin Vez', closeness: 88, tier: 'inner_circle', touchDaysAgo: 2 }, // warm → no nudge
  { name: 'Pat Lee', closeness: 50, tier: 'known', touchDaysAgo: null }, // never touched
].map((c) => ({
  ...c,
  lastTouch: c.touchDaysAgo === null ? null : new Date(now - c.touchDaysAgo * DAY).toISOString(),
}))

async function main() {
  const operatorId = await ensureOperator()
  console.log('operator:', operatorId)

  // clean prior test data
  await sb.from('person').delete().eq('operator_id', operatorId)

  const now = Date.now()
  for (const c of seed(now)) {
    const { data: p, error } = await sb
      .from('person')
      .insert({ operator_id: operatorId, full_name: c.name, source: 'manual' })
      .select('id')
      .single()
    if (error) throw error
    await sb.from('contact_method').insert({
      operator_id: operatorId,
      person_id: p.id,
      type: 'email',
      value: `${c.name.split(' ')[0].toLowerCase()}@example.com`,
      normalized_value: `${c.name.split(' ')[0].toLowerCase()}@example.com`,
      is_primary: true,
    })
    await sb.from('operator_relationship').insert({
      operator_id: operatorId,
      person_id: p.id,
      closeness_score: c.closeness,
      closeness_tier: c.tier,
      engagement_score: 0,
      engagement_updated_at: c.lastTouch ?? new Date(now).toISOString(),
      last_touch_at: c.lastTouch,
    })
  }
  console.log('seeded', seed(now).length, 'contacts')

  const nudges = await generateGoingColdNudges(sb, operatorId, { now: new Date(now) })
  console.log('\n=== GOING-COLD NUDGES (ranked) ===')
  for (const n of nudges) {
    console.log(
      `  ${n.personName.padEnd(12)} priority=${n.priority.toFixed(1).padStart(6)}  (${n.daysSinceTouch ?? 'never'}d, cadence ${n.cadenceDays}d)`
    )
  }
  const { count } = await sb
    .from('nudge')
    .select('*', { count: 'exact', head: true })
    .eq('operator_id', operatorId)
    .eq('status', 'pending')
  console.log('\nnudge rows persisted:', count)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
