import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeEmail, isRoleAddress } from '@/lib/normalize/email'
import type { ImportContact } from '@/lib/import/linkedin'

// Import contacts under an operator. Dedup on LinkedIn URL (external_id) and on
// normalized email. No-signal CSV → seed everyone as a low-closeness acquaintance
// with last_touch = now, so the going-cold engine doesn't flood on day one; the
// user raises closeness on the people who matter (which tightens their cadence).

const CHUNK = 500
const SEED_CLOSENESS = 20
const SEED_TIER = 'acquaintance'

export type ImportResult = { imported: number; skipped: number; total: number }

export async function importContacts(
  supabase: SupabaseClient,
  operatorId: string,
  contacts: ImportContact[]
): Promise<ImportResult> {
  // existing dedup keys for this operator
  const { data: existingPersons } = await supabase
    .from('person')
    .select('external_id')
    .eq('operator_id', operatorId)
    .not('external_id', 'is', null)
  const seenUrls = new Set((existingPersons ?? []).map((p) => p.external_id as string))

  const { data: existingCm } = await supabase
    .from('contact_method')
    .select('normalized_value')
    .eq('operator_id', operatorId)
    .eq('type', 'email')
  const seenEmails = new Set((existingCm ?? []).map((c) => c.normalized_value as string))

  const fresh = contacts.filter((c) => {
    if (c.url && seenUrls.has(c.url)) return false
    const email = c.email && !isRoleAddress(c.email) ? normalizeEmail(c.email) : null
    if (email && seenEmails.has(email)) return false
    if (c.url) seenUrls.add(c.url)
    if (email) seenEmails.add(email)
    return true
  })

  const now = new Date().toISOString()
  let imported = 0

  for (let i = 0; i < fresh.length; i += CHUNK) {
    const batch = fresh.slice(i, i + CHUNK)
    const personRows = batch.map((c) => ({
      operator_id: operatorId,
      full_name: c.fullName,
      current_company: c.company ?? null,
      current_title: c.position ?? null,
      source: 'linkedin',
      external_id: c.url ?? null,
    }))
    const { data: inserted, error } = await supabase.from('person').insert(personRows).select('id')
    if (error) throw new Error(`person insert: ${error.message}`)
    if (!inserted) continue

    // inserted rows are in insertion order → zip by index
    const cmRows: object[] = []
    const relRows: object[] = []
    inserted.forEach((p, idx) => {
      const c = batch[idx]
      const email = c.email && !isRoleAddress(c.email) ? normalizeEmail(c.email) : null
      if (email) {
        cmRows.push({
          operator_id: operatorId,
          person_id: p.id,
          type: 'email',
          value: c.email,
          normalized_value: email,
          is_primary: true,
        })
      }
      relRows.push({
        operator_id: operatorId,
        person_id: p.id,
        closeness_score: SEED_CLOSENESS,
        closeness_tier: SEED_TIER,
        engagement_score: 0,
        engagement_updated_at: now,
        last_touch_at: now,
      })
    })
    if (cmRows.length) await supabase.from('contact_method').insert(cmRows)
    if (relRows.length) await supabase.from('operator_relationship').insert(relRows)
    imported += inserted.length
  }

  return { imported, skipped: contacts.length - fresh.length, total: contacts.length }
}
