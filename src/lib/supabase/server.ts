import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

// Per-request server client (publishable key + the request's cookies). RLS enforced.
export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // called from a Server Component — middleware refreshes the session instead
        }
      },
    },
  })
}

// Service-role client — BYPASSES RLS. Server-only, never near the browser.
// Use exclusively for jobs/sync/oauth_token access.
export function createServiceSupabase() {
  if (!env.supabaseServiceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
  return createAdminClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
