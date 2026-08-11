import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'

// Data Access Layer — the security choke point.
// All auth/authz happens here. Use getUser() (verified), never getSession().

export const getOperator = cache(async () => {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

export async function requireOperator() {
  const user = await getOperator()
  if (!user) redirect('/login')
  return user
}
