import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Next 16: `middleware` convention renamed to `proxy` (nodejs runtime).
// Session refresh only — auth/authz live in the DAL + Server Actions.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
