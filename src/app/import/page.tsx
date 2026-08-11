'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ImportPage() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const csv = await file.text()
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csv }),
      })
      const data = await res.json()
      if (!res.ok) setErr(data.error ?? 'Import failed')
      else setMsg(`Imported ${data.imported} contacts (${data.skipped} duplicates skipped).`)
    } catch {
      setErr('Could not read the file.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0c10] text-[#e7e9ee] px-4 py-10">
      <div className="max-w-md mx-auto">
        <Link href="/" className="text-xs text-[#9aa0ad] hover:text-white">
          ← back
        </Link>
        <h1 className="text-xl font-bold mt-4 mb-1">Import contacts</h1>
        <p className="text-sm text-[#9aa0ad] mb-6">
          Upload your LinkedIn <span className="text-white">Connections.csv</span> (Settings → Data
          Privacy → Get a copy of your data → Connections).
        </p>

        <label className="block rounded-xl border border-dashed border-[#2a2e3a] bg-[#15171e] p-8 text-center cursor-pointer hover:border-[#6e78ff]">
          <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} className="hidden" />
          <span className="text-sm text-[#9aa0ad]">{busy ? 'Importing…' : 'Choose CSV file'}</span>
        </label>

        {msg ? <p className="text-sm text-green-400 mt-4">{msg}</p> : null}
        {err ? <p className="text-sm text-red-400 mt-4">{err}</p> : null}
      </div>
    </main>
  )
}
