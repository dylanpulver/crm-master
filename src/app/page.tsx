import Link from 'next/link'
import { requireOperator } from '@/lib/dal'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const user = await requireOperator()
  const supabase = await createServerSupabase()

  const [{ count: people }, { count: pending }] = await Promise.all([
    supabase.from('person').select('*', { count: 'exact', head: true }),
    supabase
      .from('nudge')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  return (
    <main className="min-h-screen bg-[#0b0c10] text-[#e7e9ee] px-4 py-10">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold">crm-master</h1>
          <form action="/auth/signout" method="post">
            <button className="text-xs text-[#9aa0ad] hover:text-white">Sign out</button>
          </form>
        </div>

        <p className="text-sm text-[#9aa0ad] mb-6">{user.email}</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#15171e] rounded-xl p-4">
            <div className="text-2xl font-bold">{people ?? 0}</div>
            <div className="text-xs text-[#9aa0ad]">contacts</div>
          </div>
          <div className="bg-[#15171e] rounded-xl p-4">
            <div className="text-2xl font-bold">{pending ?? 0}</div>
            <div className="text-xs text-[#9aa0ad]">nudges pending</div>
          </div>
        </div>

        <Link
          href="/import"
          className="block text-center rounded-lg bg-[#6e78ff] text-white font-semibold text-sm py-2.5"
        >
          Import contacts
        </Link>
      </div>
    </main>
  )
}
