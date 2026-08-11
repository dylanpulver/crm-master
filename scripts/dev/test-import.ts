// Live test: parse a sample LinkedIn CSV + import under the test operator, twice (dedup).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { parseLinkedinCsv } from '../../src/lib/import/linkedin'
import { importContacts } from '../../src/lib/import/run'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const CSV = `Notes:
"Some preamble line"

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Maya,Chen,https://linkedin.com/in/mayachen,maya@startup.io,Startup Co,Founder,03 Feb 2025
Leo,Park,https://linkedin.com/in/leopark,,Park Capital,Partner,11 Nov 2024
no-reply,bot,https://linkedin.com/in/bot,no-reply@svc.com,,,01 Jan 2024
Ravi,Kumar,https://linkedin.com/in/ravikumar,ravi@firm.com,"Kumar, Firm & Co",MD,20 Jun 2023
`

async function main() {
  const { data: list } = await sb.auth.admin.listUsers()
  const op = list.users.find((u) => u.email === 'alex+test@crm-master.local')!.id

  const contacts = parseLinkedinCsv(CSV)
  console.log('parsed contacts:', contacts.length)

  const r1 = await importContacts(sb, op, contacts)
  console.log('import #1:', r1)
  const r2 = await importContacts(sb, op, contacts)
  console.log('import #2 (should all skip):', r2)

  const { count } = await sb
    .from('person')
    .select('*', { count: 'exact', head: true })
    .eq('operator_id', op)
    .eq('source', 'linkedin')
  console.log('linkedin contacts in DB:', count)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
