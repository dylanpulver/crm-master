import { NextResponse } from 'next/server'
import { requireOperator } from '@/lib/dal'
import { createServerSupabase } from '@/lib/supabase/server'
import { parseLinkedinCsv } from '@/lib/import/linkedin'
import { importContacts } from '@/lib/import/run'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  const user = await requireOperator()
  const { csv } = (await request.json()) as { csv?: string }
  if (!csv) return NextResponse.json({ error: 'no csv' }, { status: 400 })

  const contacts = parseLinkedinCsv(csv)
  if (contacts.length === 0) {
    return NextResponse.json({ error: 'No rows found — is this a LinkedIn Connections export?' }, { status: 400 })
  }

  const supabase = await createServerSupabase()
  const result = await importContacts(supabase, user.id, contacts)
  return NextResponse.json({ ok: true, ...result })
}
