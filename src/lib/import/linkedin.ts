// Parser for a LinkedIn "Connections" CSV export. The file begins with a few
// "Notes:" preamble lines before the real header, so we scan for the header row.
// Header: First Name, Last Name, URL, Email Address, Company, Position, Connected On

export type ImportContact = {
  firstName: string
  lastName: string
  fullName: string
  url?: string
  email?: string
  company?: string
  position?: string
  connectedOn?: string
}

/** Parse a single CSV line honoring double-quoted fields with embedded commas/quotes. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

export function parseLinkedinCsv(text: string): ImportContact[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const headerIdx = lines.findIndex((l) => /^"?First Name"?,/i.test(l))
  if (headerIdx === -1) return []

  const header = parseCsvLine(lines[headerIdx]).map((h) => h.toLowerCase())
  const col = (name: string) => header.indexOf(name)
  const iFirst = col('first name')
  const iLast = col('last name')
  const iUrl = col('url')
  const iEmail = col('email address')
  const iCompany = col('company')
  const iPos = col('position')
  const iConn = col('connected on')

  const out: ImportContact[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const f = parseCsvLine(lines[i])
    const firstName = f[iFirst] ?? ''
    const lastName = f[iLast] ?? ''
    const fullName = `${firstName} ${lastName}`.trim()
    if (!fullName) continue
    out.push({
      firstName,
      lastName,
      fullName,
      url: f[iUrl] || undefined,
      email: f[iEmail] || undefined,
      company: f[iCompany] || undefined,
      position: f[iPos] || undefined,
      connectedOn: f[iConn] || undefined,
    })
  }
  return out
}
