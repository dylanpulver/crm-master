import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// Magic-link landing: verify the OTP token_hash, set the session, redirect home.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token_hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const rawNext = url.searchParams.get('next') ?? '/'
  // only allow same-origin relative paths (block //host, /\host, absolute URLs)
  const next = /^\/(?![/\\])/.test(rawNext) ? rawNext : '/'

  if (token_hash && type) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin))
}
