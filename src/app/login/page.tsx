'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErr('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/confirm` },
    })
    setLoading(false)
    if (error) setErr(error.message)
    else setSent(true)
  }

  return (
    <main className="min-h-screen grid place-items-center bg-[#0b0c10] text-[#e7e9ee] px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold mb-1">crm-master</h1>
        <p className="text-sm text-[#9aa0ad] mb-6">Sign in to your warm network.</p>
        {sent ? (
          <p className="text-sm bg-[#15171e] rounded-xl p-4">
            Check <span className="text-white">{email}</span> for a magic link.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg bg-[#15171e] border border-[#1c1f28] px-3 py-2 text-sm outline-none focus:border-[#6e78ff]"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#6e78ff] text-white font-semibold text-sm py-2 disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
            {err ? <p className="text-sm text-red-400">{err}</p> : null}
          </form>
        )}
      </div>
    </main>
  )
}
